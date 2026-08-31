/**
 * Who plays. The one rule the club agreed, in one pure function.
 *
 * The captain published this before the season started: where more people are
 * available than there are boards, priority goes to whoever has played fewest
 * games. Everything here follows from that promise, including the parts that
 * look fussy. Nothing in this file reads a clock, a rating, a file or a random
 * number generator, so a selection can be recomputed months later from the data
 * as it stood and will come out the same.
 */
import { tiebreakValue } from "@/lib/rng";

/** The four options the captain puts to the team, best offer first. */
export const REPLIES = ["yes", "reserve", "unsure", "no"] as const;
export type Reply = (typeof REPLIES)[number];

export const REPLY_LABEL: Record<Reply, string> = {
  yes: "Can play",
  reserve: "Can be a reserve",
  unsure: "Not sure yet",
  no: "Cannot play",
};

/**
 * Only these can be picked, and their order here is the first sort key.
 *
 * Offering to be a reserve is not a quieter way of saying yes. Somebody who
 * picks it is saying they will step in if needed, and there is usually a reason
 * they did not simply say yes: a clash they might get out of, a long week, a
 * preference not to play this one. Treating that as an equal claim on a board
 * would repay the more accommodating answer by giving them a game they did not
 * ask for, and would take one from somebody who did.
 *
 * So every `yes` goes ahead of every `reserve`, regardless of games played. The
 * fairness rule then runs inside each group.
 *
 * "Not sure" is never selected, however short the team is. It is a prompt to go
 * and ask someone, not a maybe for the algorithm to resolve on their behalf,
 * and putting an unconfirmed player on a board is how a team turns up with
 * three.
 */
const SELECTABLE = ["yes", "reserve"] as const;

export function isSelectable(reply: Reply): boolean {
  return (SELECTABLE as readonly Reply[]).includes(reply);
}

function replyRank(reply: Reply): number {
  const index = (SELECTABLE as readonly Reply[]).indexOf(reply);
  return index === -1 ? SELECTABLE.length : index;
}

export interface Candidate {
  playerId: string;
  reply: Reply;
  /** Games played earlier in this season. Derived, never hand-maintained. */
  gamesPlayed: number;
  /** Offered, then pulled out. Keeps the original reply; see `select`. */
  withdrawn?: boolean;
}

/** Where a player ended up. `standby` is selectable but below the last reserve. */
export type Role = "board" | "reserve" | "standby" | "withdrawn" | "unavailable";

export const ROLE_LABEL: Record<Role, string> = {
  board: "Playing",
  reserve: "Reserve",
  // Not "Not needed": these people offered, and the reason they are here is
  // that other people had played fewer games. Saying they were not needed
  // reads as a judgement on them rather than as arithmetic.
  standby: "Not this time",
  withdrawn: "Dropped out",
  unavailable: "Unavailable",
};

export interface Ranked extends Candidate {
  tiebreak: number;
  /** 1-based place among the players still available, or null if not one. */
  position: number | null;
  /**
   * 1-based place in the order as it stood before anybody pulled out.
   *
   * Kept so the site can show a dropout where they were rather than deleting
   * them from the story, and so a promotion is visible as a move rather than
   * as an unexplained new name.
   */
  standingPosition: number | null;
  role: Role;
}

export interface SelectionInput {
  matchId: string;
  seed: string;
  boards: number;
  reserves: number;
  candidates: Candidate[];
}

export interface Selection extends Omit<SelectionInput, "candidates"> {
  /**
   * Everyone who offered, in the order the rule produced, dropouts included and
   * still in their original places. This is the ordering; `order` is what is
   * left of it.
   */
  standing: Ranked[];
  /** The players still available, in that same order. */
  order: Ranked[];
  boardPlayers: Ranked[];
  reservePlayers: Ranked[];
  standby: Ranked[];
  withdrawn: Ranked[];
  /** Players a dropout moved up: onto a board, or into the reserves. */
  promoted: Ranked[];
  unavailable: Ranked[];
  /** Boards with nobody to fill them. Reported, never quietly ignored. */
  unfilled: number;
}

