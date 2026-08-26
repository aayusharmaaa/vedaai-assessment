import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the trace root; a stray lockfile in a parent directory otherwise makes
  // Next guess the workspace root wrongly.
  outputFileTracingRoot: path.join(__dirname),
  // Lets `npm run build:check` build into a throwaway directory so it never
  // clobbers the .next/ a running `next dev` is serving from.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
