/**
 * The captain's overrides, which sit between the rule and the team sheet.
 *
 * `selection.test.ts` covers the rule itself. What is checked here is the layer
 * on top: that writing a team down replaces the rule's answer without silently
 * rewriting it, that the order written down is the order used, and that a
 * dropout out of a shortlist behaves exactly as a dropout out of the rule's
 * ordering does. Getting that last one wrong would re-decide a settled place.
 */
import { describe, expect, it } from "vitest";
import { assignBoards } from "@/lib/boards";
import { selectedTeam } from "@/lib/messages";
import { boardExceptions, boardsFor, coverage, fieldedFor, roleFor, selectionFor, sheetOrder } from "@/lib/season";
import type { Match } from "@/lib/schema";
import { aMatch, aSeason, aSquad, ours, said, theirs } from "@/lib/testing";

/**
 * Built rather than read from a season on disk.
 *
 * Nine players reply, one of them withdraws after being picked, one is not
 * selectable, and there are more volunteers than boards. That is every shape
 * these functions have to deal with, held still, so recording a real reply
 * cannot change what this file is testing.
 */
const base = aMatch({
  number: 1,
  availability: [
    said(ours("p1"), "yes"),
    said(ours("p2"), "yes"),
    said(ours("p3"), "yes"),
    said(ours("p4"), "yes"),
    said(ours("p5"), "yes"),
    said(ours("p6"), "yes", { withdrawn: { at: "2026-03-08" } }),
    said(ours("p7"), "reserve"),
    said(ours("p8"), "reserve"),
    said(ours("p9"), "unsure"),
  ],
});
const season = aSeason({ players: aSquad(9), matches: [base] });

/** The same fixture, with a team written down on it. */
const withLineup = (playerIds: string[], note?: string): Match => ({
  ...base,
  settled: true,
  lineup: { playerIds, ...(note === undefined ? {} : { note }) },
});

const names = (players: { name: string }[]) => players.map((player) => player.name);
const rule = selectionFor(season, base);
const ruled = rule.boardPlayers.map((player) => player.playerId);

describe("fieldedFor, with no team written down", () => {
  const fielded = fieldedFor(season, base, rule);

  it("is simply what the rule produced, and says so", () => {
    expect(fielded.fromRule).toBe(true);
    expect(fielded.ordered).toBe(false);
    expect(fielded.added).toEqual([]);
    expect(fielded.dropped).toEqual([]);
    expect(fielded.players.map((player) => player.playerId)).toEqual(ruled);
  });

  it("still reports the dropouts the rule knew about", () => {
    // Losing them here would mean a withdrawal vanished from the group message
    // the moment this layer was introduced.
    expect(fielded.withdrawn.map((player) => player.playerId)).toEqual(rule.withdrawn.map((player) => player.playerId));
  });
});

describe("fieldedFor, with a team written down", () => {
  it("fields exactly who is named, in the order they are named", () => {
    const shortlist = [...ruled].reverse();
    const fielded = fieldedFor(season, withLineup(shortlist), rule);
    expect(fielded.players.map((player) => player.playerId)).toEqual(shortlist);
    expect(fielded.ordered).toBe(true);
  });

  it("is still the rule's team when it names the rule's players in another order", () => {
    // The four are the rule's; only the board order was decided by hand. Saying
    // somebody was overridden here would accuse the captain of something he did
    // not do.
    const fielded = fieldedFor(season, withLineup([...ruled].reverse()), rule);
    expect(fielded.fromRule).toBe(true);
    expect(fielded.added).toEqual([]);
    expect(fielded.dropped).toEqual([]);
  });

  it("names who came in and who lost their place", () => {
    const standby = rule.standby[0]!.playerId;
    const shortlist = [...ruled.slice(0, 3), standby];
    const fielded = fieldedFor(season, withLineup(shortlist), rule);

    expect(fielded.fromRule).toBe(false);
    expect(fielded.added.map((player) => player.playerId)).toEqual([standby]);
    expect(fielded.dropped.map((player) => player.playerId)).toEqual([ruled[3]]);
  });

  it("carries the captain's reason", () => {
    const fielded = fieldedFor(season, withLineup(ruled, "Gwen is driving."), rule);
    expect(fielded.note).toBe("Gwen is driving.");
  });

  it("takes the reserves from beyond the boards", () => {
    const shortlist = [...ruled, ...rule.reservePlayers.map((player) => player.playerId)];
    const fielded = fieldedFor(season, withLineup(shortlist), rule);
    expect(fielded.reserves.map((player) => player.playerId)).toEqual(shortlist.slice(season.boards));
  });

  it("reports a short shortlist rather than quietly fielding three", () => {
    const fielded = fieldedFor(season, withLineup(ruled.slice(0, 2)), rule);
    expect(fielded.players).toHaveLength(2);
    expect(fielded.unfilled).toBe(season.boards - 2);
  });
});

