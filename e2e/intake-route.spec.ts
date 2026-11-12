import { expect, test } from "./fixtures";

// The e2e server runs without LIVE_GENERATION, so the route answers the written intake.

test("reads a text that names a written city into its day's request", async ({ request }) => {
  const response = await request.post("/api/intake", { data: { text: "Kanazawa, on foot" } });

  expect(response.status()).toBe(200);
  const answer = await response.json();
  expect(answer).toMatchObject({
    kind: "request",
    request: { city: "Kanazawa", energy: "calm" },
    unplaced: [],
  });
  // With live generation off only written days play, and they need no signature.
  expect(answer).not.toHaveProperty("signed");
});

test("answers a city with no written day as unavailable, a 503", async ({ request }) => {
  const response = await request.post("/api/intake", { data: { text: "Lisbon" } });

  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ kind: "unavailable" });
});

test("answers a text over 200 characters with 400, naming the field", async ({ request }) => {
  const response = await request.post("/api/intake", { data: { text: "x".repeat(201) } });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ issues: [{ path: "text" }] });
});
