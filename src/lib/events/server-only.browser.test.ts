import { describe, expect, it } from "vitest";

// Runs in the project's browser-like environment, where `window` exists.
describe("the product's events in a browser", () => {
  it.each([
    ["the route's body", () => import("./answer-event-request")],
    ["the Postgres store", () => import("./postgres-event-store")],
    ["the route's services", () => import("./services")],
  ])("refuse to load %s, so no client bundle can hold it", async (_name, load) => {
    await expect(load()).rejects.toThrow("runs only on the server");
  });

  it("leave the vocabulary loadable, since the client builds its events from it", async () => {
    await expect(import("./event.schema")).resolves.toHaveProperty("ProductEventSchema");
  });
});