describe("a dropout out of a written-down team", () => {
  // The one property that matters: nobody is re-ranked. Whoever was below the
  // player who pulled out moves up exactly one place, and nobody else moves.
  const gone = base.availability.find((entry) => entry.withdrawn)!.playerId;
  const others = season.players.map((player) => player.playerId).filter((id) => id !== gone);
  const shortlist = [others[0]!, gone, ...others.slice(1, 5)];
  const fielded = fieldedFor(season, withLineup(shortlist), rule);

  it("takes them out and moves everybody below up one place", () => {
    const survivors = shortlist.filter((id) => id !== gone);
    expect(fielded.players.map((player) => player.playerId)).toEqual(survivors.slice(0, season.boards));
    expect(fielded.reserves.map((player) => player.playerId)).toEqual(
      survivors.slice(season.boards, season.boards + season.reserves),
    );
  });

  it("keeps them on the record rather than deleting them", () => {
    expect(fielded.withdrawn.map((player) => player.playerId)).toEqual([gone]);
  });
});

describe("the group message follows the team that is actually being fielded", () => {
  it("names the written-down team, not the rule's", () => {
    const standby = rule.standby[0]!.playerId;
    const shortlist = [...ruled.slice(0, 3), standby];
    const match = withLineup(shortlist, "Ada is away, so Hollis steps in.");
    const message = selectedTeam(season, match, rule);

    const fielded = fieldedFor(season, match, rule);
    expect(message).toContain(`Playing: ${names(fielded.players).join(", ")}.`);
    expect(message).toContain("Ada is away, so Hollis steps in.");
  });

  it("still names the rule's team when nothing was overridden", () => {
    const fielded = fieldedFor(season, base, rule);
    expect(selectedTeam(season, base, rule)).toContain(`Playing: ${names(fielded.players).join(", ")}.`);
  });
});

describe("a shortlist that names only the boards", () => {
  // The captain writing down four names is saying who plays, not that there
  // are no reserves.
  const shortlist = [...ruled.slice(0, 3), rule.standby[0]!.playerId];
  const fielded = fieldedFor(season, withLineup(shortlist), rule);

  it("leaves the reserves to the rule", () => {
    const expected = rule.order
      .filter((player) => !shortlist.includes(player.playerId))
      .slice(0, season.reserves)
      .map((player) => player.playerId);
    expect(fielded.reserves.map((player) => player.playerId)).toEqual(expected);
    expect(fielded.reserves.length).toBeGreaterThan(0);
  });

  it("never puts somebody on a board and in the reserves at once", () => {
    const boards = new Set(fielded.players.map((player) => player.playerId));
    expect(fielded.reserves.filter((player) => boards.has(player.playerId))).toEqual([]);
  });
});

/**
 * The two tables a match page shows, checked against each other.
 *
 * One lists everybody who replied with what became of them; the other lists the
 * four boards. They are drawn from the same data but by different code, and the
 * failure that matters is not either being wrong on its own: it is them
 * disagreeing, so that a player reads "Playing" in one and is absent from the
 * other. Every assertion here is about the pair.
 */
