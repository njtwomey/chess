/**
 * Facts derived from a season, rather than stored in it.
 *
 * Games played is the input the selection rule cares most about, and it is
 * counted here from the recorded results rather than kept as a number on a
 * player. A hand-maintained counter is a second copy of a fact that already
 * exists, and the first time somebody corrects a result without correcting the
 * counter the fairest-looking selection in the season becomes wrong.
 */
import { select, type Candidate, type Reply, type Selection } from "@/lib/selection";
import { GAME_POINTS, type Game, type Match, type Player, type Rating, type Season } from "@/lib/schema";

/** Chronological, with the round number settling two matches on one day. */
export function matchOrder(a: Match, b: Match): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.round - b.round;
}

export function orderedMatches(season: Season): Match[] {
  return [...season.matches].sort(matchOrder);
}

/**
 * How many games each player had behind them when this match came round.
 *
 * Only matches *earlier* than this one count, which is what makes a past
 * selection reproducible. Counting the whole season would mean that recording
 * December's result silently changed the answer the site gives for September,
 * and the captain would have no way to show what he actually decided at the
 * time.
 */
export function gamesPlayedBefore(season: Season, match: Match): Map<string, number> {
  const counts = new Map<string, number>(season.players.map((player) => [player.id, 0]));
  for (const other of season.matches) {
    if (other.id === match.id || matchOrder(other, match) >= 0 || !other.result) continue;
    for (const game of other.result.games) {
      counts.set(game.playerId, (counts.get(game.playerId) ?? 0) + 1);
    }
  }
  return counts;
}

/** What a player said, or null if they have not answered yet. */
export function replyOf(match: Match, playerId: string): Reply | null {
  return match.availability.find((entry) => entry.playerId === playerId)?.reply ?? null;
}

/** Whether they later pulled out, and anything they said about why. */
export function withdrawalOf(match: Match, playerId: string): { at?: string; note?: string } | null {
  return match.availability.find((entry) => entry.playerId === playerId)?.withdrawn ?? null;
}

/**
 * The whole roster as candidates, not only the people who replied.
 *
 * Silence is treated as "not sure", which keeps it out of the selection while
 * leaving the player visible in the list of people still to chase. Dropping the
 * non-repliers instead would make a quiet week look like a small squad.
 */
export function candidatesFor(season: Season, match: Match): Candidate[] {
  const played = gamesPlayedBefore(season, match);
  return season.players.map((player) => {
    const entry = match.availability.find((reply) => reply.playerId === player.id);
    return {
      playerId: player.id,
      reply: entry?.reply ?? "unsure",
      gamesPlayed: played.get(player.id) ?? 0,
      withdrawn: entry?.withdrawn != null,
    };
  });
}

export function selectionFor(season: Season, match: Match): Selection {
  return select({
    matchId: match.id,
    seed: season.seed,
    boards: season.boards,
    reserves: season.reserves,
    candidates: candidatesFor(season, match),
  });
}

/** The team that will actually take the field, and how it differs from the rule. */
export interface Fielded {
  /** Who plays, in board order. */
  players: Player[];
  /** Who is next in line, in the order they would come in. */
  reserves: Player[];
  /** Whether this is simply what the rule and the ratings produced, untouched. */
  fromRule: boolean;
  /** Whether the board order was written down rather than computed from ratings. */
  ordered: boolean;
  /** Fielded although the rule did not pick them. */
  added: Player[];
  /** Picked by the rule and not fielded. */
  dropped: Player[];
  /** Named on the shortlist, then pulled out. Everybody below them moved up. */
  withdrawn: Player[];
  /** Boards the shortlist could not fill. Reported, never quietly ignored. */
  unfilled: number;
  /** The captain's reason, where one was given. */
  note?: string;
}

/**
 * The rule proposes; the captain fields the team.
 *
 * Almost always these are the same thing and `fromRule` says so. When they are
 * not, the override is what the page must show, because a board order for four
 * players who are not going to play is not a harmless stale proposal: it is a
 * wrong team sheet on the one page somebody checks before setting off.
 *
 * A shortlist is written in board order and runs past the boards into the
 * reserves, which is what lets it answer both questions at once: the first four
 * play, in the order given, and the rest are next in line. With no shortlist
 * the rule picks the four and `assignBoards` orders them on rating, which is
 * the normal case and stays untouched.
 *
 * A dropout is handled exactly as it is in selection, and for the same reason:
 * the player is taken out of the order that already existed and everybody below
 * moves up one place. Nothing is re-decided, so somebody who was told they were
 * playing cannot lose their board to a recalculation.
 *
 * What is deliberately not done here is re-running selection. The rule's answer
 * stays as it was and is shown beside this, so an override reads as a decision
 * somebody made rather than as an outcome the rule produced.
 */
