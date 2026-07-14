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
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' data: https:; connect-src 'self' https: wss:; media-src 'self' data: https: blob:; frame-src 'self' https:;"
          }
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
