import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workspace root, not this app's folder: Next must trace files from the
  // monorepo root so packages/core is included in the serverless bundle.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // @veda/core ships TypeScript source rather than a build artefact, so Next
  // compiles it alongside the app. That keeps the package build-step free.
  transpilePackages: ["@veda/core"],
  // Lets `npm run build:check` build into a throwaway directory so it never
  // clobbers the .next/ a running `next dev` is serving from.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
