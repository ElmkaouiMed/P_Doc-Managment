import { DocumentStatus, NotificationChannel, NotificationStatus, NotificationType } from "@/lib/db-client";
import type { Prisma } from "@/lib/db-client";

import { prisma } from "@/lib/db";

import {
  DEFAULT_NOTIFICATION_CONFIG,
  NOTIFICATION_CONFIG_KEY,
  NotificationConfigInput,
  sanitizeNotificationConfig,
} from "@/features/notifications/config";

const DAY_MS = 24 * 60 * 60 * 1000;
const USAGE_ALERT_THRESHOLDS = [70, 90, 100] as const;

const DUE_NOTIFICATION_ELIGIBLE_STATUSES: DocumentStatus[] = [
  DocumentStatus.ISSUED,
  DocumentStatus.SENT,
  DocumentStatus.APPROVED,
  DocumentStatus.PARTIALLY_PAID,
  DocumentStatus.OVERDUE,
];

function toStartOfDay(input: Date) {
  const value = new Date(input);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dayDiff(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

function toMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function toErrorText(value: unknown, fallback: string) {
  const source = typeof value === "string" ? value : "";
  const clean = source.trim();
  if (!clean) {
    return fallback;
  }
  return clean.slice(0, 1900);
}

function dueSoonBody(input: { number: string; clientName: string; dueDate: Date; daysUntil: number }) {
  const dayText = input.daysUntil === 0 ? "today" : `in ${input.daysUntil} day(s)`;
  return `${input.number} for ${input.clientName} is due ${dayText} (${input.dueDate.toISOString().slice(0, 10)}).`;
}

function overdueBody(input: { number: string; clientName: string; dueDate: Date; daysOverdue: number }) {
  return `${input.number} for ${input.clientName} is overdue by ${input.daysOverdue} day(s) (due ${input.dueDate.toISOString().slice(0, 10)}).`;
}

function draftStaleBody(input: { number: string; clientName: string; daysStale: number }) {
  return `${input.number} for ${input.clientName} has stayed in draft for ${input.daysStale} day(s).`;
}

function usageMetricLabel(metric: "documents_per_month" | "exports_per_month") {
  return metric === "documents_per_month" ? "Documents" : "Exports";
}

function hasEventKey(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

async function createNotificationEventsIgnoringExisting(rows: Prisma.NotificationEventCreateManyInput[]) {
  if (!rows.length) {
    return 0;
  }

  const seenEventKeys = new Set<string>();
  const dedupedRows: Prisma.NotificationEventCreateManyInput[] = [];

  for (const row of rows) {
    if (!hasEventKey(row.eventKey)) {
      dedupedRows.push(row);
      continue;
    }
    if (seenEventKeys.has(row.eventKey)) {
      continue;
    }
    seenEventKeys.add(row.eventKey);
    dedupedRows.push(row);
  }

  if (!seenEventKeys.size) {
    const created = await prisma.notificationEvent.createMany({ data: dedupedRows });
    return created.count;
  }

  const existing = await prisma.notificationEvent.findMany({
    where: {
      companyId: rows[0]!.companyId,
      eventKey: {
        in: Array.from(seenEventKeys),
      },
    },
    select: {
      eventKey: true,
    },
  });

  const existingEventKeys = new Set(
    existing.map((row) => row.eventKey).filter((value): value is string => hasEventKey(value)),
  );
  const toInsert = dedupedRows.filter((row) => !hasEventKey(row.eventKey) || !existingEventKeys.has(row.eventKey));

  if (!toInsert.length) {
    return 0;
  }

  const created = await prisma.notificationEvent.createMany({ data: toInsert });
  return created.count;
}

export type NotificationFeedItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  actionPath: string | null;
  createdAt: string;
  isRead: boolean;
};

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function getCompanyNotificationConfig(companyId: string): Promise<NotificationConfigInput> {
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId,
        key: NOTIFICATION_CONFIG_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return DEFAULT_NOTIFICATION_CONFIG;
  }

  return sanitizeNotificationConfig(row.valueJson);
}

export async function saveCompanyNotificationConfig(companyId: string, input: Partial<NotificationConfigInput>) {
  const next = sanitizeNotificationConfig({
    ...DEFAULT_NOTIFICATION_CONFIG,
    ...input,
  });

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId,
        key: NOTIFICATION_CONFIG_KEY,
      },
    },
    create: {
      companyId,
      key: NOTIFICATION_CONFIG_KEY,
      valueJson: next,
    },
    update: {
      valueJson: next,
    },
  });

  return next;
}

