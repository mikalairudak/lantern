// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { EVERY_PATH, SECURITY_HEADERS } from "./security-headers";

describe("the headers every response carries", () => {
  it("are set for every path in the app's config, and only the index's pictures add one", async () => {
    expect(await nextConfig.headers?.()).toEqual([
      { source: EVERY_PATH, headers: SECURITY_HEADERS },
      // Named by a hash of their bytes, so each is kept forever (`index-pictures.ts`).
      {
        source: "/pictures/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ]);
  });

  it("let no site frame Lantern, and say nothing about scripts", () => {
    const policy = SECURITY_HEADERS.find(({ key }) => key === "Content-Security-Policy");

    expect(policy?.value).toContain("frame-ancestors 'none'");
    expect(policy?.value).not.toMatch(/script-src|default-src/);
  });
});
