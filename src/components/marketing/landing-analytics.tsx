"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { trackFunnelEventClient } from "@/features/analytics/lib/funnel-events-client";

export function LandingViewTracker() {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackFunnelEventClient({
      eventName: "landing_view",
      sourceSection: "landing",
    });
  }, []);

  return null;
}

type SignupStartLinkProps = {
  className: string;
  label: string;
  sourceSection: string;
};

export function SignupStartLink({ className, label, sourceSection }: SignupStartLinkProps) {
  return (
    <Link
      href="/login?mode=signup"
      className={className}
      onClick={() =>
        trackFunnelEventClient({
          eventName: "signup_start",
          sourceSection,
        })
      }
    >
      {label}
    </Link>
  );
}
