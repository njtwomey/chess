/**
 * The messages the captain actually sends.
 *
 * These are the two jobs either side of a fixture: asking who can play, and
 * telling people where the answers have got to. Both are generated from the
 * same data the page renders, so a message pasted into the group chat cannot
 * quietly disagree with the site.
 *
 * Plain text with no markdown, because the destination is WhatsApp.
 */
import { venueById } from "@/lib/data";
import { mapsUrl } from "@/lib/links";
import type { Match, Season } from "@/lib/schema";
import { replyOf } from "@/lib/season";
import { type Reply } from "@/lib/selection";
import { formatLongDate } from "@/lib/time";

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
];

/** "the first fixture of the season", or "round 14" once the words run out. */
export function describeRound(round: number): string {
  const word = ORDINALS[round - 1];
  return word ? `the ${word} fixture of the season` : `round ${round}`;
}

/**
 * Asking who can play.
 *
 * Everything a player needs to answer without opening anything: which match,
 * when, where, and a map. No relative date, because the message may sit in the
 * chat for a week and "in 14 days" ages badly.
 */
export function callToAction(season: Season, match: Match): string {
  const venue = venueById.get(match.venueId);
  const home = match.home ? season.team.name : match.opponent;
  const away = match.home ? match.opponent : season.team.name;

  const where = match.home ? "at home" : `away at ${venue?.name ?? "a venue still to be confirmed"}`;
  const link = venue ? ` (${mapsUrl(venue)})` : "";
  // The map goes inside the sentence, before the stop, or the message reads as
  // though it ended and then somebody pasted a URL after it.

  // No list of the four answers: the captain puts them out as a poll, so
  // spelling them out here would be a second, worse copy of the options.
  return [
    `Who can play in ${describeRound(match.round)}?`,
    "",
    `${home} v ${away}, ${formatLongDate(match.date)}, ${match.time}, ${where}${link}.`,
  ].join("\n");
}

/**
 * Where the replies have got to, without naming a team.
 *
 * Useful before the team is settled, which is exactly when people ask. It says
 * who has answered what and who has not answered at all, and says plainly that
 * nothing has been decided, so nobody reads a list of "can play" as a team
 * sheet.
 */
export function availabilitySummary(season: Season, match: Match): string {
  const grouped = new Map<Reply | "none", string[]>();
  for (const player of season.players) {
    const reply = replyOf(match, player.id) ?? "none";
    grouped.set(reply, [...(grouped.get(reply) ?? []), player.name]);
  }

  const line = (key: Reply | "none", label: string) => {
    const names = grouped.get(key);
    return names && names.length > 0 ? `${label}: ${[...names].sort().join(", ")}.` : null;
  };

  return [
    `${describeRound(match.round).replace(/^the /, "The ")} is ${formatLongDate(match.date)}, ` +
      `${match.home ? "at home" : `away to ${match.opponent}`}. Where we are so far:`,
    "",
    line("yes", "Can play"),
    line("reserve", "Can be a reserve"),
    line("unsure", "Not sure yet"),
    line("no", "Cannot play"),
    line("none", "Not heard from"),
    "",
    "Nobody is picked yet. Shout if anything changes and I will update it.",
  ]
    .filter((part) => part !== null)
    .join("\n");
}
