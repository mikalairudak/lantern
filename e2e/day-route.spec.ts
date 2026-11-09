import { expect, test } from "./fixtures";

// Written out rather than imported, so the spec checks the route's contract, not a fixture.
const KYOTO = {
  city: "Kyoto",
  date: "2026-11-14",
  timezone: "Asia/Tokyo",
  citySource: "chosen",
  energy: "calm",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

test("answers a malformed request with 400, naming the field", async ({ request }) => {
  const response = await request.post("/api/day", { data: { ...KYOTO, energy: "frantic" } });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ issues: [{ path: "energy" }] });
});

test("answers 503 for a request no day was written for", async ({ request }) => {
  const response = await request.post("/api/day", { data: { ...KYOTO, city: "Osaka" } });

  expect(response.status()).toBe(503);
});

test("answers 503 for the day written by hand in Kyoto, which the site no longer serves", async ({
  request,
}) => {
  const response = await request.post("/api/day", { data: KYOTO });

  expect(response.status()).toBe(503);
});
