import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: false,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
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

const isDev = process.env.NODE_ENV === "development";

export default isDev 
  ? nextConfig 
  : withSentryConfig(nextConfig, {
      org: "tarang-00",
      project: "javascript-nextjs",
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    });
