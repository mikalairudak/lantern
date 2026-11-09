// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { EVERY_PATH, SECURITY_HEADERS } from "./security-headers";

describe("the headers every response carries", () => {
  it("are set for every path in the app's config", async () => {
    expect(await nextConfig.headers?.()).toEqual([
      { source: EVERY_PATH, headers: SECURITY_HEADERS },
    ]);
  });

  it("let no site frame Lantern, and say nothing about scripts", () => {
    const policy = SECURITY_HEADERS.find(({ key }) => key === "Content-Security-Policy");

    expect(policy?.value).toContain("frame-ancestors 'none'");
    expect(policy?.value).not.toMatch(/script-src|default-src/);
  });
});
