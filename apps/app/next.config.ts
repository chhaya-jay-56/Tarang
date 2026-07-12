import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: false,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: {
    root: __dirname,
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
