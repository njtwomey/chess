import { describe, expect, it } from "vitest";
import { daysBetween, formatLongDate, formatWeekday, londonToUtc, relativeDay, today } from "@/lib/time";

describe("londonToUtc", () => {
  it("takes an hour off during British Summer Time", () => {
    // 8 September is BST, so a 19:30 start is 18:30 UTC. Getting this wrong
    // puts every autumn fixture in the calendar an hour late.
    expect(londonToUtc("2026-09-08", "19:30").toISOString()).toBe("2026-09-08T18:30:00.000Z");
  });

  it("leaves winter alone", () => {
    expect(londonToUtc("2026-12-15", "19:30").toISOString()).toBe("2026-12-15T19:30:00.000Z");
  });

  it("gets both sides of the October clock change right", () => {
    // The clocks go back on 25 October 2026.
    expect(londonToUtc("2026-10-20", "19:30").toISOString()).toBe("2026-10-20T18:30:00.000Z");
    expect(londonToUtc("2026-10-28", "19:30").toISOString()).toBe("2026-10-28T19:30:00.000Z");
  });

  it("handles a morning start, where a single-pass offset would be wrong", () => {
    expect(londonToUtc("2026-03-29", "10:00").toISOString()).toBe("2026-03-29T09:00:00.000Z");
  });
});

describe("formatting", () => {
  it("names the weekday the league published", () => {
    expect(formatWeekday("2026-09-08")).toBe("Tue");
    expect(formatWeekday("2026-10-05")).toBe("Mon");
    expect(formatWeekday("2026-12-02")).toBe("Wed");
  });

  it("writes a date the way it would be written in a message", () => {
    expect(formatLongDate("2026-09-08")).toBe("Tuesday 8 September");
  });
});

describe("counting days", () => {
  it("is not thrown off by a clock change in between", () => {
    expect(daysBetween("2026-10-20", "2026-10-28")).toBe(8);
    expect(daysBetween("2026-10-28", "2026-10-20")).toBe(-8);
  });

  it("says something readable about how far off a match is", () => {
    expect(relativeDay("2026-09-01", "2026-09-01")).toBe("today");
    expect(relativeDay("2026-09-01", "2026-09-02")).toBe("tomorrow");
    expect(relativeDay("2026-09-01", "2026-09-08")).toBe("in 7 days");
    expect(relativeDay("2026-09-08", "2026-09-01")).toBe("7 days ago");
  });
});

describe("today", () => {
  it("reports the London date, not the UTC one", () => {
    // 23:30 UTC on 7 September is already the 8th in London, because of BST.
    expect(today(new Date("2026-09-07T23:30:00Z"))).toBe("2026-09-08");
    expect(today(new Date("2026-12-07T23:30:00Z"))).toBe("2026-12-07");
  });
});
