import { NextResponse, type NextRequest } from "next/server";
import {
  STUDIO_HEADERS,
  STUDIO_LOCKED_HTML,
  STUDIO_REALM,
  StudioLock,
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
 * path that starts with either name, the files the build writes beside a page included, and
 * no other, so the public site never waits on it or counts an invocation for it.
 */
export function proxy(request: NextRequest): NextResponse {
  if (!isStudioPath(request.nextUrl.pathname)) return NextResponse.next();
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
  // Every path that starts with either name; the proxy itself tells the studio's from the rest.
  matcher: ["/(lab|studio)(.*)"],
};
