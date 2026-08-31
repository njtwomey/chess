/**
 * The messages the captain actually sends.
 *
 * Three of them, and deliberately the same shape: a label saying what the
 * message is, the fixture it is about, then who is involved. Somebody skimming
 * a group chat should be able to tell at a glance whether they are looking at a
 * question, a progress report or the team, and which match it belongs to,
 * without reading the whole thing or scrolling back up.
 *
 * All three are built from the data the page renders, so a pasted message
 * cannot quietly disagree with the site. Plain text, because the destination is
 * WhatsApp.
 */
import { playerName, venueById } from "@/lib/data";
import { mapsUrl } from "@/lib/links";
import type { Game, Match, Season } from "@/lib/schema";
import { formatPoints, replyOf } from "@/lib/season";
import type { Reply, Selection } from "@/lib/selection";
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

/** Drops the empty entries a conditional line leaves behind. */
function join(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join("\n");
}

const sorted = (names: string[]) => [...names].sort().join(", ");

/**
 * The fixture, in one line.
 *
 * Both sides named, because "the first fixture" leaves somebody scrolling back
 * through the chat to work out which match a list belongs to. The map is only
 * on the messages where somebody has to get themselves somewhere: on a progress
 * report it is a link nobody clicks, and four of them in a row is clutter.
 */
function fixtureLine(season: Season, match: Match, withMap: boolean): string {
  const venue = venueById.get(match.venueId);
  const home = match.home ? season.team.name : match.opponent;
  const away = match.home ? match.opponent : season.team.name;
  const where = match.home ? "at home" : `away at ${venue?.name ?? "a venue still to be confirmed"}`;
  const link = withMap && venue ? ` (${mapsUrl(venue)})` : "";

  return `${home} v ${away}, ${formatLongDate(match.date)}, ${match.time}, ${where}${link}.`;
}

/**
 * Asking who can play.
 *
 * No relative date, because the message sits in the chat for a week and "in 14
 * days" ages badly. No list of the four answers either: those go out as a poll,
 * so spelling them out would be a second, worse copy of the options.
 */
export function callToAction(season: Season, match: Match): string {
  return join([`Who can play in ${describeRound(match.round)}?`, "", fixtureLine(season, match, true)]);
}

/**
 * Where the replies have got to, naming no team.
 *
 * Wanted most often while the team is still open, which is exactly when a list
 * of "can play" is most likely to be misread as a team sheet. Hence the last
 * line.
 */
export function availabilityUpdate(season: Season, match: Match): string {
  const grouped = new Map<Reply | "none", string[]>();
  for (const player of season.players) {
    const reply = replyOf(match, player.id) ?? "none";
    grouped.set(reply, [...(grouped.get(reply) ?? []), player.name]);
  }

  const line = (key: Reply | "none", label: string) => {
    const names = grouped.get(key);
    return names && names.length > 0 ? `${label}: ${sorted(names)}.` : null;
  };

  return join([
    `Where we are for ${fixtureLine(season, match, false)}`,
    "",
    line("yes", "Can play"),
    line("reserve", "Can be a reserve"),
    line("unsure", "Not sure yet"),
    line("no", "Cannot play"),
    line("none", "Not heard from"),
    "",
    "Nobody is picked yet. Shout if anything changes.",
  ]);
}

/**
 * The team.
 *
 * Who is playing, who is standing by, who missed out, and then it stops. It
 * does not explain which coin toss went whose way: the working is on the site
 * for anybody who wants it, and a chat message that argues its own case invites
 * the argument. What it does say is that missing out moves you up next time,
 * because that is the whole promise the rule makes and the one thing somebody
 * who was not picked wants to hear.
 */
export function selectedTeam(season: Season, match: Match, selection: Selection): string {
  const names = (players: { playerId: string }[]) => players.map((player) => playerName(season, player.playerId));
  // Only the team and the reserves are named. Listing everybody who offered and
  // did not get on is a roll-call of people who missed out, which is the last
  // thing anybody wants read out; the line at the end speaks to them instead.
  const missedOut = selection.reservePlayers.length > 0 || selection.standby.length > 0;

  return join([
    `Team for ${fixtureLine(season, match, true)}`,
    "",

    selection.boardPlayers.length > 0 ? `Playing: ${names(selection.boardPlayers).join(", ")}.` : null,
    // Reserves keep the rule's order, because the order is the point: reserve
    // one fills the first vacancy. Everyone else is alphabetical.
    selection.reservePlayers.length > 0 ? `Reserves: ${names(selection.reservePlayers).join(", ")}.` : null,
    selection.withdrawn.length > 0 ? `Dropped out: ${sorted(names(selection.withdrawn))}.` : null,

    selection.unfilled > 0
      ? `\n${selection.unfilled} ${selection.unfilled === 1 ? "board is" : "boards are"} still unfilled. ` +
        "If you can make it, please say so."
      : null,

    missedOut ? "\nIf you are not playing this time, you are nearer the front next time." : null,
  ]);
}

/**
 * The result, board by board.
 *
 * Named players against named opponents, because a bare scoreline tells the
 * three people who were not there nothing about their own evening. Scores are
 * written from our player's side, which is how everybody reads their own game.
 */
export function matchResult(season: Season, match: Match): string | null {
  if (!match.result) return null;

  const home = match.home ? season.team.name : match.opponent;
  const away = match.home ? match.opponent : season.team.name;
  // The league writes a scoreline home side first, so the numbers have to be
  // ordered to match the names or an away win reads as a defeat.
  const homeScore = match.home ? match.result.ourScore : match.result.theirScore;
  const awayScore = match.home ? match.result.theirScore : match.result.ourScore;

  const outcome =
    match.result.ourScore > match.result.theirScore
      ? "A win"
      : match.result.ourScore < match.result.theirScore
        ? "A loss"
        : "A draw";

  const score: Record<Game["result"], string> = {
    win: "1 - 0",
    "default-win": "1 - 0 (default)",
    draw: "½ - ½",
    loss: "0 - 1",
    "default-loss": "0 - 1 (default)",
  };

  const boards = [...match.result.games]
    .sort((a, b) => a.board - b.board)
    .map((game) => `${game.board}. ${playerName(season, game.playerId)} ${score[game.result]} ${game.opponent}`);

  return join([
    `${outcome}: ${home} ${formatPoints(homeScore)} - ${formatPoints(awayScore)} ${away}.`,
    `${formatLongDate(match.date)}, ${match.home ? "at home" : "away"}.`,
    "",
    ...boards,
    "",
    "Thanks all.",
  ]);
}
