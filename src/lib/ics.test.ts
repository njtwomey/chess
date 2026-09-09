import { describe, expect, it } from "vitest";
import { icsFilename, toIcs } from "@/lib/ics";
import { aClub, aMatch, aSeason, aTeam } from "@/lib/testing";

/**
 * A season built for the calendar, not read from one on disk.
 *
 * Three fixtures cover what an ICS file has to get right: a date inside British
 * Summer Time and one outside it, a home fixture and an away one, and a club
 * with a pasted map beside one with only a name to search for.
 */
const us = aTeam({
  clubId: "our-club",
  teamId: "a",
  name: "Our Team A",
  club: aClub({
    id: "our-club",
    name: "Our Chess Club",
    venue: { address: "1 Some Road, Somewhere", postcode: "AB1 2CD", maps: "https://maps.example.invalid/ours" },
  }),
});
const them = aTeam({
  clubId: "their-club",
  teamId: "b",
  name: "Their Team B",
  club: aClub({ id: "their-club", name: "Their Chess Club" }),
});
const another = aTeam({
  clubId: "another-club",
  teamId: "c",
  name: "Another Team C",
  club: aClub({ id: "another-club", name: "Another Chess Club" }),
});

const season = aSeason({
  name: "Test Season",
  team: us,
  teams: [us, them, another],
  matches: [
    aMatch({ number: 1, opponentTeamId: them.id, home: true, date: "2026-04-20" }),
    aMatch({ number: 2, opponentTeamId: them.id, home: false, date: "2026-11-10" }),
    aMatch({ number: 3, opponentTeamId: another.id, home: true, date: "2026-11-24" }),
  ],
});

const NOW = new Date("2026-03-01T09:00:00Z");
const calendar = toIcs(season, NOW);
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
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(season.matches.length);
  });

  it("converts the 19:30 start through British Summer Time", () => {
    // April is BST, so 19:30 local is 18:30Z; November is GMT and stays 19:30Z.
    expect(calendar).toContain("DTSTART:20260420T183000Z");
    expect(calendar).toContain("DTSTART:20261110T193000Z");
  });

  it("finishes each event later than it starts", () => {
    expect(calendar).toContain("DTEND:20260420T220000Z");
  });

  it("names the teams the way the league does, home side first", () => {
    expect(calendar).toContain("SUMMARY:Our Team A v Their Team B");
    expect(calendar).toContain("SUMMARY:Their Team B v Our Team A");
  });

  it("carries the venue, with the address when there is one", () => {
    expect(unfolded).toContain("LOCATION:Our Chess Club\\, 1 Some Road\\, Somewhere\\, AB1 2CD");
  });

  it("carries a map for every event, whatever kind the club has", () => {
    // Not asserting which kind: a pasted link is preferred and a name search is
    // the fallback, and which clubs have which is data that changes.
    const maps = [...unfolded.matchAll(/Map: (\S+)/g)].map((match) => match[1]);
    expect(maps).toHaveLength(season.matches.length);
    for (const url of maps) expect(url).toMatch(/^https:\/\//);
  });

  it("escapes the separators rather than splitting a field on them", () => {
    for (const line of lines) expect(line).not.toMatch(/^[A-Z]+:[^:]*[^\\],.*,/);
  });

  it("folds long lines so nothing gets dropped on import", () => {
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("gives every event a stable id, so a re-download updates rather than duplicates", () => {
    const uids = lines.filter((line) => line.startsWith("UID:"));
    expect(new Set(uids).size).toBe(season.matches.length);
    expect(uids[0]).toBe(`UID:${season.id}/fixture-1`);
  });

  it("names the file after the team and season", () => {
    expect(icsFilename(season)).toBe("our-team-a-test-season.ics");
  });
});