/** The sort keys, in the order they apply. Exported because the UI names them. */
export const KEYS = ["reply", "games", "tiebreak", "id"] as const;
export type Key = (typeof KEYS)[number];

/**
 * Each of these completes "above the player below because they…", so every one
 * of them has to name the comparison rather than just a property. "Said yes"
 * on its own reads as a fact about the player; "said yes, and the next only
 * offered to reserve" reads as the reason they are in that order, which is the
 * question being asked.
 */
export const KEY_LABEL: Record<Key, string> = {
  reply: "said yes, and the next only offered to reserve",
  games: "have played fewer games",
  tiebreak: "won the seeded coin toss",
  id: "come first alphabetically, after a tie on everything else",
};

/**
 * Which key separated two players. Used to show the working beside a
 * selection, so nobody has to take the ordering on trust.
 */
export function decidingKey(a: Ranked, b: Ranked): Key {
  if (replyRank(a.reply) !== replyRank(b.reply)) return "reply";
  if (a.gamesPlayed !== b.gamesPlayed) return "games";
  if (a.tiebreak !== b.tiebreak) return "tiebreak";
  return "id";
}

/**
 * The ordering, in full.
 *
 * 1. `yes` ahead of `reserve`, always. Offering to stand in is taken at face
 *    value: it forgoes priority to the people who said they want to play. It is
 *    not a tiebreaker, it is the first question asked, so somebody who said yes
 *    and has played three games is still ahead of a reserve who has played none.
 * 2. Fewest games first. The club's fairness rule, applied inside each group,
 *    which is where it does its work: the boards go to the least-played of the
 *    people who actually asked for a game.
 * 3. The seeded tiebreak.
 * 4. Player id, so the order is total. Two players can collide on a 32-bit hash,
 *    and without a final key the result would then depend on whether the
 *    engine's sort happened to be stable.
 */
export function compareRanked(a: Ranked, b: Ranked): number {
  const byReply = replyRank(a.reply) - replyRank(b.reply);
  if (byReply !== 0) return byReply;
  if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
  if (a.tiebreak !== b.tiebreak) return a.tiebreak - b.tiebreak;
  return byId(a, b);
}

function byId(a: { playerId: string }, b: { playerId: string }): number {
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}

/** Which band a 0-based place in the order falls into. */
function bandAt(index: number, boards: number, reserves: number): Role {
  if (index < boards) return "board";
  if (index < boards + reserves) return "reserve";
  return "standby";
}

/**
 * Boards and reserves come out of a single ordering rather than two passes.
 *
 * Two passes is the obvious implementation and it is wrong. Picking four from
 * the `yes` replies and then ranking the reserves separately loses the fact
 * that an unpicked `yes` and a declared reserve are competing for the same
 * place, and it is precisely that overspill case the captain was asked about.
 * One ordering answers it by construction.
 *
 * A dropout does not re-run any of this. The order is built once from what
 * people said, and pulling out removes that one person from it: everybody below
 * moves up exactly one place, so the top reserve takes the empty board. This is
 * the whole reason a withdrawal is recorded as a withdrawal rather than as a
 * "no". Re-deciding from scratch could reshuffle a tie that was already settled
 * and hand a board to somebody who had been told they were not playing, which
 * is precisely the kind of surprise this system exists to avoid.
 */
