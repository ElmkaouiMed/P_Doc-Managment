"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { trackFunnelEventClient } from "@/features/analytics/lib/funnel-events-client";
import { UiButton } from "@/components/ui/ui-button";

type PageEducationBannerProps = {
  title: string;
  description: string;
  videoLabel: string;
  videoHref: string;
  helpLabel: string;
  supportTitle: string;
  supportDescription: string;
  supportCallLabel: string;
  supportCloseLabel: string;
  checklist: string[];
  sourceSection: string;
};

const SHOW_LEARNING_BANNERS = false;

export function PageEducationBanner({
  title,
  description,
  videoLabel,
  videoHref,
  helpLabel,
  supportTitle,
  supportDescription,
  supportCallLabel,
  supportCloseLabel,
  checklist,
  sourceSection,
}: PageEducationBannerProps) {
  const viewTrackedRef = useRef(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const supportNumbers = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_SUPPORT_PHONES || "+212 6 00 00 00 00,+212 5 00 00 00 00";
    const parsed = raw
      .split(/[,\n;|]/g)
      .map((item) => item.trim())
      .filter(Boolean);
    return parsed.length ? parsed : ["+212 6 00 00 00 00", "+212 5 00 00 00 00"];
  }, []);

  useEffect(() => {
    if (!SHOW_LEARNING_BANNERS || viewTrackedRef.current) {
      return;
    }
    viewTrackedRef.current = true;
    trackFunnelEventClient({
      eventName: "education_banner_view",
      sourceSection,
      metadata: { sourceSection },
    });
  }, [sourceSection]);

  useEffect(() => {
    if (!supportModalOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSupportModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [supportModalOpen]);

  if (!SHOW_LEARNING_BANNERS) {
    // Temporary: keep learning banners hidden until tutorial videos are ready.
    return null;
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card/70 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
            <p className="max-w-3xl text-xs text-muted-foreground sm:text-sm">{description}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={videoHref}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  trackFunnelEventClient({
                    eventName: "education_video_click",
                    sourceSection,
                    metadata: { sourceSection, videoHref },
                  })
                }
                className="inline-flex h-8 items-center rounded-full border border-primary/40 bg-primary/12 px-3 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
              >
                {videoLabel}
              </a>
              <button
                type="button"
                onClick={() => {
                  trackFunnelEventClient({
                    eventName: "education_help_click",
                    sourceSection,
                    metadata: { sourceSection },
                  });
                  setSupportModalOpen(true);
                }}
                className="inline-flex h-8 items-center rounded-full border border-border bg-background/55 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/35 hover:text-foreground"
              >
                {helpLabel}
              </button>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-2">
            {checklist.map((item) => (
              <p key={item} className="rounded-lg border border-border/75 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground sm:text-xs">
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      {supportModalOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setSupportModalOpen(false)}
            aria-label={supportCloseLabel}
          />
          <div className="relative z-[131] w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-[0_24px_70px_-42px_rgba(16,185,129,0.65)] sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{supportTitle}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{supportDescription}</p>
              </div>
              <UiButton
                type="button"
                size="xs"
                iconOnly
                iconName="close"
                label={supportCloseLabel}
                onClick={() => setSupportModalOpen(false)}
              />
            </div>
            <div className="space-y-2">
              {supportNumbers.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/45 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <span>{phone}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-primary">{supportCallLabel}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
