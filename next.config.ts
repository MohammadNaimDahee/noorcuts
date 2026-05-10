import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/cli",
    "@remotion/studio",
    "esbuild",
    "better-sqlite3",
  ],
};

export default nextConfig;
