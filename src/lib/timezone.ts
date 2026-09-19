/**
 * The app's wall clock is India Standard Time, always.
 *
 * Every time the senior or their family reads — the header clock, schedule rows,
 * "Today"/"Yesterday" labels, the time the companion mentions — is derived here
 * rather than from `Date#getHours()`. That method reports whichever timezone the
 * process or the browser happens to be in, so the same 07:00 schedule row shows
 * as 07:00 on a laptop in Pune and 01:30 on a server running UTC. The senior
 * lives in India; what they read should not depend on where the code runs.
 *
 * Instants are still stored and transported as UTC ISO strings. This module only
 * decides how an instant is *read back*.
 *
 * The fixed offset is correct rather than a shortcut: India has one zone
 * nationwide and has had no daylight saving since 1945, so +05:30 never varies.
 * It also keeps server and client in exact agreement without either consulting
 * its own timezone database — which is what removes the hydration mismatch that
 * locale-dependent formatting otherwise causes.
 */

/** For any `Intl` call that needs the zone by name. */
export const APP_TIME_ZONE = "Asia/Kolkata";

/** IST is UTC+05:30, year-round. */
const OFFSET_MS = (5 * 60 + 30) * 60_000;

/** Short month names, so output never depends on the host's locale data. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type IstParts = {
  year: number;
  /** 1–12, not the 0–11 that `Date` uses. */
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** India's wall-clock fields for an instant. */
export function istParts(instant: Date): IstParts {
  // Shifting by the offset makes the UTC getters read IST values. The shifted
  // Date is not a meaningful instant and never leaves this function.
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** Hour 0–23 in India. What the greeting switches on. */
export function istHour(instant: Date): number {
  return istParts(instant).hour;
}

/** `"07:30"` — 24-hour, zero-padded, India time. */
export function istClock(instant: Date): string {
  const { hour, minute } = istParts(instant);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** `"2026-09-19"` — the calendar day in India. */
export function istDateKey(instant: Date): string {
  const { year, month, day } = istParts(instant);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `"19 Sep"` — day and short month in India. */
export function istDayMonth(instant: Date): string {
  const { day, month } = istParts(instant);
  return `${day} ${MONTHS[month - 1]}`;
}

/** The instant at which a given India wall-clock time occurs. */
export function istInstant(parts: {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}): Date {
  const { year, month, day, hour = 0, minute = 0 } = parts;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS);
}

/** Midnight in India, as an instant. */
export function istStartOfDay(instant: Date = new Date()): Date {
  const { year, month, day } = istParts(instant);
  return istInstant({ year, month, day });
}

/**
 * Today in India at a given wall-clock time.
 *
 * `dayOffset` shifts the calendar day: -1 is yesterday. Used by the seed and the
 * demo store to place fixtures at recognisable times of day.
 */
export function istToday(hour: number, minute = 0, dayOffset = 0, reference: Date = new Date()): Date {
  const { year, month, day } = istParts(reference);
  // Day arithmetic via Date.UTC, which normalises an out-of-range day for us
  // (day 0 becomes the last of the previous month).
  return istInstant({ year, month, day: day + dayOffset, hour, minute });
}

/** Whole days between two instants, by India calendar day. */
export function istDaysBetween(from: Date, to: Date): number {
  // Rounded because the two midnights are exactly a multiple of 24h apart —
  // IST has no DST — but floating point on large millisecond values should not
  // be trusted to land dead on an integer.
  return Math.round((istStartOfDay(to).getTime() - istStartOfDay(from).getTime()) / 86_400_000);
}
