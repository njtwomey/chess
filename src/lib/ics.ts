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
import { mapsUrl } from "@/lib/links";
import type { Match, Season, Venue } from "@/lib/schema";
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

function event(season: Season, match: Match, venue: Venue | undefined, now: Date): string[] {
  const start = londonToUtc(match.date, match.time);
  const end = new Date(start.getTime() + DURATION_MINUTES * 60_000);
  const home = match.home ? season.team.name : match.opponent;
  const away = match.home ? match.opponent : season.team.name;
  const place = venue
    ? [venue.name, venue.address, venue.postcode].filter(Boolean).join(", ")
    : "Venue to be confirmed";

  const description = [
    `${season.team.competition}, round ${match.round}.`,
    match.home ? "Home fixture." : "Away fixture.",
    venue ? `Map: ${mapsUrl(venue)}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "BEGIN:VEVENT",
    // Season included: match ids are unique within a season, not across them,
    // so `r1` alone would collide with every other season's first round and
    // calendars would treat them as the same event.
    `UID:${season.id}-${match.id}@bristol-clifton-g`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${home} v ${away}`)}`,
    `LOCATION:${escape(place)}`,
    `DESCRIPTION:${escape(description)}`,
    "END:VEVENT",
  ];
}

export function toIcs(season: Season, venues: Map<string, Venue>, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bristol & Clifton G//Fixtures//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(`${season.team.name}, ${season.name}`)}`,
    ...season.matches
      .filter((match) => match.status !== "cancelled")
      .flatMap((match) => event(season, match, venues.get(match.venueId), now)),
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
