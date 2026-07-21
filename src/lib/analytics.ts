import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env["VITE_POSTHOG_KEY"] as string | undefined;
const POSTHOG_HOST = import.meta.env["VITE_POSTHOG_HOST"] as string | undefined;

export function initAnalytics() {
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || "https://us.i.posthog.com",
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: { maskTextSelector: ".ph-no-capture" },
  });
}

export function identifyUser(user: { id: string; email?: string; plan?: string }) {
  if (!POSTHOG_KEY) return;
  posthog.identify(user.id, { email: user.email, plan: user.plan });
}

export function resetUser() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

// Convenience wrappers for common events
export function trackVideoGenerated(seriesId: string, method: "kling" | "client") {
  trackEvent("video_generated", { series_id: seriesId, method });
}

export function trackImageGenerated(seriesId?: string) {
  trackEvent("image_generated", { series_id: seriesId });
}

export function trackSeriesCreated(niche: string) {
  trackEvent("series_created", { niche });
}

export function trackConnectionAdded(platform: string) {
  trackEvent("connection_added", { platform });
}

export function trackPaymentInitiated(plan: string, method: string) {
  trackEvent("payment_initiated", { plan, method });
}

export function trackPaymentCompleted(plan: string, amount: number) {
  trackEvent("payment_completed", { plan, amount });
}
