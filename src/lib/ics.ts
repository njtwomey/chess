/**
 * The fixture list as a calendar file.
 *
 * Generated from the same match data the schedule page renders, so the calendar
 * cannot say something different from the site. A hand-maintained .ics in
 * `public/` would be wrong within a fortnight of the first rearranged fixture.
 *
 * Times are written as UTC instants rather than as local times with a VTIMEZONE
 * block. Both are legal; this one is shorter and cannot be misread, and it
 * relies on `londonToUtc` having got the clock change right, which is tested.
 */
import { addressLines, mapsUrl } from "@/lib/links";
import { fixtureNumber, type Match, type Season } from "@/lib/schema";
import { sides, venueFor } from "@/lib/season";
import { londonToUtc } from "@/lib/time";

/** A league match, generously. Nobody minds a calendar block ending early. */
const DURATION_MINUTES = 210;

function stamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Commas, semicolons and backslashes are field separators in iCalendar. */
function escape(text: string): string {
  return text.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
}

/**
 * RFC 5545 lines are folded at 75 octets, continued by a leading space.
 *
 * Unfolded long lines are the classic reason an .ics imports into Google
 * Calendar and silently drops a field.
 */
function fold(line: string): string[] {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out;
}

function event(season: Season, match: Match, now: Date): string[] {
  const start = londonToUtc(match.date, match.time);
  const end = new Date(start.getTime() + DURATION_MINUTES * 60_000);
  const { home, away } = sides(season, match);
  const venue = venueFor(season, match);
  const place = [venue.name, ...addressLines(venue)].join(", ");

  const description = [
    `${season.league.name}, fixture ${fixtureNumber(match)}.`,
    match.home ? "Home fixture." : "Away fixture.",
    `Map: ${mapsUrl(venue)}`,
  ].join(" ");

  return [
    "BEGIN:VEVENT",
    // Season included: fixture ids are unique within a season, not across them,
    // so `fixture-1` alone would collide with every other season's first
    // fixture and calendars would treat them as the same event. The season id
    // names its league, club, team and period, so the pair is unique outright.
    `UID:${season.id}/${match.id}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${home} v ${away}`)}`,
    `LOCATION:${escape(place)}`,
    `DESCRIPTION:${escape(description)}`,
    "END:VEVENT",
  ];
}

export function toIcs(season: Season, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bristol & Clifton G//Fixtures//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(`${season.team.name}, ${season.name}`)}`,
    ...season.matches.filter((match) => match.status !== "cancelled").flatMap((match) => event(season, match, now)),
    "END:VCALENDAR",
  ];

  // CRLF is required, and the trailing one matters to stricter parsers.
  return `${lines.flatMap(fold).join("\r\n")}\r\n`;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Named from the team and the season's own name rather than its id, because the
 * id already carries the team letter and "bristol-clifton-g-2026-autumn-g" is
 * not a filename anybody wants in their downloads folder.
 */
export function icsFilename(season: Season): string {
  return `${slug(season.team.name)}-${slug(season.name)}.ics`;
}
