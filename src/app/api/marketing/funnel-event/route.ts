import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { isFunnelEventName } from "@/features/analytics/lib/funnel-event-names";
import { trackFunnelEventServer } from "@/features/analytics/lib/funnel-events-server";
import { getAuthContext } from "@/features/auth/lib/session";
import { isDesktopMode } from "@/lib/runtime";

export const runtime = "nodejs";

type FunnelEventBody = {
  eventName?: unknown;
  sourcePath?: unknown;
  sourceSection?: unknown;
  locale?: unknown;
  sessionId?: unknown;
  metadata?: unknown;
  occurredAt?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return normalized ? normalized.slice(0, maxLength) : null;
}

function readMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function POST(request: Request) {
  if (isDesktopMode()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  let body: FunnelEventBody;
  try {
    body = (await request.json()) as FunnelEventBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const eventNameRaw = cleanText(body.eventName, 64);
  if (!eventNameRaw || !isFunnelEventName(eventNameRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid event name." }, { status: 400 });
  }

  const reqHeaders = await headers();
  const forwardedFor = reqHeaders.get("x-forwarded-for") || "";
  const ipHint = cleanText(forwardedFor.split(",")[0], 64);
  const userAgent = cleanText(reqHeaders.get("user-agent"), 260);

  let authCompanyId: string | null = null;
  let authUserId: string | null = null;
  try {
    const auth = await getAuthContext();
    authCompanyId = auth?.company.id || null;
    authUserId = auth?.user.id || null;
  } catch {
    authCompanyId = null;
    authUserId = null;
  }

  try {
    const tracked = await trackFunnelEventServer({
      eventName: eventNameRaw,
      sourcePath: cleanText(body.sourcePath, 160),
      sourceSection: cleanText(body.sourceSection, 80),
      locale: cleanText(body.locale, 12),
      sessionId: cleanText(body.sessionId, 80),
      metadata: readMetadata(body.metadata),
      clientTimestamp: cleanText(body.occurredAt, 64),
      companyId: authCompanyId,
      userId: authUserId,
      ipHint,
      userAgent,
    });
    return NextResponse.json(tracked);
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to store event." }, { status: 500 });
  }
}
