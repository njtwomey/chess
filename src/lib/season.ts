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

export function matchScore(match: Match): string | null {
  if (!match.result) return null;
  const format = (value: number) => (Number.isInteger(value) ? String(value) : `${Math.floor(value)}½`);
  return `${format(match.result.ourScore)} - ${format(match.result.theirScore)}`;
}
