// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashVisitor, visitorKeyOf, visitorOf } from "./visitor";

const ADDRESS = "203.0.113.7";

function from(headers: Record<string, string>): Request {
  return new Request("http://lantern.test/api/day", { method: "POST", headers });
}

describe("visitorOf", () => {
  it("knows a visitor by a hash that never holds their address", async () => {
    const visitor = await visitorOf(from({ "x-real-ip": ADDRESS }), "pepper");

    expect(visitor).toMatch(/^[0-9a-f]{64}$/);
    expect(visitor).not.toContain(ADDRESS);
  });

  it("gives one address the same visitor every time, and another address another", async () => {
    const first = await visitorOf(from({ "x-real-ip": ADDRESS }), "pepper");
    const again = await visitorOf(from({ "x-real-ip": ADDRESS }), "pepper");
    const other = await visitorOf(from({ "x-real-ip": "198.51.100.4" }), "pepper");

    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });

  it("gives the same address another hash under another salt", async () => {
    expect(await hashVisitor(ADDRESS, "pepper")).not.toBe(await hashVisitor(ADDRESS, "salt"));
  });

  it("never reads a forwarded-for header a client can write itself", async () => {
    const forged = await visitorOf(from({ "x-forwarded-for": ADDRESS }), "pepper");

    expect(forged).toBe(await hashVisitor(undefined, "pepper"));
  });

  it("gives every address of one IPv6 /64 the same visitor, and another /64 another", async () => {
    const one = await hashVisitor("2001:db8:85a3:8d3::1", "pepper");
    const sameNetwork = await hashVisitor("2001:db8:85a3:8d3:ffff:ffff:ffff:ffff", "pepper");
    const nextNetwork = await hashVisitor("2001:db8:85a3:8d4::1", "pepper");

    expect(sameNetwork).toBe(one);
    expect(nextNetwork).not.toBe(one);
  });
});

describe("visitorKeyOf", () => {
  it.each([
    ["an IPv4 address, whole", "203.0.113.7", "203.0.113.7"],
    ["another IPv4 address apart", "203.0.113.8", "203.0.113.8"],
    [
      "an IPv6 address, by its /64",
      "2001:db8:85a3:8d3:1319:8a2e:370:7348",
      "2001:db8:85a3:8d3::/64",
    ],
    ["a compressed IPv6 address", "2001:db8::1", "2001:db8:0:0::/64"],
    [
      "the same address written out",
      "2001:0DB8:0000:0000:0000:0000:0000:0001",
      "2001:db8:0:0::/64",
    ],
    ["an address in brackets, with a zone", "[fe80::1%en0]", "fe80:0:0:0::/64"],
    ["an IPv4 address mapped into IPv6", "::ffff:203.0.113.7", "203.0.113.7"],
    ["the same, written in hex", "::ffff:cb00:7107", "203.0.113.7"],
    ["no address", undefined, "unknown"],
    ["text that is no address", "Not-An-Address", "not-an-address"],
  ])("reads %s", (_name, address, key) => {
    expect(visitorKeyOf(address)).toBe(key);
  });

  it.each(["1:2:3:4:5:6:7:8:9", "1::2::3", "12345::1", "1:2:3:4:5:6:7::8:9", "300.1.1.1"])(
    "keeps %s whole, since it is not an address",
    (address) => {
      expect(visitorKeyOf(address)).toBe(address.toLowerCase());
    },
  );
});
