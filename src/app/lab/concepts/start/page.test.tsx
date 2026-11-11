import { describe, expect, it, vi } from "vitest";

const { visit, shownPool } = vi.hoisted(() => {
  let arrive: () => void = () => undefined;
  const arrived = new Promise<void>((done) => {
    arrive = done;
  });
  return { visit: { arrived, arrive: () => arrive() }, shownPool: vi.fn(() => []) };
});

vi.mock("next/server", () => ({ connection: () => visit.arrived }));
vi.mock("@/lib/http/studio-access", () => ({
  requireStudioLogin: async () => undefined,
  studioMetadataOf: async () => ({}),
}));
vi.mock("@/features/day/written-pool", () => ({ shownPool }));
vi.mock("./start-concept", () => ({ StartConcept: () => null }));

const { default: StartConceptPage } = await import("./page");

describe("the start concept's page", () => {
  it("picks the days' seasons by the clock only once the visit has arrived", async () => {
    const page = StartConceptPage();
    await new Promise((done) => setTimeout(done));
    expect(shownPool).not.toHaveBeenCalled();

    visit.arrive();
    await page;
    expect(shownPool).toHaveBeenCalledOnce();
  });
});
