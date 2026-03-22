"use client";

import type { FunnelEventName } from "@/features/analytics/lib/funnel-event-names";

const SESSION_STORAGE_KEY = "docv1_funnel_session_id";

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getClientSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const next = generateSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return generateSessionId();
  }
}

type TrackFunnelEventClientInput = {
  eventName: FunnelEventName;
  sourceSection?: string;
  sourcePath?: string;
  metadata?: Record<string, unknown>;
};

export function trackFunnelEventClient(input: TrackFunnelEventClientInput) {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_DESKTOP_MODE === "1") {
    return;
  }

  const payload = {
    eventName: input.eventName,
    sourcePath: input.sourcePath || window.location.pathname,
    sourceSection: input.sourceSection || null,
    locale: document.documentElement.lang || null,
    sessionId: getClientSessionId(),
    metadata: input.metadata || null,
    occurredAt: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  const url = "/api/marketing/funnel-event";

  // sendBeacon keeps tracking reliable when navigation happens right after click.
  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
