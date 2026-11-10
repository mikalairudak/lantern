import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The studio: the part of Lantern that explains it, the case study, the lab and its benches, which
 * only the owner opens (`docs/decisions.md`, "The studio opens to the owner's password, asked by
 * the browser"). The public site is the product alone. `src/proxy.ts` asks every request for it for
 * a password, by HTTP Basic authentication over HTTPS: it sets no cookie, so the privacy page's
 * "sets no cookies" stays true, and a crawler gets a 401 with nothing to index (`docs/security.md`,
 * S14).
 *
 * The password guards how the product is presented, not a secret: the lab's code is in its
 * script files, public by their names, and in the repository once it opens.
 */

/** The studio's own page, which lists what it holds. */
export const STUDIO_PATH = "/studio";

/** The lab's benches, which the studio holds. */
export const LAB_PATH = "/lab";

/**
 * Every path the studio holds: its page and the lab's, and every file beside one, as the
 * build writes `/lab.rsc` or `/lab/matrix.segments/...` next to a prerendered page. Matched by
 * its start, so no suffix gets past it; `/labs` is another path, and a 404.
 */
const HELD = /^\/(?:lab|studio)(?:$|[/.?#;])/;

/** Whether the studio holds this path, as the request names it. */
export function isStudioPath(pathname: string): boolean {
  return HELD.test(pathname);
}

/** The path with its escapes read, as `/%6Cab` reads `/lab`, or null when one is malformed. */
function readEscapesOf(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

/**
 * Whether a path names the studio only once its escapes are read, as `/%6Cab` or `/%73tudio`.
 * Vercel matches the proxy against the path as written and finds the page by the path read, so
 * such a path reaches a page of the studio past the proxy; there the page's own lock can answer
 * only after the response has begun, with a 200 (`docs/security.md`, S14). The studio is at its
 * plain address alone, so the proxy answers such a path as one that is not there.
 */
export function isEscapedStudioPath(pathname: string): boolean {
  if (isStudioPath(pathname)) return false;
  const read = readEscapesOf(pathname);
  return read !== null && isStudioPath(read);
}

/**
 * Where the proxy sends an escaped path of the studio: a folder named with an underscore is
 * never a route, so the site answers it with its not-found page and a 404.
 */
export const NOT_A_PAGE_PATH = "/_not-a-page";

/** The variable the studio's password is set by, in Vercel's environment and `.env.local`. */
export const STUDIO_PASSWORD_VARIABLE = "STUDIO_PASSWORD";

/**
 * The login the studio opens to: the SHA-256 of the password, in hex, worked out from the
 * variable. No user name: one is not a secret, so it would add nothing but a second thing to set
 * and to get wrong. The browser still asks for one, and any will do.
 */
export interface StudioLogin {
  passwordSha256: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

/** The password as the variable holds it, as it is: a space in it is part of it. */
function passwordOf(env: Environment): string {
  return env[STUDIO_PASSWORD_VARIABLE] ?? "";
}

/**
 * The studio's login as the environment sets it, or null when it sets none or an empty one. The
 * environment is the only place a password comes from: the code holds none, so the public
 * repository gives none away (`docs/security.md`, S14). It is held as its SHA-256, so the check
 * compares two digests of one length.
 */
export function studioLoginOf(env: Environment): StudioLogin | null {
  const password = passwordOf(env);
  return password === "" ? null : { passwordSha256: sha256(password).toString("hex") };
}

/**
 * Why the environment gives the studio no login, by the variable's name alone: its value, or
 * anything worked out from it, never reaches the log. Null when it gives one.
 */
export function studioLoginProblemOf(env: Environment): string | null {
  return passwordOf(env) === "" ? `${STUDIO_PASSWORD_VARIABLE} is not set` : null;
}

function sha256(text: string): Buffer {
  return createHash("sha256").update(text, "utf8").digest();
}

/**
 * The password a Basic `Authorization` header gives, whatever user it names, an empty one
 * included, or null for any other header.
 */
function basicPasswordOf(header: string | null): string | null {
  const match = header === null ? null : /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header.trim());
  if (!match?.[1]) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  return colon === -1 ? null : decoded.slice(colon + 1);
}

/**
 * Whether the header gives the studio's password, under any user name. The SHA-256 of what was
 * typed is compared with the SHA-256 of the variable, one length whatever either holds, in
 * constant time, so how long the answer takes says nothing of the password's length or of how
 * much of it was right.
 */
export function isStudioLogin(header: string | null, login: StudioLogin): boolean {
  const password = basicPasswordOf(header);
  if (password === null) return false;
  return timingSafeEqual(sha256(password), Buffer.from(login.passwordSha256, "hex"));
}

/** What the studio does with a request: lets it in, or asks for the password. */
export type StudioVerdict = "open" | "ask";

/** What the studio's lock reads from a process's environment. */
export interface StudioSettings {
  login: StudioLogin | null;
  isDevelopment: boolean;
}

/**
 * Lets a request into the studio when it gives the password the environment sets. With none
 * set, or an empty one, a production build, on Vercel, a preview or `pnpm build:check`, is shut
 * to everyone, whatever the request gives: a deploy that missed its variable keeps the studio
 * shut rather than open, and says why in its log (`StudioLock`). `next dev` with none set stays
 * open, as the lab always was there, so the benches work on a laptop without a password; given
 * one, it asks for it too, which is how the e2e run proves the lock.
 */
export function studioVerdictOf(
  header: string | null,
  { login, isDevelopment }: StudioSettings,
): StudioVerdict {
  if (login === null) return isDevelopment ? "open" : "ask";
  return isStudioLogin(header, login) ? "open" : "ask";
}

/** Where a line of the server's log goes: one JSON object per event, as the API routes write. */
export type StudioLog = (event: string, fields: Record<string, string>) => void;

/** Vercel keeps a function's stderr in its logs; `console.error` is the one call lint allows. */
const logToStderr: StudioLog = (event, fields) => {
  console.error(JSON.stringify({ event, ...fields }));
};

/**
 * Says once per process why a build that is not `next dev` keeps the studio shut: one line,
 * `studio-closed` and the variable's name, however many requests are refused, so a flood of
 * the lab's 401s writes no more. The proxy and the pages are bundled apart, so each instance of
 * either writes its own line.
 */
export class StudioLock {
  private hasLogged = false;

  constructor(private readonly log: StudioLog = logToStderr) {}

  /**
   * The settings a request is judged by, logging the first time they shut the studio. The
   * caller writes `isDevelopment` as `process.env.NODE_ENV === "development"`, which the build
   * makes a constant: no variable set on a deploy can make a production build `next dev`.
   */
  settingsOf(env: Environment, isDevelopment: boolean): StudioSettings {
    const settings = { login: studioLoginOf(env), isDevelopment };
    if (settings.login === null && !isDevelopment && !this.hasLogged) {
      this.hasLogged = true;
      this.log("studio-closed", { reason: studioLoginProblemOf(env) ?? "no login" });
    }
    return settings;
  }
}

/** The realm a browser names when it asks for the studio's password. */
export const STUDIO_REALM = "Lantern studio";

/**
 * What a request without the password reads: a browser shows it once its login dialog is
 * cancelled. Plain on purpose: nothing on it but a way back.
 */
export const STUDIO_LOCKED_HTML = [
  "<!doctype html>",
  '<html lang="en">',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="robots" content="noindex, nofollow">',
  "<title>Private · Lantern</title>",
  "<p>This part of Lantern is private.</p>",
  '<p><a href="/">Plan a day with Lantern</a></p>',
  "</html>",
].join("\n");

/** Kept by no cache, read by no index: the studio's every answer, with the password or without. */
export const STUDIO_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
