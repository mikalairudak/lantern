import { describe, expect, it } from "vitest";
import { beforeDeadline } from "./deadline";

const NEVER = new Promise<never>(() => undefined);

describe("beforeDeadline", () => {
  it("answers with the work when it comes first", async () => {
    const deadline = new AbortController();

    await expect(beforeDeadline(Promise.resolve(7), deadline.signal, "The store")).resolves.toBe(7);
  });

  it("passes the work's own failure on", async () => {
    const deadline = new AbortController();
    const down = new Error("The store is down");

    await expect(beforeDeadline(Promise.reject(down), deadline.signal, "The store")).rejects.toBe(
      down,
    );
  });

  it("fails once the deadline passes, naming what did not answer", async () => {
    const deadline = new AbortController();
    const waiting = beforeDeadline(NEVER, deadline.signal, "The generation log");

    deadline.abort();

    await expect(waiting).rejects.toThrow("The generation log did not answer in time");
  });

  it("fails at once when the deadline has already passed", async () => {
    await expect(beforeDeadline(NEVER, AbortSignal.abort(), "The events' store")).rejects.toThrow(
      "The events' store did not answer in time",
    );
  });
});
