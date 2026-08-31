import { describe, expect, it } from "vitest";
import { seasonById, venueById } from "@/lib/data";
import { icsFilename, toIcs } from "@/lib/ics";

const season = seasonById.get("2026-autumn-g")!;
const NOW = new Date("2026-08-31T09:00:00Z");
const calendar = toIcs(season, venueById, NOW);
const lines = calendar.split("\r\n");

/** What a calendar client sees: folded lines joined back up. */
const unfolded = calendar.replace(/\r\n /g, "");

describe("the fixture calendar", () => {
  it("is a calendar", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
    expect(calendar.endsWith("\r\n")).toBe(true);
  });

  it("uses CRLF, which is not optional in iCalendar", () => {
    expect(calendar).not.toMatch(/[^\r]\n/);
  });

  it("has one event per fixture", () => {
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(7);
  });

  it("converts the 19:30 start through British Summer Time", () => {
    expect(calendar).toContain("DTSTART:20260908T183000Z");
    expect(calendar).toContain("DTSTART:20261215T193000Z");
  });

  it("finishes each event later than it starts", () => {
    expect(calendar).toContain("DTEND:20260908T220000Z");
  });

  it("names the teams the way the league does, home side first", () => {
    expect(calendar).toContain("SUMMARY:Bristol & Clifton G v South Bristol D");
    expect(calendar).toContain("SUMMARY:UWE B v Bristol & Clifton G");
  });

  it("carries the venue, with the address when there is one", () => {
    expect(unfolded).toContain("LOCATION:Bristol & Clifton Chess Club\\, 99 Oldfield Road\\, Hotwells\\, BS8 4QQ");
  });

  it("falls back to a name search for a venue with no pasted map link", () => {
    // Bristol Grendel has an address but nobody has pasted a Maps link for it,
    // so the description searches by name rather than inventing a place id.
    expect(unfolded).toContain("LOCATION:Bristol Grendel Chess Club");
    expect(unfolded).toContain("google.com/maps/search/");
  });

  it("escapes the separators rather than splitting a field on them", () => {
    for (const line of lines) expect(line).not.toMatch(/^[A-Z]+:[^:]*[^\\],.*,/);
  });

  it("folds long lines so nothing gets dropped on import", () => {
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("gives every event a stable id, so a re-download updates rather than duplicates", () => {
    const uids = lines.filter((line) => line.startsWith("UID:"));
    expect(new Set(uids).size).toBe(7);
    expect(uids[0]).toBe("UID:2026-autumn-g-r1@bristol-clifton-g");
  });

  it("names the file after the team and season", () => {
    expect(icsFilename(season)).toBe("bristol-clifton-g-autumn-2026.ics");
  });
});
