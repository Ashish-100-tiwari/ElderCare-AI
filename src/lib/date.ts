/**
 * "Today" for schedule queries.
 *
 * The seed writes schedule times in the server's local timezone and these
 * helpers read them back the same way, so the two always agree without
 * dragging a timezone library into the MVP. If you deploy to UTC but demo from
 * another zone, set TZ on the server (e.g. TZ=Asia/Kolkata).
 */

export type DayRange = { start: Date; end: Date };

/** Midnight-to-midnight window containing `reference`, in server local time. */
export function dayRange(reference: Date = new Date()): DayRange {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

/** Today's date at a given local wall-clock time. Used by the seed. */
export function todayAt(hour: number, minute = 0, reference: Date = new Date()): Date {
  const date = new Date(reference);
  date.setHours(hour, minute, 0, 0);
  return date;
}
