// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOT_A_PAGE_PATH } from "@/lib/http/studio-gate";
import { config, proxy } from "./proxy";

const ORIGIN = "https://lantern.test";
const PASSWORD = "the owner's own, in the test";
const HTTP_UNAUTHORIZED = 401;

function requestFor(path: string, password?: string): NextRequest {
  const headers = new Headers();
  if (password !== undefined) {
    headers.set("authorization", `Basic ${Buffer.from(`owner:${password}`).toString("base64")}`);
  }
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

/** Where the proxy sent the request, or null when it let it through as it came. */
function rewrittenTo(response: Response): string | null {
  const rewrite = response.headers.get("x-middleware-rewrite");
  return rewrite === null ? null : new URL(rewrite).pathname;
}

describe("the proxy's matcher", () => {
  it("takes the studio's paths, and every path with an escape in its first segment", () => {
    for (const path of ["/lab", "/studio", "/lab.rsc", "/lab%2Fstream", "/%6Cab", "/l%61b/x"]) {
      expect(unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` }), path).toBe(true);
    }
  });

  it("takes no address of the public site", () => {
    for (const path of [
      "/",
      "/day/porto",
      "/day/%6Cab",
      "/privacy",
      "/api/day",
      "/_next/static/x",
    ]) {
      expect(unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` }), path).toBe(false);
    }
  });
});

describe("the proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends a name of the studio written with escapes to the not-found page, password or none", () => {
    vi.stubEnv("STUDIO_PASSWORD", PASSWORD);
    for (const path of [
      "/%6Cab",
      "/%6cab/stream",
      "/l%61b",
      "/%73tudio",
      "/%6Cab/matrix/%E0%A4%A",
      "/%6Cab/concepts/invitation/%ZZ",
    ]) {
      for (const response of [proxy(requestFor(path)), proxy(requestFor(path, PASSWORD))]) {
        expect(rewrittenTo(response), path).toBe(NOT_A_PAGE_PATH);
        expect(response.headers.get("cache-control"), path).toBe("private, no-store");
        expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
      }
    }
  });

  it("still asks for the password at the studio's own address, and opens to it", () => {
    vi.stubEnv("STUDIO_PASSWORD", PASSWORD);
    for (const path of ["/lab", "/studio", "/lab/stream", "/lab.rsc"]) {
      expect(proxy(requestFor(path)).status, path).toBe(HTTP_UNAUTHORIZED);
      const open = proxy(requestFor(path, PASSWORD));
      expect(open.headers.get("x-middleware-next"), path).toBe("1");
      expect(rewrittenTo(open), path).toBeNull();
    }
  });

  it("lets any other path through as it came, an escaped one included", () => {
    for (const path of ["/", "/labs", "/day/porto", "/day/%6Cab", "/100%25", "/%E0%A4%A"]) {
      const response = proxy(requestFor(path));
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
      expect(rewrittenTo(response), path).toBeNull();
    }
  });
});
