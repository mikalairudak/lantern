import type { NextConfig } from "next";
import { notADaySource } from "./src/lib/days/not-a-day";
import { EVERY_PATH, SECURITY_HEADERS } from "./src/lib/http/security-headers";
import { NOT_A_PAGE_PATH } from "./src/lib/http/studio-gate";

const nextConfig: NextConfig = {
  // Next allows one dev server per build directory, so e2e runs use their own
  // (see playwright.config.ts) and never collide with `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Phone review over the local network (`pnpm dev:lan`) loads dev assets from a LAN
  // address, which Next blocks by default. Private home and office ranges only.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  cacheComponents: true,
  // Each written day has its own address under /day, and /day alone names none, so it sends
  // a visitor on to the start screen, where every day begins, before anything renders.
  redirects: () => [{ source: "/day", destination: "/", permanent: false }],
  // An address under /day that names no day is answered as no page at all, before the route
  // can send its shell with a 200 (`notADaySource`).
  rewrites: () => ({
    beforeFiles: [{ source: notADaySource(), destination: NOT_A_PAGE_PATH }],
    afterFiles: [],
    fallback: [],
  }),
  // Why each one, and why no policy for scripts: `src/lib/http/security-headers.ts`.
  // The index's pictures are named by a hash of their bytes, so a changed one has a new name and
  // each can be kept forever (`src/features/day/index-pictures.ts`).
  headers: () => [
    { source: EVERY_PATH, headers: [...SECURITY_HEADERS] },
    {
      source: "/pictures/:file*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ],
  partialPrefetching: true,
  experimental: {
    // Every production build compiles the stylesheet from the source as it is: builds that
    // restored an earlier cache served an earlier stylesheet (`docs/decisions.md`, "A production
    // build starts without Turbopack's cache").
    turbopackFileSystemCacheForBuild: false,
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

export default nextConfig;
