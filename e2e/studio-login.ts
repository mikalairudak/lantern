/**
 * The studio's login in the e2e run, given to its server by `playwright.config.ts` and with
 * every request of the run: the run's own, never production's, and no secret. The server reads
 * only the password; the user is what a browser would send, and any would do.
 */
export const E2E_STUDIO_LOGIN = { username: "e2e", password: "e2e-studio-password-not-a-secret" };

/** The login as the server's environment takes it: the password alone, no user. */
export const E2E_STUDIO_ENV = { STUDIO_PASSWORD: E2E_STUDIO_LOGIN.password };

/** The login as a browser sends it, on every request of the run. */
export const E2E_STUDIO_AUTHORIZATION = `Basic ${Buffer.from(
  `${E2E_STUDIO_LOGIN.username}:${E2E_STUDIO_LOGIN.password}`,
).toString("base64")}`;
