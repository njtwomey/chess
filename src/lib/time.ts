/**
 * Dates and times, all of them British.
 *
 * Matches are stored as a local date and a local wall-clock time, because that
 * is what the league publishes and what a player reads off a poster: 19:30 on a
 * Tuesday. Turning that into an instant needs the Europe/London offset on that
 * particular day, and the offset changes twice a season. Getting it wrong sends
 * a calendar invite an hour out for every fixture up to the October clock
 * change, which is a genuinely useless calendar.
 *
 * There is no date library here. Intl already knows the timezone database.
 */
const LONDON = "Europe/London";

const FIELDS = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function fieldsAt(instant: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of FIELDS.formatToParts(instant)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  // Some engines render midnight as hour 24 rather than 0.
  if (out.hour === 24) out.hour = 0;
  return out;
}

/** Minutes London is ahead of UTC at a given instant: 0 in winter, 60 in summer. */
function offsetMinutesAt(instant: Date): number {
  const at = fieldsAt(instant);
  const asUtc = Date.UTC(at.year ?? 0, (at.month ?? 1) - 1, at.day ?? 1, at.hour ?? 0, at.minute ?? 0, at.second ?? 0);
  return (asUtc - instant.getTime()) / 60_000;
}

function numbers(text: string, separator: string): number[] {
  return text.split(separator).map(Number);
}

/**
 * A London wall-clock date and time as a real instant.
 *
 * Two passes. The first offset is measured at the wrong instant by up to an
 * hour, which only matters within an hour of a clock change; measuring again at
 * the corrected instant lands on the right side of the boundary. Chess matches
 * are at 19:30 and the clocks change at 01:00, so one pass would do, but a rule
 * that holds only because of the fixture list is a trap for whoever schedules a
 * morning junior event.
 */
export function londonToUtc(date: string, time: string): Date {
  const [year = 0, month = 1, day = 1] = numbers(date, "-");
  const [hour = 0, minute = 0] = numbers(time, ":");
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = wall - offsetMinutesAt(new Date(wall)) * 60_000;
  return new Date(wall - offsetMinutesAt(new Date(first)) * 60_000);
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const LONG = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const SHORT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

/** Midday UTC, so formatting a bare date can never slip across a boundary. */
function noon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function formatWeekday(date: string): string {
  return WEEKDAY.format(noon(date));
}

/** "Tuesday 8 September" — how a fixture reads in a message to the team. */
export function formatLongDate(date: string): string {
  return LONG.format(noon(date));
}

/** "8 Sep" — for tables, where the column has to stay narrow. */
export function formatShortDate(date: string): string {
  return SHORT.format(noon(date));
}

export function formatYear(date: string): string {
  return date.slice(0, 4);
}

/** Today in London, as the YYYY-MM-DD the data uses. */
export function today(now: Date = new Date()): string {
  const at = fieldsAt(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.year}-${pad(at.month ?? 1)}-${pad(at.day ?? 1)}`;
}

/** Whole days from `from` to `to`, negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}

export function relativeDay(from: string, to: string): string {
  const days = daysBetween(from, to);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 0) return `in ${days} days`;
  if (days === -1) return "yesterday";
  return `${Math.abs(days)} days ago`;
}