describe("the selection table and the board order agree", () => {
  const boardsOf = (match: Match) => {
    const rule = selectionFor(season, match);
    const fielded = fieldedFor(season, match, rule);
    return {
      rule,
      fielded,
      /** Who the selection table shows as playing. */
      playing: rule.standing.filter((player) => roleFor(fielded, player) === "board").map((p) => p.playerId),
      /** Who the board order table lists. */
      onBoards: assignBoards(fielded.players, {
        timeControl: season.timeControl,
        onDate: match.date,
        keepOrder: fielded.ordered,
      }).map((entry) => entry.player.playerId),
    };
  };

  it("names the same four, whether or not a team was written down", () => {
    for (const match of [
      base,
      withLineup([...ruled].reverse()),
      withLineup([...ruled.slice(0, 3), rule.standby[0]!.playerId]),
    ]) {
      const { playing, onBoards } = boardsOf(match);
      expect([...playing].sort()).toEqual([...onBoards].sort());
    }
  });

  it("follows the written team rather than the rule when the two differ", () => {
    const standby = rule.standby[0]!.playerId;
    const shortlist = [...ruled.slice(0, 3), standby];
    const { playing, onBoards, fielded } = boardsOf(withLineup(shortlist));

    expect([...playing].sort()).toEqual([...shortlist].sort());
    expect(onBoards).toEqual(shortlist);
    // The player the rule picked and the captain did not is shown as not playing.
    expect(playing).not.toContain(ruled[3]);
    expect(fielded.fromRule).toBe(false);
  });

  it("never shows anybody as playing and as a reserve at once", () => {
    for (const match of [base, withLineup([...ruled, ...rule.reservePlayers.map((p) => p.playerId)])]) {
      const { rule: r, fielded } = boardsOf(match);
      const roles = r.standing.map((player) => [player.playerId, roleFor(fielded, player)] as const);
      const playing = roles.filter(([, role]) => role === "board").map(([id]) => id);
      const reserves = roles.filter(([, role]) => role === "reserve").map(([id]) => id);
      expect(playing.filter((id) => reserves.includes(id))).toEqual([]);
      expect(new Set(playing).size).toBe(playing.length);
    }
  });

  it("leaves a dropout and an unselectable player as the rule found them", () => {
    // Neither is a fact about the team sheet: they are facts about the replies,
    // and a hand-written team cannot make somebody available again.
    const { rule: r, fielded } = boardsOf(base);
    for (const player of r.withdrawn) expect(roleFor(fielded, player)).toBe("withdrawn");
    for (const player of r.unavailable) expect(roleFor(fielded, player)).toBe("unavailable");
  });

  it("shows every player exactly once between the two tables", () => {
    const { rule: r, onBoards } = boardsOf(withLineup([...ruled.slice(0, 3), rule.standby[0]!.playerId]));
    const counted = [...r.standing, ...r.unavailable].map((player) => player.playerId);
    expect(new Set(counted).size).toBe(counted.length);
    for (const id of onBoards) expect(counted).toContain(id);
  });
});

describe("the order a team sheet reads in", () => {
  it("is the rule's own order when no team has been written down", () => {
    const fielded = fieldedFor(season, base, rule);
    expect(sheetOrder(rule, fielded)).toEqual(rule.standing);
  });

  it("leads with the team, in board order, once one has been written down", () => {
    const shortlist = [...ruled.slice(0, 3), rule.standby[0]!.playerId];
    const match = withLineup(shortlist);
    const fielded = fieldedFor(season, match, rule);
    const rows = sheetOrder(rule, fielded);

    expect(rows.slice(0, shortlist.length).map((player) => player.playerId)).toEqual(shortlist);
    // And every one of those rows says Playing, so the cut line lands right.
    for (const player of rows.slice(0, season.boards)) expect(roleFor(fielded, player)).toBe("board");
  });

  it("puts the reserves next, then leaves everybody else in the rule's order", () => {
    const shortlist = [...ruled.slice(0, 3), rule.standby[0]!.playerId];
    const fielded = fieldedFor(season, withLineup(shortlist), rule);
    const rows = sheetOrder(rule, fielded);

    const reserves = rows.slice(season.boards, season.boards + fielded.reserves.length);
    expect(reserves.map((player) => player.playerId)).toEqual(fielded.reserves.map((player) => player.playerId));

    const rest = rows.slice(season.boards + fielded.reserves.length).map((player) => player.playerId);
    const asRuled = rule.standing.map((player) => player.playerId).filter((id) => rest.includes(id));
    expect(rest).toEqual(asRuled);
  });

  it("loses nobody and duplicates nobody, whichever order it is in", () => {
    for (const match of [base, withLineup([...ruled].reverse())]) {
      const fielded = fieldedFor(season, match, rule);
      const rows = sheetOrder(rule, fielded).map((player) => player.playerId);
      expect([...rows].sort()).toEqual(rule.standing.map((player) => player.playerId).sort());
    }
  });
});

