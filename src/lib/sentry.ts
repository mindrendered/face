import * as Sentry from "@sentry/react";

export function setSentryUser(user: { id: string; email?: string }) {
  Sentry.setUser({ id: user.id, email: user.email });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export function tagSentryContext(key: string, value: string) {
  Sentry.setContext(key, value);
}

export function captureSentryException(error: unknown, extra?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => scope.setExtra(k, v));
    }
    Sentry.captureException(error);
  });
}
