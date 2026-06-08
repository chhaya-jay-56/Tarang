import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deploys to Vercel (Project: tarang-home)
  outputFileTracingRoot: __dirname,
};

export default withSentryConfig(nextConfig, {
  org: "tarang-00",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
});
