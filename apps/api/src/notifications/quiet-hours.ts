export interface QuietHours {
  readonly start?: string | null;
  readonly end?: string | null;
  readonly timezone: string;
}

function localMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find(({ type }) => type === "hour")?.value ?? "0");
  const minute = Number(parts.find(({ type }) => type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function parseTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  if (
    hour === undefined ||
    minute === undefined ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Quiet hour must use HH:mm");
  }
  return hour * 60 + minute;
}

export function isWithinQuietHours(date: Date, quiet: QuietHours): boolean {
  if (!quiet.start || !quiet.end || quiet.start === quiet.end) return false;
  const current = localMinutes(date, quiet.timezone);
  const start = parseTime(quiet.start);
  const end = parseTime(quiet.end);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function nextAllowedDelivery(date: Date, quiet: QuietHours): Date {
  if (!isWithinQuietHours(date, quiet)) return date;
  const candidate = new Date(date);
  for (let index = 0; index < 49; index += 1) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 30);
    if (!isWithinQuietHours(candidate, quiet)) return candidate;
  }
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}
