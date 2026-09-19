/**
 * Tests for India-time formatting.
 *
 * The assertions are absolute, not relative to the host clock, so they fail if
 * the code ever falls back to the machine's timezone. Run the suite with
 * `TZ=UTC` or `TZ=America/New_York` and it must still pass — that is the whole
 * point of `lib/timezone.ts`.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatClock, formatDayAndTime, formatTimestamp, greetingForHour } from "../src/lib/format";
import {
  istClock,
  istDateKey,
  istDayMonth,
  istDaysBetween,
  istHour,
  istInstant,
  istParts,
  istStartOfDay,
  istToday,
} from "../src/lib/timezone";
import { dayRange, todayAt } from "../src/lib/date";

describe("istParts / istClock — reading an instant in India time", () => {
  it("adds the +05:30 offset", () => {
    // 01:30 UTC is 07:00 IST — the exact shift the seeded "Wake Up" row relies on.
    assert.equal(istClock(new Date("2026-09-19T01:30:00.000Z")), "07:00");
    assert.equal(istClock(new Date("2026-09-19T07:30:00.000Z")), "13:00");
    assert.equal(istClock(new Date("2026-09-19T00:00:00.000Z")), "05:30");
  });

  it("rolls the date forward across the IST midnight boundary", () => {
    // 18:30 UTC is already the next day in India.
    assert.equal(istDateKey(new Date("2026-09-19T18:30:00.000Z")), "2026-09-20");
    assert.equal(istClock(new Date("2026-09-19T18:30:00.000Z")), "00:00");
    // A minute earlier is still the 19th.
    assert.equal(istDateKey(new Date("2026-09-19T18:29:00.000Z")), "2026-09-19");
  });

  it("rolls month and year over correctly", () => {
    assert.equal(istDateKey(new Date("2026-12-31T18:30:00.000Z")), "2027-01-01");
    assert.equal(istDateKey(new Date("2026-09-30T18:30:00.000Z")), "2026-10-01");
  });

  it("reports 1-based months, unlike Date", () => {
    assert.deepEqual(istParts(new Date("2026-09-19T07:30:00.000Z")), {
      year: 2026,
      month: 9,
      day: 19,
      hour: 13,
      minute: 0,
    });
  });

  it("gives the hour the greeting switches on", () => {
    // 01:00 UTC is 06:30 IST — morning in India, still "yesterday evening" in
    // some other zones.
    assert.equal(istHour(new Date("2026-09-19T01:00:00.000Z")), 6);
    assert.equal(greetingForHour(istHour(new Date("2026-09-19T01:00:00.000Z"))), "Good Morning");
    assert.equal(greetingForHour(istHour(new Date("2026-09-19T14:00:00.000Z"))), "Good Evening");
  });

  it("formats day and short month without consulting host locale data", () => {
    assert.equal(istDayMonth(new Date("2026-09-19T07:30:00.000Z")), "19 Sep");
    assert.equal(istDayMonth(new Date("2026-01-01T00:00:00.000Z")), "1 Jan");
  });
});

describe("istInstant / istStartOfDay — going the other way", () => {
  it("resolves an India wall-clock time to the right instant", () => {
    const instant = istInstant({ year: 2026, month: 9, day: 19, hour: 7, minute: 0 });
    assert.equal(instant.toISOString(), "2026-09-19T01:30:00.000Z");
  });

  it("round-trips with istParts", () => {
    const original = new Date("2026-03-15T09:45:00.000Z");
    const { year, month, day, hour, minute } = istParts(original);
    assert.equal(istInstant({ year, month, day, hour, minute }).getTime(), original.getTime());
  });

  it("puts midnight IST at 18:30 UTC the day before", () => {
    assert.equal(
      istStartOfDay(new Date("2026-09-19T07:30:00.000Z")).toISOString(),
      "2026-09-18T18:30:00.000Z",
    );
  });

  it("is stable anywhere in the day", () => {
    const morning = istStartOfDay(new Date("2026-09-18T18:30:00.000Z"));
    const evening = istStartOfDay(new Date("2026-09-19T18:29:59.999Z"));
    assert.equal(morning.getTime(), evening.getTime());
  });
});

describe("istToday", () => {
  const reference = new Date("2026-09-19T07:30:00.000Z"); // 13:00 IST on the 19th

  it("places a wall-clock time on today's India date", () => {
    assert.equal(istToday(7, 0, 0, reference).toISOString(), "2026-09-19T01:30:00.000Z");
  });

  it("shifts whole days with the offset", () => {
    assert.equal(istToday(20, 5, -1, reference).toISOString(), "2026-09-18T14:35:00.000Z");
    assert.equal(istDateKey(istToday(20, 5, -1, reference)), "2026-09-18");
  });

  it("crosses a month boundary backwards", () => {
    const firstOfMonth = new Date("2026-10-01T07:30:00.000Z");
    assert.equal(istDateKey(istToday(9, 0, -1, firstOfMonth)), "2026-09-30");
  });
});

describe("istDaysBetween", () => {
  it("counts India calendar days, not elapsed 24h blocks", () => {
    const lateEvening = new Date("2026-09-19T17:00:00.000Z"); // 22:30 IST, the 19th
    const justAfterMidnight = new Date("2026-09-19T19:00:00.000Z"); // 00:30 IST, the 20th
    // Two hours apart, but a different day in India.
    assert.equal(istDaysBetween(lateEvening, justAfterMidnight), 1);
  });

  it("is zero within one India day", () => {
    assert.equal(
      istDaysBetween(new Date("2026-09-18T18:30:00.000Z"), new Date("2026-09-19T18:29:00.000Z")),
      0,
    );
  });
});

describe("dayRange — the window schedule queries use", () => {
  it("spans exactly one India day", () => {
    const { start, end } = dayRange(new Date("2026-09-19T07:30:00.000Z"));
    assert.equal(start.toISOString(), "2026-09-18T18:30:00.000Z");
    assert.equal(end.toISOString(), "2026-09-19T18:30:00.000Z");
  });

  it("contains an early-morning IST time that UTC would call yesterday", () => {
    // 06:00 IST on the 19th. A UTC day window would place this on the 19th too,
    // but the boundary cases below are what break: this must sit inside the
    // window computed from an instant later the same India day.
    const earlyMorning = new Date("2026-09-19T00:30:00.000Z");
    const { start, end } = dayRange(new Date("2026-09-19T15:00:00.000Z"));
    assert.ok(earlyMorning >= start && earlyMorning < end);
  });

  it("keeps a 01:00 IST timestamp on the same day as a 23:00 IST one", () => {
    const justAfterMidnightIst = new Date("2026-09-18T19:30:00.000Z"); // 01:00 IST, 19th
    const lateNightIst = new Date("2026-09-19T17:30:00.000Z"); // 23:00 IST, 19th
    const { start, end } = dayRange(lateNightIst);
    assert.ok(justAfterMidnightIst >= start && justAfterMidnightIst < end);
  });

  it("todayAt lands inside dayRange for the same reference", () => {
    const reference = new Date("2026-09-19T07:30:00.000Z");
    const wakeUp = todayAt(7, 0, reference);
    const { start, end } = dayRange(reference);
    assert.ok(wakeUp >= start && wakeUp < end);
    assert.equal(istClock(wakeUp), "07:00");
  });
});

describe("format helpers render India time", () => {
  it("formatClock turns a 24-hour string into a 12-hour one", () => {
    assert.equal(formatClock("07:30"), "7:30 AM");
    assert.equal(formatClock("13:00"), "1:00 PM");
    assert.equal(formatClock("00:15"), "12:15 AM");
    assert.equal(formatClock("12:00"), "12:00 PM");
  });

  it("formatTimestamp reads an ISO instant as India time", () => {
    assert.equal(formatTimestamp("2026-09-19T01:30:00.000Z"), "7:00 AM");
    assert.equal(formatTimestamp("2026-09-19T07:30:00.000Z"), "1:00 PM");
  });

  it("formatTimestamp handles missing and unparseable input", () => {
    assert.equal(formatTimestamp(null), "—");
    assert.equal(formatTimestamp(undefined), "—");
    assert.equal(formatTimestamp(""), "—");
    assert.equal(formatTimestamp("not a date"), "—");
  });

  it("formatDayAndTime labels an older timestamp with day and month", () => {
    // Far enough in the past that it can never be "Today" whenever the suite runs.
    assert.equal(formatDayAndTime("2024-09-17T15:40:00.000Z"), "17 Sep, 9:10 PM");
  });

  it("formatDayAndTime says Today and Yesterday relative to the India day", () => {
    const nowIst = istParts(new Date());
    const noonToday = istInstant({ ...nowIst, hour: 12, minute: 0 }).toISOString();
    assert.equal(formatDayAndTime(noonToday), "Today, 12:00 PM");

    const noonYesterday = istToday(12, 0, -1).toISOString();
    assert.equal(formatDayAndTime(noonYesterday), "Yesterday, 12:00 PM");
  });

  it("formatDayAndTime handles missing input", () => {
    assert.equal(formatDayAndTime(null), "—");
    assert.equal(formatDayAndTime("nope"), "—");
  });
});
