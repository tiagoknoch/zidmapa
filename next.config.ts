import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "tiagoknoch",
  project: "zidmapa",
  // Uploads source maps on production builds so stack traces are readable.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Send browser events through our own domain so ad blockers don't drop them.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
