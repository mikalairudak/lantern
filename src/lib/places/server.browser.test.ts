import { describe, expect, it } from "vitest";

// Runs in the project's browser-like environment, where `window` exists.
describe("the server's lookups in a browser", () => {
  it("refuse to load, so no client bundle can read the key", async () => {
    await expect(import("./server")).rejects.toThrow("runs only on the server");
  });
});
