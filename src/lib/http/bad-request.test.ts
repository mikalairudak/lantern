import { describe, expect, it } from "vitest";
import { z } from "zod";
import { badRequest, issuesOf } from "./bad-request";

describe("a request the routes cannot read", () => {
  it("lists each issue at the path a person reads, the body's own at request", () => {
    const parsed = z.strictObject({ stops: z.array(z.string()) }).safeParse({ stops: [1], x: 2 });
    if (parsed.success) throw new Error("The body should not parse");

    expect(issuesOf(parsed.error)).toEqual([
      { path: "stops[0]", message: expect.any(String) },
      { path: "request", message: expect.any(String) },
    ]);
  });

  it("answers 400 with the issues", async () => {
    const response = badRequest([{ path: "request", message: "The body is not JSON" }]);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      issues: [{ path: "request", message: "The body is not JSON" }],
    });
  });
});
