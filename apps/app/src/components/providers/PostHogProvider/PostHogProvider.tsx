"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useState } from "react";

/**
 * Initializes PostHog analytics and wraps children with the PostHog context.
 * Enables: Product Analytics, Session Replay, Web Analytics.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key || !host) {
      console.warn("[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_HOST");
      return;
    }

    posthog.init(key, {
      api_host: host,

      /* ── Product Analytics ── */
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,

      /* ── Session Replay ── */
      session_recording: {
        maskAllInputs: true,
        maskTextContent: false,
      },

      /* ── Performance ── */
      persistence: "localStorage",
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug();
        }
        setIsReady(true);
      },
    });

    setIsReady(true);
  }, []);

  if (!isReady) return <>{children}</>;

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
