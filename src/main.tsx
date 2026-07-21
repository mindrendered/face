import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  tracesSampleRate: import.meta.env.MODE === "production" ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    // Ignore common non-actionable errors
    const msg = event.exception?.values?.[0]?.value ?? "";
    if (
      msg.includes("ResizeObserver") ||
      msg.includes("Non-Error promise rejection") ||
      msg.includes("NetworkError") ||
      msg.includes("Failed to fetch") ||
      msg.includes("Load failed")
    ) {
      return null;
    }
    return event;
  },
});

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={<p>An application error occurred; please refresh the page and try again.</p>}
    onError={(error) => {
      console.error("Caught by ErrorBoundary:", error);
    }}
  >
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);
