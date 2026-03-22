import { randomUUID } from "crypto";
import { appendFile, mkdir } from "fs/promises";
import path from "path";

import type { FunnelEventName } from "@/features/analytics/lib/funnel-event-names";
import { isDesktopMode } from "@/lib/runtime";
import { getStorageRoot } from "@/lib/storage";

const STORAGE_ROOT = getStorageRoot();
const ANALYTICS_ROOT = path.resolve(STORAGE_ROOT, "marketing");

type FunnelEventMetadata = Record<string, unknown>;

type TrackFunnelEventInput = {
  eventName: FunnelEventName;
  sourcePath?: string | null;
  sourceSection?: string | null;
  locale?: string | null;
  sessionId?: string | null;
  companyId?: string | null;
  userId?: string | null;
  ipHint?: string | null;
  userAgent?: string | null;
  metadata?: FunnelEventMetadata | null;
  clientTimestamp?: string | null;
};

type FunnelEventRecord = {
  eventId: string;
  eventName: FunnelEventName;
  occurredAt: string;
  receivedAt: string;
  sourcePath: string | null;
  sourceSection: string | null;
  locale: string | null;
  sessionId: string | null;
  companyId: string | null;
  userId: string | null;
  ipHint: string | null;
  userAgent: string | null;
  metadata: FunnelEventMetadata | null;
};

function cleanText(value: string | null | undefined, maxLength: number) {
  const normalized = (value || "").trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function sanitizeMetadataValue(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return "[depth-limited]";
  }
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 2000);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeMetadataValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 40)) {
      output[key.slice(0, 64)] = sanitizeMetadataValue(item, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, 2000);
}

function sanitizeMetadata(input: FunnelEventMetadata | null | undefined) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input).slice(0, 40)) {
    sanitized[key.slice(0, 64)] = sanitizeMetadataValue(value);
  }
  return sanitized;
}

export async function trackFunnelEventServer(input: TrackFunnelEventInput) {
  if (isDesktopMode()) {
    return { ok: true as const, eventId: "desktop-disabled" };
  }

  const now = new Date();
  const receivedAt = now.toISOString();
  const monthStamp = receivedAt.slice(0, 7);

  const record: FunnelEventRecord = {
    eventId: randomUUID(),
    eventName: input.eventName,
    occurredAt: cleanText(input.clientTimestamp, 64) || receivedAt,
    receivedAt,
    sourcePath: cleanText(input.sourcePath, 160),
    sourceSection: cleanText(input.sourceSection, 80),
    locale: cleanText(input.locale, 12),
    sessionId: cleanText(input.sessionId, 80),
    companyId: cleanText(input.companyId, 40),
    userId: cleanText(input.userId, 40),
    ipHint: cleanText(input.ipHint, 64),
    userAgent: cleanText(input.userAgent, 260),
    metadata: sanitizeMetadata(input.metadata),
  };

  await mkdir(ANALYTICS_ROOT, { recursive: true });
  const filePath = path.join(ANALYTICS_ROOT, `funnel-events-${monthStamp}.ndjson`);
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");

  return { ok: true as const, eventId: record.eventId };
}
