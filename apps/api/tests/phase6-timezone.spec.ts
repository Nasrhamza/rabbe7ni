import { describe, expect, it } from "vitest";

import {
  calendarDayDifference,
  localDateKey,
  streakTransition,
  weeklyPeriodKey,
} from "../src/habits/timezone.js";

describe("Phase 6 timezone-aware periods and streaks", () => {
  it("uses the customer's calendar date across midnight and DST", () => {
    expect(localDateKey(new Date("2026-03-28T23:30:00Z"), "Europe/Paris")).toBe("2026-03-29");
    expect(localDateKey(new Date("2026-03-29T22:30:00Z"), "Europe/Paris")).toBe("2026-03-30");
    expect(calendarDayDifference("2026-03-29", "2026-03-30")).toBe(1);
  });

  it("uses deterministic ISO week keys", () => {
    expect(weeklyPeriodKey("2026-01-01")).toBe("2026-W01");
    expect(weeklyPeriodKey("2026-12-31")).toBe("2026-W53");
  });

  it("handles duplicate days, grace, freeze and reset explicitly", () => {
    expect(
      streakTransition({
        previousLocalKey: "2026-07-20",
        currentLocalKey: "2026-07-20",
        currentStreak: 3,
        longestStreak: 5,
        graceDays: 0,
        freezesRemaining: 1,
      }),
    ).toMatchObject({ currentStreak: 3, action: "DUPLICATE_DAY" });
    expect(
      streakTransition({
        previousLocalKey: "2026-07-20",
        currentLocalKey: "2026-07-22",
        currentStreak: 3,
        longestStreak: 5,
        graceDays: 1,
        freezesRemaining: 0,
      }),
    ).toMatchObject({ currentStreak: 4, action: "GRACE_USED" });
    expect(
      streakTransition({
        previousLocalKey: "2026-07-20",
        currentLocalKey: "2026-07-23",
        currentStreak: 4,
        longestStreak: 5,
        graceDays: 1,
        freezesRemaining: 1,
      }),
    ).toMatchObject({
      currentStreak: 5,
      freezesRemaining: 0,
      action: "FREEZE_USED",
    });
    expect(
      streakTransition({
        previousLocalKey: "2026-07-20",
        currentLocalKey: "2026-07-25",
        currentStreak: 5,
        longestStreak: 5,
        graceDays: 0,
        freezesRemaining: 1,
      }),
    ).toMatchObject({ currentStreak: 1, action: "RESET" });
  });
});
