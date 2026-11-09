/**
 * Only Lantern's own pages may post to a route that counts, keeps or spends
 * (`docs/security.md`, S2). A page elsewhere can make each of its visitors' browsers send a
 * simple POST, whose `text/plain` body needs no preflight, from each visitor's own address:
 * past every per-address limit, and never reading the answer, so the browser's cross-origin
 * rules do not stop it.
 */

const HTTP_FORBIDDEN = 403;

/** The one `Sec-Fetch-Site` a page's own request carries. */
const SAME_ORIGIN = "same-origin";

/** The host an origin names, as `Host` writes it; null for `"null"` or anything not a URL. */
function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Every name the request's own host goes by: the `Host` header, a proxy's
 * `X-Forwarded-Host`, and the URL the server built. A page's browser cannot set the last two
 * on another site's behalf without a preflight, which Lantern never answers.
 */
function ownHostsOf(request: Request): Set<string> {
  const forwarded = (request.headers.get("x-forwarded-host") ?? "").split(",");
  const hosts = [request.headers.get("host") ?? "", ...forwarded, new URL(request.url).host];
  return new Set(hosts.map((host) => host.trim().toLowerCase()).filter((host) => host !== ""));
}

/**
 * Whether a browser says another site sent this request. `Sec-Fetch-Site` decides when the
 * browser sends it, as every current one does to an HTTPS address: only `same-origin`
 * passes. A browser that does not, an older one or a page over plain HTTP such as
 * `pnpm dev:lan` on a phone, still sends `Origin` with a POST, which must name the host the
 * request came to. A request with neither, as from curl, is no browser acting for another
 * site: it is held to its address's limits like any other.
 */
export function isFromAnotherSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site !== SAME_ORIGIN;
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  const host = hostOf(origin);
  return host === null || !ownHostsOf(request).has(host);
}

/**
 * The answer to another site's request: a 403 with nothing in it, before anything is read,
 * counted or kept. Every reader of Lantern's routes takes it as `unavailable`.
 */
export function fromAnotherSite(): Response {
  return new Response(null, { status: HTTP_FORBIDDEN });
}
