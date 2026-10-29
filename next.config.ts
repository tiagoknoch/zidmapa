import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Thumbnails of report photos, resized and cached by the image optimizer so
  // Supabase only serves each original once per size.
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/**`)]
      : [],
    qualities: [75],
    // Photo paths are never reused, so cached thumbnails never go stale.
    minimumCacheTTL: 2678400, // 31 days
  },
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
