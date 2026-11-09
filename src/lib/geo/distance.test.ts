import { describe, expect, it } from "vitest";
import { distanceInMeters } from "./distance";

// One degree of arc on the sphere the function uses: 2πR / 360.
const ONE_DEGREE_METERS = 111_195;

describe("distanceInMeters", () => {
  it("is zero between a point and itself", () => {
    const kyoto = { lat: 35.0116, lng: 135.7681 };
    expect(distanceInMeters(kyoto, kyoto)).toBe(0);
  });

  it("measures one degree of latitude as one degree of arc", () => {
    expect(distanceInMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      ONE_DEGREE_METERS,
      -1,
    );
  });

  it("halves a degree of longitude at sixty degrees north", () => {
    expect(distanceInMeters({ lat: 60, lng: 0 }, { lat: 60, lng: 1 })).toBeCloseTo(
      ONE_DEGREE_METERS / 2,
      -1,
    );
  });

  it("is the same in both directions", () => {
    const lisbon = { lat: 38.7139, lng: -9.1334 };
    const alicante = { lat: 38.3452, lng: -0.481 };
    expect(distanceInMeters(lisbon, alicante)).toBe(distanceInMeters(alicante, lisbon));
  });
});
