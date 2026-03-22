import { readFile } from "fs/promises";
import path from "path";

import { CORE_FUNNEL_SEQUENCE, FUNNEL_EVENT_NAMES, type FunnelEventName, isFunnelEventName } from "@/features/analytics/lib/funnel-event-names";
import { isDesktopMode } from "@/lib/runtime";
import { getStorageRoot } from "@/lib/storage";

const STORAGE_ROOT = getStorageRoot();
const ANALYTICS_ROOT = path.resolve(STORAGE_ROOT, "marketing");

type StoredFunnelEvent = {
  eventName?: unknown;
  occurredAt?: unknown;
  receivedAt?: unknown;
  companyId?: unknown;
  userId?: unknown;
  sessionId?: unknown;
};

type NormalizedFunnelEvent = {
  eventName: FunnelEventName;
  eventAt: Date;
  companyId: string | null;
  userId: string | null;
  sessionId: string | null;
};

export type FunnelLeadTime = {
  samples: number;
  avgHours: number | null;
  medianHours: number | null;
  p90Hours: number | null;
};

export type FunnelDropOffStep = {
  fromEvent: FunnelEventName;
  toEvent: FunnelEventName;
  fromCount: number;
  toCount: number;
  conversionRate: number | null;
  dropOffRate: number | null;
};

export type FunnelSummary = {
  from: Date;
  to: Date;
  counts: Record<FunnelEventName, number>;
  totalEvents: number;
  leadTime: FunnelLeadTime;
  dayDropOff: FunnelDropOffStep[];
  weekDropOff: FunnelDropOffStep[];
};

function initCounts() {
  return FUNNEL_EVENT_NAMES.reduce(
    (acc, name) => {
      acc[name] = 0;
      return acc;
    },
    {} as Record<FunnelEventName, number>,
  );
}

function toMonthStamp(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function listMonthStampsBetween(from: Date, to: Date) {
  const values: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= end) {
    values.push(toMonthStamp(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return values;
}

function parseDateLike(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cleanText(value: unknown, maxLength: number) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? raw.slice(0, maxLength) : null;
}

async function readMonthEvents(monthStamp: string): Promise<StoredFunnelEvent[]> {
  const filePath = path.join(ANALYTICS_ROOT, `funnel-events-${monthStamp}.ndjson`);
  let content = "";
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as StoredFunnelEvent;
      } catch {
        return null;
      }
    })
    .filter((event): event is StoredFunnelEvent => Boolean(event));
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }
  return (numerator / denominator) * 100;
}

function buildDropOff(counts: Record<FunnelEventName, number>): FunnelDropOffStep[] {
  return CORE_FUNNEL_SEQUENCE.slice(0, -1).map((eventName, index) => {
    const nextEvent = CORE_FUNNEL_SEQUENCE[index + 1];
    const fromCount = counts[eventName] || 0;
    const toCount = counts[nextEvent] || 0;
    const conversionRate = toPercent(toCount, fromCount);
    const dropOffRate = conversionRate == null ? null : Math.max(0, 100 - conversionRate);
    return {
      fromEvent: eventName,
      toEvent: nextEvent,
      fromCount,
      toCount,
      conversionRate,
      dropOffRate,
    };
  });
}

function countEventsInRange(events: NormalizedFunnelEvent[], from: Date, to: Date) {
  const counts = initCounts();
  for (const event of events) {
    if (event.eventAt < from || event.eventAt > to) {
      continue;
    }
    counts[event.eventName] += 1;
  }
  return counts;
}

function summarizeLeadTime(events: NormalizedFunnelEvent[]): FunnelLeadTime {
  const durationsHours: number[] = [];
  const byCompany = new Map<string, NormalizedFunnelEvent[]>();

  for (const event of events) {
    if (!event.companyId) {
      continue;
    }
    const bucket = byCompany.get(event.companyId) || [];
    bucket.push(event);
    byCompany.set(event.companyId, bucket);
  }

  for (const companyEvents of byCompany.values()) {
    const sorted = [...companyEvents].sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
    const pendingSignups: Date[] = [];

    for (const event of sorted) {
      if (event.eventName === "signup_complete") {
        pendingSignups.push(event.eventAt);
        continue;
      }
      if (event.eventName !== "account_activated") {
        continue;
      }
      const signupAt = pendingSignups.shift();
      if (!signupAt) {
        continue;
      }
      const diffHours = (event.eventAt.getTime() - signupAt.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0) {
        durationsHours.push(diffHours);
      }
    }
  }

  if (!durationsHours.length) {
    return {
      samples: 0,
      avgHours: null,
      medianHours: null,
      p90Hours: null,
    };
  }

  const sorted = [...durationsHours].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mid = Math.floor(sorted.length / 2);
  const medianHours = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const p90Index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1));

  return {
    samples: sorted.length,
    avgHours: sum / sorted.length,
    medianHours,
    p90Hours: sorted[p90Index],
  };
}

export async function readFunnelSummary(days = 30): Promise<FunnelSummary> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - Math.max(1, days) + 1);
  from.setHours(0, 0, 0, 0);

  if (isDesktopMode()) {
    return {
      from,
      to,
      counts: initCounts(),
      totalEvents: 0,
      leadTime: {
        samples: 0,
        avgHours: null,
        medianHours: null,
        p90Hours: null,
      },
      dayDropOff: buildDropOff(initCounts()),
      weekDropOff: buildDropOff(initCounts()),
    };
  }

  const counts = initCounts();
  const eventsInWindow: NormalizedFunnelEvent[] = [];
  const monthStamps = listMonthStampsBetween(from, to);

  for (const monthStamp of monthStamps) {
    const events = await readMonthEvents(monthStamp);
    for (const event of events) {
      const eventNameRaw = typeof event.eventName === "string" ? event.eventName : "";
      if (!isFunnelEventName(eventNameRaw)) {
        continue;
      }

      const eventDate = parseDateLike(event.occurredAt) || parseDateLike(event.receivedAt);
      if (!eventDate) {
        continue;
      }
      if (eventDate < from || eventDate > to) {
        continue;
      }

      eventsInWindow.push({
        eventName: eventNameRaw,
        eventAt: eventDate,
        companyId: cleanText(event.companyId, 60),
        userId: cleanText(event.userId, 60),
        sessionId: cleanText(event.sessionId, 120),
      });
    }
  }

  for (const event of eventsInWindow) {
    counts[event.eventName] += 1;
  }

  const dayStart = new Date(to);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const dayCounts = countEventsInRange(eventsInWindow, dayStart, to);
  const weekCounts = countEventsInRange(eventsInWindow, weekStart, to);

  return {
    from,
    to,
    counts,
    totalEvents: eventsInWindow.length,
    leadTime: summarizeLeadTime(eventsInWindow),
    dayDropOff: buildDropOff(dayCounts),
    weekDropOff: buildDropOff(weekCounts),
  };
}
