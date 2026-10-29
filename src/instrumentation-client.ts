import * as Sentry from "@sentry/nextjs";

// Error monitoring in the browser. Disabled when NEXT_PUBLIC_SENTRY_DSN isn't set.
// No dataCollection/sendDefaultPii: reporting is anonymous, so no IPs or user data.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