export function select({ matchId, seed, boards, reserves, candidates }: SelectionInput): Selection {
  if (boards < 0 || reserves < 0) throw new Error(`select: ${matchId} asks for a negative number of places`);

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.playerId)) {
      throw new Error(`select: ${candidate.playerId} replied twice for ${matchId}`);
    }
    if (!Number.isInteger(candidate.gamesPlayed) || candidate.gamesPlayed < 0) {
      throw new Error(`select: ${candidate.playerId} has an impossible game count for ${matchId}`);
    }
    seen.add(candidate.playerId);
  }

  const scored: Ranked[] = candidates.map((candidate) => ({
    ...candidate,
    tiebreak: tiebreakValue(seed, matchId, candidate.playerId),
    position: null,
    standingPosition: null,
    role: "unavailable",
  }));

  // Everyone who offered, dropouts included. Sort keys depend only on the
  // player, so removing one below cannot change the order of the rest.
  const standing = scored.filter((player) => isSelectable(player.reply)).sort(compareRanked);
  standing.forEach((player, index) => {
    player.standingPosition = index + 1;
  });

  const order = standing.filter((player) => !player.withdrawn);
  order.forEach((player, index) => {
    player.position = index + 1;
    player.role = bandAt(index, boards, reserves);
  });

  const withdrawn = standing.filter((player) => player.withdrawn);
  for (const player of withdrawn) player.role = "withdrawn";

  const unavailable = scored.filter((player) => !isSelectable(player.reply)).sort(byId);

  return {
    matchId,
    seed,
    boards,
    reserves,
    standing,
    order,
    boardPlayers: order.filter((player) => player.role === "board"),
    reservePlayers: order.filter((player) => player.role === "reserve"),
    standby: order.filter((player) => player.role === "standby"),
    withdrawn,
    // Somebody moved up only if a dropout carried them across a line, which is
    // a stronger claim than merely shifting a place.
    promoted: order.filter(
      (player) =>
        player.standingPosition !== null && player.role !== bandAt(player.standingPosition - 1, boards, reserves),
    ),
    unavailable,
    unfilled: Math.max(0, boards - order.length),
  };
}

/**
 * The selection as sentences, for pasting into the group chat.
 *
 * The captain has to explain this to real people every fortnight, and an
 * explanation generated by the same function that made the decision cannot
 * drift from it the way a hand-typed message would.
 */
export function explain(selection: Selection, nameOf: (playerId: string) => string): string[] {
  const lines: string[] = [];
  const list = (players: Ranked[]) => players.map((player) => nameOf(player.playerId)).join(", ");

  if (selection.boardPlayers.length > 0) lines.push(`Playing: ${list(selection.boardPlayers)}.`);

  if (selection.withdrawn.length > 0) {
    const who = list(selection.withdrawn);
    const moved = selection.promoted.length > 0 ? ` ${list(selection.promoted)} moves up.` : "";
    lines.push(`${who} has had to drop out, so everybody below moves up one place.${moved}`);
  }

  if (selection.unfilled > 0) {
    const boards = selection.unfilled === 1 ? "board" : "boards";
    lines.push(`${selection.unfilled} ${boards} still unfilled. If you can make it, please say so.`);
  }

  if (selection.reservePlayers.length > 0) lines.push(`Reserves, in this order: ${list(selection.reservePlayers)}.`);

  if (selection.standby.length > 0) {
    lines.push(`Not this time: ${list(selection.standby)}. You go to the front of the queue next match.`);
  }

  // The one comparison anybody actually argues about: who got the last board,
  // and who missed out by a place. Only worth saying when somebody who asked
  // for a game did not get one; otherwise it explains a contest nobody was in.
  const last = selection.boardPlayers.at(-1);
  const next = selection.reservePlayers[0] ?? selection.standby[0];
  const displaced = selection.order.some((player) => player.role !== "board" && player.reply === "yes");
  if (last && next && displaced) {
    const why = {
      reply: "offered to stand in rather than asking for a game",
      games: "has played more games",
      tiebreak: "lost the seeded coin toss",
      id: "lost an exact tie on every key",
    }[decidingKey(last, next)];
    lines.push(`${nameOf(last.playerId)} took the last board ahead of ${nameOf(next.playerId)}, who ${why}.`);
  }

  const unsure = selection.unavailable.filter((player) => player.reply === "unsure");
  if (unsure.length > 0) lines.push(`Still to hear from: ${list(unsure)}.`);

  return lines;
}
