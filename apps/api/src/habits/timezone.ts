export function localDateKey(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!value.year || !value.month || !value.day) {
    throw new RangeError(`Unable to derive a local date for timezone ${timezone}`);
  }
  return `${value.year}-${value.month}-${value.day}`;
}

export function dateFromLocalKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) throw new RangeError(`Invalid local date key: ${key}`);
  return new Date(Date.UTC(year, month - 1, day));
}

export function calendarDayDifference(previousKey: string, currentKey: string): number {
  return Math.round(
    (dateFromLocalKey(currentKey).getTime() - dateFromLocalKey(previousKey).getTime()) / 86_400_000,
  );
}

export function weeklyPeriodKey(localKey: string): string {
  const date = dateFromLocalKey(localKey);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function streakTransition(input: {
  previousLocalKey?: string | undefined;
  currentLocalKey: string;
  currentStreak: number;
  longestStreak: number;
  graceDays: number;
  freezesRemaining: number;
}) {
  if (!input.previousLocalKey) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(input.longestStreak, 1),
      freezesRemaining: input.freezesRemaining,
      action: "STARTED",
    };
  }
  const difference = calendarDayDifference(input.previousLocalKey, input.currentLocalKey);
  if (difference < 0) throw new RangeError("Qualifying event predates the current streak");
  if (difference === 0) {
    return {
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
      freezesRemaining: input.freezesRemaining,
      action: "DUPLICATE_DAY",
    };
  }
  const missedDays = difference - 1;
  const uncoveredDays = Math.max(0, missedDays - input.graceDays);
  const canContinue = uncoveredDays <= input.freezesRemaining;
  const currentStreak = canContinue ? input.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(input.longestStreak, currentStreak),
    freezesRemaining: canContinue ? input.freezesRemaining - uncoveredDays : input.freezesRemaining,
    action:
      missedDays === 0
        ? "EXTENDED"
        : canContinue
          ? uncoveredDays > 0
            ? "FREEZE_USED"
            : "GRACE_USED"
          : "RESET",
  };
}
