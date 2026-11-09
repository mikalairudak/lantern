/**
 * The headers every response of Lantern's carries (`docs/security.md`, S7), set in
 * `next.config.ts`. Each one is here for a reason:
 *
 * - `frame-ancestors 'none'`: no other site may frame a page of Lantern's, to dress itself in it
 *   or to steer a click; `object-src 'none'`, `base-uri 'self'` and `form-action 'self'` close
 *   plugins, a planted `<base>` and a form posting elsewhere, none of which Lantern uses.
 * - `nosniff`: a response is read as the type it says it is.
 * - `strict-origin-when-cross-origin`: the browser's default, written down, so a link out
 *   names Lantern's origin and never a day's address.
 *
 * No policy for scripts: one with nonces renders every page per request and cannot serve the
 * prerendered shells this app streams into, and one allowing inline scripts would protect
 * nothing (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). The
 * model's words reach the page only as text React escapes. HSTS is Vercel's own.
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** Every path, pages, routes and files alike. */
export const EVERY_PATH = "/:path*";
