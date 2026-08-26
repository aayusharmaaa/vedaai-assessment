/**
 * Type-check and build into a throwaway directory.
 *
 * `next build` writes to the same .next/ that `next dev` is serving from, which
 * corrupts a running dev server's webpack chunks. This builds into .next-check
 * instead, so verification is safe to run while the dev server is up.
 *
 * Run: npm run build:check
 */

import { spawnSync } from "node:child_process";

const result = spawnSync("next", ["build"], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
  env: { ...process.env, NEXT_DIST_DIR: ".next-check" },
});

process.exit(result.status ?? 1);
