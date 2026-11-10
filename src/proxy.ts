import { NextResponse, type NextRequest } from "next/server";
import {
  NOT_A_PAGE_PATH,
  STUDIO_HEADERS,
  STUDIO_LOCKED_HTML,
  STUDIO_REALM,
  StudioLock,
  isEscapedStudioPath,
  isStudioPath,
  studioVerdictOf,
} from "@/lib/http/studio-gate";

const HTTP_UNAUTHORIZED = 401;

/** This instance's view of the studio's login, which logs once if the environment sets none. */
const STUDIO_LOCK = new StudioLock();

/**
 * Asks every request for the studio, `/studio` and the lab, for the owner's password before
 * anything of it is served (`src/lib/http/studio-gate.ts`). It runs before Vercel's cache, so a
 * prerendered page of the lab is served from the cache only past it; the matcher takes every
 * path that starts with either name, the files the build writes beside a page included. A path
 * that names the studio only with its escapes read, as `/%6Cab`, is answered as one that is not
 * there, with the site's not-found page and a 404: the studio's pages stream, so their own lock
 * could answer it only with a 200.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (!isStudioPath(pathname)) {
    if (!isEscapedStudioPath(pathname)) return NextResponse.next();
    return NextResponse.rewrite(new URL(NOT_A_PAGE_PATH, request.url), {
      headers: STUDIO_HEADERS,
    });
  }
  const verdict = studioVerdictOf(
    request.headers.get("authorization"),
    STUDIO_LOCK.settingsOf(process.env, process.env.NODE_ENV === "development"),
  );
  if (verdict === "open") return NextResponse.next({ headers: STUDIO_HEADERS });
  return new NextResponse(STUDIO_LOCKED_HTML, {
    status: HTTP_UNAUTHORIZED,
    headers: {
      ...STUDIO_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "WWW-Authenticate": `Basic realm="${STUDIO_REALM}", charset="UTF-8"`,
    },
  });
}

export const config = {
  // Every path that starts with either name, and every path with an escape in its first
  // segment, where an escaped name of the studio can stand; the proxy itself tells the
  // studio's from the rest.
  matcher: ["/(lab|studio)(.*)", "/([^/]*%.*)"],
};
