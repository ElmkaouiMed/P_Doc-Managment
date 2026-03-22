"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { UiButton } from "@/components/ui/ui-button";
import {
  listUserNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type NotificationFeedItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  actionPath: string | null;
  createdAt: string;
  isRead: boolean;
};

function dateTimeLabel(input: string, locale: "fr" | "en" | "ar") {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    return input;
  }
  const intlLocale = locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-MA";
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function dateLabel(input: string, locale: "fr" | "en" | "ar") {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    return input;
  }
  const intlLocale = locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-MA";
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "short",
  }).format(value);
}

function isUsageLimitNotification(item: NotificationFeedItem) {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : null;
  return item.type === "STATUS_CHANGED" && toText(metadata?.notificationKind).toUpperCase() === "USAGE_LIMIT";
}

function notificationTone(item: NotificationFeedItem) {
  if (isUsageLimitNotification(item)) {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : null;
    const threshold = toInt(metadata?.threshold);
    if (threshold >= 100) {
      return "border-destructive/40";
    }
    if (threshold >= 90 || threshold >= 70) {
      return "border-amber-400/40";
    }
    return "border-primary/40";
  }

  if (item.type === "OVERDUE" || item.type === "EMAIL_FAILED" || item.type === "EXPORT_FAILED") {
    return "border-destructive/40";
  }
  if (item.type === "DUE_SOON" || item.type === "DRAFT_STALE") {
    return "border-amber-400/40";
  }
  return "border-border";
}

function notificationTitle(item: NotificationFeedItem, fallback: string, t: (key: string) => string) {
  if (isUsageLimitNotification(item)) {
    const usageTitle = t("notifications.type.usageLimit");
    return usageTitle === "notifications.type.usageLimit" ? fallback || usageTitle : usageTitle;
  }

  const keyByType: Record<string, string> = {
    DUE_SOON: "notifications.type.dueSoon",
    OVERDUE: "notifications.type.overdue",
    DRAFT_STALE: "notifications.type.draftStale",
    STATUS_CHANGED: "notifications.type.statusChanged",
    EMAIL_FAILED: "notifications.type.emailFailed",
    EXPORT_FAILED: "notifications.type.exportFailed",
  };
  const key = keyByType[item.type];
  if (!key) {
    return fallback || t("header.notifications");
  }
  const translated = t(key);
  return translated === key ? fallback || translated : translated;
}

function toText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.trunc(parsed);
}

function statusLabel(status: string, t: (key: string) => string) {
  const normalized = status.trim().toUpperCase();
  if (!normalized || normalized === "START") {
    return t("documents.details.start");
  }
  const keyMap: Record<string, string> = {
    DRAFT: "documents.status.draft",
    ISSUED: "documents.status.issued",
    SENT: "documents.status.sent",
    PAID: "documents.status.paid",
    OVERDUE: "documents.status.overdue",
    CANCELLED: "documents.status.cancelled",
  };
  const key = keyMap[normalized];
  if (!key) {
    return normalized;
  }
  return t(key);
}

