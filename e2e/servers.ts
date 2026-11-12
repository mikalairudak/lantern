/** The e2e run's server, for the config and its warm-up alike. */

export const PORT = Number(process.env.E2E_PORT ?? 3417);
/** Its own build directory lets e2e run while `pnpm dev` is up (see next.config.ts). */
export const DIST_DIR = ".next-e2e";
export const BASE_URL = `http://localhost:${PORT}`;
