/**
 * "Today" for schedule queries.
 *
 * Both the seed and these helpers work in India time (see `lib/timezone.ts`), so
 * they agree no matter which timezone the process runs in. That matters on a
 * deployed server: with plain local-time arithmetic a UTC host treats 00:00–05:30
 * IST as the previous day, and a senior checking their plan early in the morning
 * would be shown yesterday's.
 */

import { istStartOfDay, istToday } from "@/lib/timezone";

export type DayRange = { start: Date; end: Date };

/** Midnight-to-midnight window containing `reference`, in India time. */
export function dayRange(reference: Date = new Date()): DayRange {
  const start = istStartOfDay(reference);
  // IST has no daylight saving, so a day is always exactly 24 hours.
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/** Today's date at a given India wall-clock time. Used by the seed. */
export function todayAt(hour: number, minute = 0, reference: Date = new Date()): Date {
  return istToday(hour, minute, 0, reference);
}