function notificationBody(item: NotificationFeedItem, locale: "fr" | "en" | "ar", t: (key: string) => string) {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : null;
  if (!metadata) {
    return item.body || t("notifications.body.fallback");
  }

  if (isUsageLimitNotification(item)) {
    const metric = toText(metadata.metric).toLowerCase();
    const metricLabel =
      metric === "documents_per_month" ? t("notifications.usage.metric.documents") : t("notifications.usage.metric.exports");
    const used = String(toInt(metadata.used));
    const limit = String(toInt(metadata.limit));
    const threshold = String(toInt(metadata.threshold));
    if (toInt(metadata.threshold) >= 100) {
      return t("notifications.body.usageReached")
        .replace("{metric}", metricLabel)
        .replace("{used}", used)
        .replace("{limit}", limit);
    }
    return t("notifications.body.usageThreshold")
      .replace("{metric}", metricLabel)
      .replace("{threshold}", threshold)
      .replace("{used}", used)
      .replace("{limit}", limit);
  }

  const number = toText(metadata.documentNumber) || "-";
  const client = toText(metadata.clientName) || t("documents.clientFallback");

  if (item.type === "DUE_SOON") {
    const days = toInt(metadata.daysUntilDue);
    const dueDate = toText(metadata.dueDate);
    const dueDateLabel = dueDate ? dateLabel(dueDate, locale) : "-";
    if (days <= 0) {
      return t("notifications.body.dueToday")
        .replace("{number}", number)
        .replace("{client}", client)
        .replace("{date}", dueDateLabel);
    }
    return t("notifications.body.dueInDays")
      .replace("{number}", number)
      .replace("{client}", client)
      .replace("{days}", String(days))
      .replace("{date}", dueDateLabel);
  }

  if (item.type === "OVERDUE") {
    const dueDate = toText(metadata.dueDate);
    const dueDateLabel = dueDate ? dateLabel(dueDate, locale) : "-";
    return t("notifications.body.overdue")
      .replace("{number}", number)
      .replace("{client}", client)
      .replace("{days}", String(toInt(metadata.daysOverdue)))
      .replace("{date}", dueDateLabel);
  }

  if (item.type === "DRAFT_STALE") {
    return t("notifications.body.draftStale")
      .replace("{number}", number)
      .replace("{client}", client)
      .replace("{days}", String(toInt(metadata.daysStale)));
  }

  if (item.type === "STATUS_CHANGED") {
    const fromStatus = statusLabel(toText(metadata.fromStatus), t);
    const toStatus = statusLabel(toText(metadata.toStatus), t);
    return t("notifications.body.statusChanged")
      .replace("{number}", number)
      .replace("{from}", fromStatus)
      .replace("{to}", toStatus);
  }

  if (item.type === "EMAIL_FAILED") {
    return t("notifications.body.emailFailed")
      .replace("{number}", number)
      .replace("{message}", toText(metadata.message) || item.body || "-");
  }

  if (item.type === "EXPORT_FAILED") {
    return t("notifications.body.exportFailed")
      .replace("{number}", number)
      .replace("{message}", toText(metadata.message) || item.body || "-");
  }

  return item.body || t("notifications.body.fallback");
}

export function NotificationCenter() {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = async (showLoader: boolean) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const result = await listUserNotificationsAction({ limit: 20 });
      if (!result.ok) {
        return;
      }
      setItems((result.items || []) as NotificationFeedItem[]);
      setUnreadCount(Number(result.unreadCount || 0));
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => {
      void load(false);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const unreadItemsCount = useMemo(
    () => items.reduce((count, item) => (item.isRead ? count : count + 1), 0),
    [items],
  );

  const markAllRead = async () => {
    const result = await markAllNotificationsReadAction();
    if (!result.ok) {
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  };

  const openNotification = async (item: NotificationFeedItem) => {
    if (!item.isRead) {
      const result = await markNotificationReadAction({ notificationId: item.id });
      if (result.ok) {
        setItems((current) =>
          current.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    }

    setOpen(false);
    if (item.actionPath) {
      window.location.href = item.actionPath;
    }
  };

  return (
    <div ref={rootRef} className="relative z-50">
      <UiButton
        type="button"
        size="md"
        variant={open ? "primary" : "outline"}
        iconOnly
        iconName="notification"
        aria-label={t("header.notifications")}
        title={t("header.notifications")}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void load(true);
          }
        }}
      />
      {unreadCount > 0 ? (
        <span className="pointer-events-none z-50 absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full border border-primary/60 bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {Math.min(99, unreadCount)}
        </span>
      ) : null}

      {open ? (
        <div className="absolute top-14 rtl:left-0 ltr:right-0 z-50 w-[360px] max-w-[calc(100vw-2rem)] space-y-2 rounded-md border border-border bg-card/95 p-2 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-foreground">{t("header.notifications")}</p>
            {unreadItemsCount > 0 ? (
              <UiButton type="button" size="xs" variant="ghost" onClick={() => void markAllRead()}>
                {t("header.notificationsMarkAll")}
              </UiButton>
            ) : null}
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">{t("header.notificationsLoading")}</p>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className={cn(
                    "w-full rounded-md border bg-background/40 p-3 text-left transition hover:border-primary/40 hover:bg-background/60",
                    notificationTone(item),
                    item.isRead ? "opacity-70" : "",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={item.isRead ? "text-xs font-semibold text-muted-foreground" : "text-xs font-semibold text-foreground"}>
                      {notificationTitle(item, item.title, t)}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {dateTimeLabel(item.createdAt, locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{notificationBody(item, locale, t)}</p>
                </button>
              ))
            ) : (
              <p className="rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">{t("header.notificationsEmpty")}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
