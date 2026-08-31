/**
 * Board order and clocks.
 *
 * Deliberately a separate file from `selection.ts`, because these answer
 * different questions and are decided by different rules. Selection answers who
 * plays, and its rule is the club's own promise about spreading games around.
 * Board order answers where those four sit, and its rule is the league's:
 * strongest on board one, descending. Running them together would let a rating
 * leak into the fairness decision, which is the one thing the captain said the
 * system must not do.
 */
import { ratingOn } from "@/lib/season";
import type { Clock, Player, Rating, TimeControl } from "@/lib/schema";

export function formatClock(clock: Clock): string {
  return `${clock.minutes}+${clock.increment}`;
}

export interface BoardClock {
  clock: Clock;
  /**
   * False when the answer depends on an opponent we have not met yet. An adult
   * board becomes a junior board the moment the other club fields a child, and
   * the site should say "unless" rather than state the long clock as settled.
   */
  certain: boolean;
  junior: boolean;
}

/**
 * The shorter clock belongs to the board, not to the child.
 *
 * One junior anywhere on the board shortens it for both players, so an adult
 * can find themselves on 55+10. Passing the opponent's status as `null` rather
 * than `false` is what keeps "we do not know yet" distinct from "we know they
 * are not", and those two produce different sentences on screen.
 */
export function clockFor(control: TimeControl, ourJunior: boolean, theirJunior: boolean | null): BoardClock {
  if (ourJunior || theirJunior === true) return { clock: control.junior, certain: true, junior: true };
  if (theirJunior === null) return { clock: control.standard, certain: false, junior: false };
  return { clock: control.standard, certain: true, junior: false };
}

export interface BoardAssignment {
  board: number;
  player: Player;
  rating: Rating | null;
  clock: BoardClock;
}

/**
 * Strongest first, which is the league's requirement rather than a preference.
 *
 * Unrated players go below every rated one. That is an assumption and it is the
 * conservative one: an unrated player cannot be shown to belong above a graded
 * player, and a board order that overstates someone is the kind that gets
 * challenged, and where it is wrong the order is set by hand in the data.
 *
 * Ties break alphabetically, and deliberately not on the seeded value the
 * selection uses. A coin toss is the right answer to "who gets a game", because
 * there the alternative is a bias nobody chose. It is the wrong answer to "who
 * sits at board two", because that question has no fairness in it and an
 * arbitrary answer is simply one nobody can explain. Alphabetical is at least a
 * convention, and with several unrated players it is the whole order.
 */
export function assignBoards(
  players: Player[],
  options: { timeControl: TimeControl; onDate?: string },
): BoardAssignment[] {
  const scored = players.map((player) => ({ player, rating: ratingOn(player, options.onDate) }));

  scored.sort((a, b) => {
    // Rated above unrated, then by rating descending.
    if ((a.rating === null) !== (b.rating === null)) return a.rating === null ? 1 : -1;
    if (a.rating && b.rating && a.rating.rating !== b.rating.rating) return b.rating.rating - a.rating.rating;
    return a.player.name.localeCompare(b.player.name);
  });

  return scored.map((entry, index) => ({
    board: index + 1,
    player: entry.player,
    rating: entry.rating,
    clock: clockFor(options.timeControl, entry.player.junior, null),
  }));
}

/**
 * The usual convention: the home team has White on the odd boards.
 *
 * A preview only. Once a match is played the colours come from the result,
 * because the captains can and do agree something else on the night.
 */
export function expectedColour(home: boolean, board: number): "white" | "black" {
  const oddBoard = board % 2 === 1;
  return home === oddBoard ? "white" : "black";
}