describe("a played fixture reads the same way", () => {
  // It used not to: the reordering was skipped once a result existed, which
  // left the rule's order sitting under a line drawn where the captain's boards
  // stopped, and the two disagreed on every fixture he had changed.
  it("leads with the team that played, whatever the rule had said", () => {
    const shortlist = [...ruled.slice(0, 3), rule.standby[0]!.playerId];
    const played: Match = {
      ...withLineup(shortlist),
      status: "played",
      result: {
        ourScore: 2,
        theirScore: 2,
        games: shortlist.map((playerId, index) => ({
          board: index + 1,
          playerId,
          opponentId: theirs("them-1"),
          colour: index % 2 === 0 ? ("white" as const) : ("black" as const),
          result: "draw" as const,
          pgn: null,
        })),
      },
    };
    const fielded = fieldedFor(season, played, rule);
    const rows = sheetOrder(rule, fielded).map((player) => player.playerId);
    expect(rows.slice(0, shortlist.length)).toEqual(shortlist);
  });
});

/**
 * A fixture played over more boards than the division's usual number.
 *
 * Two captains can agree a longer match, and when they do it is not a cosmetic
 * difference: the rule hands out every board there is, so a longer match means
 * more people get a game. The thing that must not happen is the lengthening
 * re-deciding anything, because the order was already settled and somebody has
 * already been told where they stand.
 *
 * Its own squad, big enough that six boards still leaves two reserves behind
 * them: on the nine-player fixture above there would be nobody left to be one,
 * which is a true answer to a different question.
 */
describe("a fixture with its own number of boards", () => {
  const replies = Array.from({ length: 10 }, (_, index) => said(ours(`q${index + 1}`), "yes"));
  const squad = aSquad(10, (index) => ({ playerId: `q${index + 1}` }));
  const four = aMatch({ number: 1, availability: replies });
  const six = aMatch({ ...four, boards: 6 });
  const shortSeason = aSeason({ players: squad, matches: [four] });
  const longSeason = aSeason({ players: squad, matches: [six] });
  const short = selectionFor(shortSeason, four);
  const long = selectionFor(longSeason, six);
  const ids = (players: { playerId: string }[]) => players.map((player) => player.playerId);

  it("falls back to the season, and takes the match's where there is one", () => {
    expect(boardsFor(shortSeason, four)).toBe(4);
    expect(boardsFor(longSeason, six)).toBe(6);
    // Set to what the season already says, which is not an exception.
    expect(boardExceptions(aSeason({ matches: [aMatch({ boards: 4 })] }))).toEqual([]);
    expect(boardExceptions(longSeason).map((match) => match.number)).toEqual([six.number]);
  });

  it("puts two more people on boards without reordering anybody", () => {
    // The whole order, identical. Only the band each player falls in changes,
    // which is what makes lengthening a match safe to do late.
    expect(ids(long.order)).toEqual(ids(short.order));
    expect(ids(long.boardPlayers)).toEqual(ids(short.order).slice(0, 6));
    expect(ids(short.boardPlayers)).toEqual(ids(short.order).slice(0, 4));
  });

  it("moves the reserves down rather than leaving them where they were", () => {
    expect(ids(long.reservePlayers)).toHaveLength(longSeason.reserves);
    expect(ids(long.reservePlayers)).toEqual(ids(short.order).slice(6, 8));
    // Both of the old reserves are on a board now, so nobody has been skipped.
    expect(ids(short.reservePlayers).every((id) => ids(long.boardPlayers).includes(id))).toBe(true);
  });

  it("fields a shortlist that names all six, in the order written", () => {
    const shortlist = ids(long.boardPlayers).toReversed();
    const fielded = fieldedFor(longSeason, { ...six, settled: true, lineup: { playerIds: shortlist } }, long);

    expect(ids(fielded.players)).toEqual(shortlist);
    expect(fielded.unfilled).toBe(0);
    // Same six as the rule, so this is an order rather than a change of team.
    expect(fielded.added).toEqual([]);
    expect(fielded.dropped).toEqual([]);
    expect(ids(fielded.reserves)).toEqual(ids(long.reservePlayers));
  });

  it("reports the boards a four-name shortlist leaves empty", () => {
    const shortlist = ids(long.boardPlayers).slice(0, 4);
    const fielded = fieldedFor(longSeason, { ...six, settled: true, lineup: { playerIds: shortlist } }, long);
    expect(fielded.unfilled).toBe(2);
  });

  it("counts the longer match's boards towards the season's games to go round", () => {
    const mixed = aSeason({ players: squad, matches: [four, aMatch({ ...four, number: 2, boards: 6 })] });
    expect(coverage(mixed).slots).toBe(10);
  });
});