export async function refreshDueDocumentNotifications(companyId: string) {
  const config = await getCompanyNotificationConfig(companyId);
  if (!config.enabled || !config.inAppEnabled) {
    return { created: 0 as const };
  }

  const today = toStartOfDay(new Date());
  const now = new Date();
  const rows: Prisma.NotificationEventCreateManyInput[] = [];

  if (config.notifyDueSoon || config.notifyOverdue) {
    const invoices = await prisma.document.findMany({
      where: {
        companyId,
        documentType: "FACTURE",
        status: { in: DUE_NOTIFICATION_ELIGIBLE_STATUSES },
        dueDate: { not: null },
      },
      select: {
        id: true,
        documentNumber: true,
        dueDate: true,
        amountDue: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    for (const invoice of invoices) {
      const dueDate = invoice.dueDate ? toStartOfDay(invoice.dueDate) : null;
      if (!dueDate) {
        continue;
      }

      const amountDue = toMoney(invoice.amountDue);
      if (amountDue <= 0) {
        continue;
      }

      const daysUntil = dayDiff(dueDate, today);
      const clientName = invoice.client?.name || "Client";

      if (config.notifyDueSoon && daysUntil >= 0 && daysUntil <= config.dueSoonDays) {
        rows.push({
          companyId,
          documentId: invoice.id,
          notificationType: NotificationType.DUE_SOON,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          eventKey: `due-soon:${invoice.id}:${dueDate.toISOString().slice(0, 10)}:${daysUntil}`,
          title: "Invoice due soon",
          body: dueSoonBody({
            number: invoice.documentNumber,
            clientName,
            dueDate,
            daysUntil,
          }),
          actionPath: "/documents",
          metadataJson: {
            documentNumber: invoice.documentNumber,
            clientName,
            dueDate: dueDate.toISOString(),
            daysUntilDue: daysUntil,
          },
          sentAt: now,
        });
      }

      if (!config.notifyOverdue) {
        continue;
      }

      const daysOverdue = Math.abs(daysUntil);
      if (daysUntil < 0 && daysOverdue >= config.overdueDays) {
        const offset = daysOverdue - config.overdueDays;
        if (offset % config.overdueRepeatDays !== 0) {
          continue;
        }

        rows.push({
          companyId,
          documentId: invoice.id,
          notificationType: NotificationType.OVERDUE,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          eventKey: `overdue:${invoice.id}:${dueDate.toISOString().slice(0, 10)}:${daysOverdue}`,
          title: "Invoice overdue",
          body: overdueBody({
            number: invoice.documentNumber,
            clientName,
            dueDate,
            daysOverdue,
          }),
          actionPath: "/documents",
          metadataJson: {
            documentNumber: invoice.documentNumber,
            clientName,
            dueDate: dueDate.toISOString(),
            daysOverdue,
          },
          sentAt: now,
        });
      }
    }
  }

  if (config.notifyDraftStale) {
    const drafts = await prisma.document.findMany({
      where: {
        companyId,
        status: DocumentStatus.DRAFT,
      },
      select: {
        id: true,
        documentNumber: true,
        createdAt: true,
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    for (const draft of drafts) {
      const daysStale = dayDiff(today, toStartOfDay(draft.createdAt));
      if (daysStale < config.draftStaleDays) {
        continue;
      }

      const clientName = draft.client?.name || "Client";
      rows.push({
        companyId,
        documentId: draft.id,
        notificationType: NotificationType.DRAFT_STALE,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        eventKey: `draft-stale:${draft.id}:${daysStale}`,
        title: "Draft pending too long",
        body: draftStaleBody({
          number: draft.documentNumber,
          clientName,
          daysStale,
        }),
        actionPath: "/documents",
        metadataJson: {
          documentNumber: draft.documentNumber,
          clientName,
          daysStale,
        },
        sentAt: now,
      });
    }
  }

  if (!rows.length) {
    return { created: 0 as const };
  }

  const created = await createNotificationEventsIgnoringExisting(rows);
  return { created: created as number };
}

export async function listNotificationsForUser(input: {
  companyId: string;
  userId: string;
  limit?: number;
}) {
  const limit = Math.max(5, Math.min(50, Math.floor(input.limit || 20)));
  const [events, unreadCount] = await Promise.all([
    prisma.notificationEvent.findMany({
      where: {
        companyId: input.companyId,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        reads: {
          where: { userId: input.userId },
          select: { id: true },
        },
      },
    }),
    prisma.notificationEvent.count({
      where: {
        companyId: input.companyId,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        reads: {
          none: {
            userId: input.userId,
          },
        },
      },
    }),
  ]);

  const items: NotificationFeedItem[] = events.map((event) => ({
    id: event.id,
    type: event.notificationType,
    title: event.title || "Notification",
    body: event.body || "",
    metadata: parseMetadata(event.metadataJson),
    actionPath: event.actionPath || null,
    createdAt: event.createdAt.toISOString(),
    isRead: event.reads.length > 0,
  }));

  return {
    items,
    unreadCount,
  };
}

export async function markNotificationRead(input: { companyId: string; userId: string; notificationId: string }) {
  const event = await prisma.notificationEvent.findFirst({
    where: {
      id: input.notificationId,
      companyId: input.companyId,
      channel: NotificationChannel.IN_APP,
    },
    select: { id: true },
  });
  if (!event) {
    return { ok: false as const, error: "Notification not found." };
  }

  await prisma.notificationRead.upsert({
    where: {
      notificationEventId_userId: {
        notificationEventId: event.id,
        userId: input.userId,
      },
    },
    create: {
      notificationEventId: event.id,
      userId: input.userId,
    },
    update: {
      readAt: new Date(),
    },
  });

  return { ok: true as const };
}

export async function markAllNotificationsRead(input: { companyId: string; userId: string }) {
  const unread = await prisma.notificationEvent.findMany({
    where: {
      companyId: input.companyId,
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      reads: {
        none: {
          userId: input.userId,
        },
      },
    },
    select: { id: true },
  });

  if (!unread.length) {
    return { ok: true as const, count: 0 };
  }

  const now = new Date();
  await prisma.$transaction(
    unread.map((event) =>
      prisma.notificationRead.upsert({
        where: {
          notificationEventId_userId: {
            notificationEventId: event.id,
            userId: input.userId,
          },
        },
        create: {
          notificationEventId: event.id,
          userId: input.userId,
          readAt: now,
        },
        update: {
          readAt: now,
        },
      }),
    ),
  );

  return { ok: true as const, count: unread.length };
}

export async function notifyDocumentStatusChange(input: {
  companyId: string;
  documentId: string;
  documentNumber: string;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus;
}) {
  const config = await getCompanyNotificationConfig(input.companyId);
  if (!config.enabled || !config.inAppEnabled || !config.notifyStatusChanges) {
    return;
  }

  if (input.fromStatus === input.toStatus) {
    return;
  }

  await prisma.notificationEvent.create({
    data: {
      companyId: input.companyId,
      documentId: input.documentId,
      notificationType: NotificationType.STATUS_CHANGED,
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      title: "Document status changed",
      body: `${input.documentNumber}: ${input.fromStatus || "START"} -> ${input.toStatus}`,
      actionPath: "/documents",
      metadataJson: {
        documentNumber: input.documentNumber,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
      },
      sentAt: new Date(),
    },
  }).catch(() => undefined);
}

export async function notifyEmailFailure(input: {
  companyId: string;
  documentId: string;
  documentNumber: string;
  message: string;
}) {
  const config = await getCompanyNotificationConfig(input.companyId);
  if (!config.enabled || !config.inAppEnabled || !config.notifyEmailFailures) {
    return;
  }

  await prisma.notificationEvent.create({
    data: {
      companyId: input.companyId,
      documentId: input.documentId,
      notificationType: NotificationType.EMAIL_FAILED,
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      title: "Email send failed",
      body: `${input.documentNumber}: ${toErrorText(input.message, "Email send failed.")}`,
      actionPath: "/documents",
      metadataJson: {
        documentNumber: input.documentNumber,
        message: toErrorText(input.message, "Email send failed."),
      },
      sentAt: new Date(),
    },
  }).catch(() => undefined);
}

export async function notifyExportFailure(input: {
  companyId: string;
  documentId: string;
  documentNumber: string;
  message: string;
}) {
  const config = await getCompanyNotificationConfig(input.companyId);
  if (!config.enabled || !config.inAppEnabled || !config.notifyExportFailures) {
    return;
  }

  await prisma.notificationEvent.create({
    data: {
      companyId: input.companyId,
      documentId: input.documentId,
      notificationType: NotificationType.EXPORT_FAILED,
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      title: "Export failed",
      body: `${input.documentNumber}: ${toErrorText(input.message, "Export failed.")}`,
      actionPath: "/documents",
      metadataJson: {
        documentNumber: input.documentNumber,
        message: toErrorText(input.message, "Export failed."),
      },
      sentAt: new Date(),
    },
  }).catch(() => undefined);
}

export async function notifyUsageLimitThreshold(input: {
  companyId: string;
  documentId: string;
  metric: "documents_per_month" | "exports_per_month";
  used: number;
  limit: number;
  periodStart: Date;
  periodEnd: Date;
}) {
  if (!input.documentId || !Number.isFinite(input.limit) || input.limit < 0) {
    return;
  }

  const config = await getCompanyNotificationConfig(input.companyId);
  if (!config.enabled || !config.inAppEnabled || !config.notifyUsageLimits) {
    return;
  }

  const percent = input.limit <= 0 ? (input.used > 0 ? 100 : 0) : (input.used / input.limit) * 100;
  const activeThresholds = USAGE_ALERT_THRESHOLDS.filter((threshold) => percent >= threshold);
  if (!activeThresholds.length) {
    return;
  }

  const now = new Date();
  const metricLabel = usageMetricLabel(input.metric);
  const periodTag = input.periodStart.toISOString().slice(0, 7);
  const roundedPercent = Math.max(0, Math.min(999, Math.round(percent * 10) / 10));

  const rows: Prisma.NotificationEventCreateManyInput[] = activeThresholds.map((threshold) => ({
    companyId: input.companyId,
    documentId: input.documentId,
    notificationType: NotificationType.STATUS_CHANGED,
    channel: NotificationChannel.IN_APP,
    status: NotificationStatus.SENT,
    eventKey: `usage:${input.metric}:${periodTag}:${threshold}`,
    title: threshold >= 100 ? "Usage limit reached" : "Usage warning",
    body:
      threshold >= 100
        ? `${metricLabel} monthly limit reached (${input.used}/${input.limit}).`
        : `${metricLabel} monthly usage reached ${roundedPercent}% (${input.used}/${input.limit}).`,
    actionPath: "/settings?tab=billing",
    metadataJson: {
      notificationKind: "USAGE_LIMIT",
      metric: input.metric,
      threshold,
      used: input.used,
      limit: input.limit,
      percent: roundedPercent,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
    },
    sentAt: now,
  }));

  await createNotificationEventsIgnoringExisting(rows).catch(() => undefined);
}
