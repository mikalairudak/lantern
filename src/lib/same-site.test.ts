// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAnotherSite, isFromAnotherSite } from "./same-site";

const PRODUCTION = "https://www.lanternday.com/api/day";

function post(url: string, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers, body: "{}" });
}

describe("isFromAnotherSite", () => {
  it("passes a page's own request, as every current browser marks it", () => {
    expect(isFromAnotherSite(post(PRODUCTION, { "sec-fetch-site": "same-origin" }))).toBe(false);
  });

  it.each(["cross-site", "same-site", "none"])("refuses one a browser marks %s", (site) => {
    expect(isFromAnotherSite(post(PRODUCTION, { "sec-fetch-site": site }))).toBe(true);
  });

  it("trusts the browser's mark over an Origin that names the host", () => {
    const request = post(PRODUCTION, {
      "sec-fetch-site": "cross-site",
      origin: "https://www.lanternday.com",
    });

    expect(isFromAnotherSite(request)).toBe(true);
  });

  it("passes a phone's page over plain HTTP on the local network, which sends Origin alone", () => {
    const request = post("http://localhost:3000/api/intake", {
      host: "192.168.1.20:3000",
      origin: "http://192.168.1.20:3000",
    });

    expect(isFromAnotherSite(request)).toBe(false);
  });

  it("passes an Origin that names the host a proxy forwarded, or the URL's own", () => {
    const forwarded = post("http://10.0.0.5/api/day", {
      host: "10.0.0.5",
      "x-forwarded-host": "lantern-git-branch.vercel.app",
      origin: "https://lantern-git-branch.vercel.app",
    });
    const own = post("https://lantern-git-branch.vercel.app/api/day", {
      origin: "https://LANTERN-git-branch.vercel.app",
    });

    expect(isFromAnotherSite(forwarded)).toBe(false);
    expect(isFromAnotherSite(own)).toBe(false);
  });

  it.each([
    ["another site", "https://example.com"],
    ["another port of the same host", "https://www.lanternday.com:8443"],
    ["an opaque origin", "null"],
    ["text that is not an origin", "lanternday"],
  ])("refuses an Origin from %s, with no browser's mark", (_, origin) => {
    expect(isFromAnotherSite(post(PRODUCTION, { origin }))).toBe(true);
  });

  it("holds a request with neither header, as from curl, to its address's limits instead", () => {
    expect(isFromAnotherSite(post(PRODUCTION, {}))).toBe(false);
  });
});

describe("fromAnotherSite", () => {
  it("answers a 403 with nothing in it", async () => {
    const response = fromAnotherSite();

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("");
  });
});
