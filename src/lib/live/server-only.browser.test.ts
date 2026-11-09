import { describe, expect, it } from "vitest";

// Runs in the project's browser-like environment, where `window` exists.
describe("the live routes' server code, and the eval that runs it, in a browser", () => {
  it.each([
    ["the visitor's address", () => import("./visitor")],
    ["the city's signature", () => import("./city-signature")],
    ["the streamed model call", () => import("./streamed-call")],
    ["the live day", () => import("./live-day")],
    ["the live re-plan", () => import("./live-replan")],
    ["the days kept in the log", () => import("./stored-days")],
    ["the live routes' stores", () => import("./stores")],
    ["the live intake", () => import("@/lib/intake/answer-intake-request")],
    ["the database's driver", () => import("@/lib/db/sql")],
    ["the Postgres stores", () => import("./postgres-stores")],
    ["the eval's plan and cost gate", () => import("@/eval/round")],
    ["the eval's day round", () => import("@/eval/day-round")],
    ["the eval's intake round", () => import("@/eval/intake-round")],
    ["the eval's re-plan round", () => import("@/eval/replan-round")],
    ["the eval's place round", () => import("@/eval/place-round")],
    ["the eval's schema probe", () => import("@/eval/schema-probe")],
    ["the eval's voice round", () => import("@/eval/voice/round")],
  ])("refuses to load %s, so no client bundle can hold it", async (_name, load) => {
    await expect(load()).rejects.toThrow("runs only on the server");
  });

  it("leaves the day route's body loadable, since the lab's client pages read its pace", async () => {
    await expect(import("@/lib/stream/answer-day-request")).resolves.toHaveProperty(
      "WRITTEN_DAY_PACE",
    );
  });
});
