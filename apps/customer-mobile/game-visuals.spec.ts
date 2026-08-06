import { describe, expect, it } from "vitest";

/**
 * Landing geometry for the prize wheel, mirrored from `PrizeWheel`.
 *
 * The wheel is drawn clockwise from twelve o'clock, so segment `i` spans
 * `[i·segmentAngle, (i+1)·segmentAngle)` and its centre sits at `(i + 0.5)·segmentAngle`. Rotating
 * the wheel by the complement of that angle brings the centre under the fixed pointer.
 *
 * The previous implementation interpolated a fixed `0 → 2160deg` range and then applied
 * `setOffset(prizeIndex / prizeCount)` *after* starting the animation, which both jumped mid-spin
 * and extrapolated past the output range — the wheel stopped on an unrelated segment. These cases
 * pin the corrected arithmetic.
 */
function landingRotation(prizeIndex: number, prizeCount: number, previous = 0): number {
  const segmentAngle = 360 / prizeCount;
  const centre = (prizeIndex + 0.5) * segmentAngle;
  const landing = 360 - centre;
  return previous + 360 * 5 + ((landing - (previous % 360)) % 360);
}

/** Where the wheel actually comes to rest, as an angle measured clockwise from the pointer. */
function restingAngle(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

/** The segment sitting under the pointer once the wheel settles. */
function segmentUnderPointer(rotation: number, prizeCount: number): number {
  const segmentAngle = 360 / prizeCount;
  // Undo the wheel's rotation to find which segment now occupies twelve o'clock.
  const angle = ((360 - restingAngle(rotation)) % 360) + 0.0001;
  return Math.floor(angle / segmentAngle) % prizeCount;
}

describe("prize wheel landing geometry", () => {
  it("stops on the awarded segment for every position of a six-prize wheel", () => {
    for (let index = 0; index < 6; index += 1) {
      const rotation = landingRotation(index, 6);
      expect(segmentUnderPointer(rotation, 6)).toBe(index);
    }
  });

  it("holds for wheel sizes that do not divide evenly into 360", () => {
    for (const count of [3, 5, 7, 8, 11]) {
      for (let index = 0; index < count; index += 1) {
        const rotation = landingRotation(index, count);
        expect(segmentUnderPointer(rotation, count)).toBe(index);
      }
    }
  });

  it("always spins forward by at least five full turns", () => {
    for (let index = 0; index < 8; index += 1) {
      expect(landingRotation(index, 8)).toBeGreaterThanOrEqual(360 * 5);
    }
  });

  it("keeps landing correctly when spun repeatedly from the previous resting angle", () => {
    let previous = 0;
    for (const index of [4, 1, 7, 0, 3]) {
      previous = landingRotation(index, 8, previous);
      expect(segmentUnderPointer(previous, 8)).toBe(index);
    }
  });

  it("never rewinds the wheel between consecutive spins", () => {
    let previous = 0;
    for (const index of [2, 2, 5, 0]) {
      const next = landingRotation(index, 6, previous);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });
});
