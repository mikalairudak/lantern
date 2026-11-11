/**
 * The e2e run's servers, for the config and its warm-up alike: the site with the flag off, and the
 * first impression's own (`docs/harness.md`, "Test harness: the first impression's own server").
 */

export const PORT = Number(process.env.E2E_PORT ?? 3417);
/** Its own build directory lets e2e run while `pnpm dev` is up (see next.config.ts). */
export const DIST_DIR = ".next-e2e";
export const BASE_URL = `http://localhost:${PORT}`;
/**
 * The first impression's own server, with its flag on (`src/lib/first-impression.ts`), which a
 * page takes at its render: its specs in `e2e/first-impression/` run against it, and every other
 * spec keeps testing the site with the flag off.
 */
export const FIRST_IMPRESSION_PORT = Number(process.env.E2E_FIRST_IMPRESSION_PORT ?? PORT + 1);
export const FIRST_IMPRESSION_DIST_DIR = ".next-e2e-fi";
export const FIRST_IMPRESSION_URL = `http://localhost:${FIRST_IMPRESSION_PORT}`;
export const FIRST_IMPRESSION_SPECS = "**/first-impression/**";
/** The first impression's projects share this start of their names. */
const FIRST_IMPRESSION_PROJECT = "first-impression";

/**
 * Whether a run takes the first impression's projects, read from Playwright's own arguments: a run
 * that names no project takes them all; one that names projects takes them if one is theirs.
 */
export function isFirstImpressionRun(argv: readonly string[]): boolean {
  const named = argv.flatMap((arg, at) => {
    if (arg.startsWith("--project=")) return [arg.slice("--project=".length)];
    if (arg === "--project" && argv[at + 1]) return [argv[at + 1]!];
    return [];
  });
  return named.length === 0 || named.some((name) => name.startsWith(FIRST_IMPRESSION_PROJECT));
}
