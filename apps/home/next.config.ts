import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Deploys to Vercel (Project: tarang-home)
  // Required for monorepo: tells Next.js where the workspace root is
  // so Vercel packages serverless functions correctly
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: "/(.*)",
        headers: [
          {
            key: "Content-Signal",
            value: "ai-train=yes, search=yes, ai-input=yes",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "tarang-00",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