export function fieldedFor(season: Season, match: Match, selection: Selection): Fielded {
  const byId = new Map(season.players.map((player) => [player.id, player]));
  const look = (ids: string[]): Player[] => ids.map((id) => byId.get(id)).filter((p) => p !== undefined);

  const ruled = selection.boardPlayers.map((player) => player.playerId);

  if (!match.lineup) {
    return {
      players: look(ruled),
      reserves: look(selection.reservePlayers.map((player) => player.playerId)),
      fromRule: true,
      ordered: false,
      added: [],
      dropped: [],
      withdrawn: look(selection.withdrawn.map((player) => player.playerId)),
      unfilled: selection.unfilled,
      note: undefined,
    };
  }

  const shortlist = match.lineup.playerIds;
  const out = shortlist.filter((id) => withdrawalOf(match, id) !== null);
  const standing = shortlist.filter((id) => !out.includes(id));

  const playing = standing.slice(0, season.boards);
  const onBoard = new Set(playing);
  const picked = new Set(ruled);

  // A shortlist that stops at the boards says who plays and nothing about who
  // is next, so the rule still supplies the reserves. Emptying them instead
  // would quietly tell the squad there were none, which is a different and
  // untrue statement.
  const named = standing.slice(season.boards, season.boards + season.reserves);
  const reserves =
    named.length > 0
      ? named
      : selection.order
          .filter((player) => !onBoard.has(player.playerId))
          .slice(0, season.reserves)
          .map((player) => player.playerId);

  return {
    players: look(playing),
    reserves: look(reserves),
    fromRule: playing.length === ruled.length && ruled.every((id) => onBoard.has(id)),
    ordered: true,
    added: look(playing.filter((id) => !picked.has(id))),
    dropped: look(ruled.filter((id) => !onBoard.has(id))),
    withdrawn: look(out),
    unfilled: Math.max(0, season.boards - playing.length),
    note: match.lineup.note,
  };
}

export interface PlayerStats {
  player: Player;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  rating: Rating | null;
}

/**
 * The most recent rating on or before a date, or null for an unrated player.
 *
 * Unrated is a real state here, not a missing value. Several members have never
 * had a published grade, and defaulting them to zero would sort them below
 * everybody and read as a claim about their strength.
 */
export function ratingOn(player: Player, date?: string): Rating | null {
  const eligible = date ? player.ratings.filter((rating) => rating.date <= date) : player.ratings;
  return eligible.at(-1) ?? null;
}

export function statsFor(season: Season): PlayerStats[] {
  const byPlayer = new Map<string, Game[]>(season.players.map((player) => [player.id, []]));
  for (const match of season.matches) {
    for (const game of match.result?.games ?? []) {
      byPlayer.get(game.playerId)?.push(game);
    }
  }

  return season.players.map((player) => {
    const games = byPlayer.get(player.id) ?? [];
    return {
      player,
      played: games.length,
      points: games.reduce((total, game) => total + GAME_POINTS[game.result], 0),
      wins: games.filter((game) => game.result === "win" || game.result === "default-win").length,
      draws: games.filter((game) => game.result === "draw").length,
      losses: games.filter((game) => game.result === "loss" || game.result === "default-loss").length,
      rating: ratingOn(player),
    };
  });
}

/**
 * How evenly the games have gone round, which is the thing the whole system
 * exists to get right and therefore the thing worth putting on the front page.
 */
export function coverage(season: Season) {
  const stats = statsFor(season);
  const counts = stats.map((entry) => entry.played);
  const played = season.matches.filter((match) => match.status === "played").length;
  return {
    players: stats.length,
    slots: season.matches.length * season.boards,
    filled: counts.reduce((total, count) => total + count, 0),
    fewest: counts.length > 0 ? Math.min(...counts) : 0,
    most: counts.length > 0 ? Math.max(...counts) : 0,
    unplayed: stats.filter((entry) => entry.played === 0).length,
    matchesPlayed: played,
  };
}

export function nextMatch(season: Season, today: string): Match | undefined {
  return orderedMatches(season).find((match) => match.status === "scheduled" && match.date >= today);
}

/** A chess score. A bare half is "½", not "0½": there is no whole part to print. */
export function formatPoints(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const whole = Math.floor(value);
  return whole === 0 ? "½" : `${whole}½`;
}

/** Our score first, which is how the site reads everywhere. */
export function matchScore(match: Match): string | null {
  if (!match.result) return null;
  return `${formatPoints(match.result.ourScore)} - ${formatPoints(match.result.theirScore)}`;
}
