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
import { fieldedFor, roleFor, selectionFor, sheetOrder } from "@/lib/season";
import type { Match } from "@/lib/schema";
import { aMatch, aSeason, aSquad, aVenue, said } from "@/lib/testing";

/**
 * Built rather than read from a season on disk.
 *
 * Nine players reply, one of them withdraws after being picked, one is not
 * selectable, and there are more volunteers than boards. That is every shape
 * these functions have to deal with, held still, so recording a real reply
 * cannot change what this file is testing.
 */
const base = aMatch({
  id: "r1",
  availability: [
    said("p1", "yes"),
    said("p2", "yes"),
    said("p3", "yes"),
    said("p4", "yes"),
    said("p5", "yes"),
    said("p6", "yes", { withdrawn: { at: "2026-03-08" } }),
    said("p7", "reserve"),
    said("p8", "reserve"),
    said("p9", "unsure"),
  ],
});
const venue = aVenue({ id: "our-venue", name: "Our Chess Club" });
const venues = new Map([[venue.id, venue]]);
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
    expect(fielded.players.map((player) => player.id)).toEqual(ruled);
  });

  it("still reports the dropouts the rule knew about", () => {
    // Losing them here would mean a withdrawal vanished from the group message
    // the moment this layer was introduced.
    expect(fielded.withdrawn.map((player) => player.id)).toEqual(rule.withdrawn.map((player) => player.playerId));
  });
});

describe("fieldedFor, with a team written down", () => {
  it("fields exactly who is named, in the order they are named", () => {
    const shortlist = [...ruled].reverse();
    const fielded = fieldedFor(season, withLineup(shortlist), rule);
    expect(fielded.players.map((player) => player.id)).toEqual(shortlist);
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
    expect(fielded.added.map((player) => player.id)).toEqual([standby]);
    expect(fielded.dropped.map((player) => player.id)).toEqual([ruled[3]]);
  });

  it("carries the captain's reason", () => {
    const fielded = fieldedFor(season, withLineup(ruled, "Gwen is driving."), rule);
    expect(fielded.note).toBe("Gwen is driving.");
  });

  it("takes the reserves from beyond the boards", () => {
    const shortlist = [...ruled, ...rule.reservePlayers.map((player) => player.playerId)];
    const fielded = fieldedFor(season, withLineup(shortlist), rule);
    expect(fielded.reserves.map((player) => player.id)).toEqual(shortlist.slice(season.boards));
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
  const others = season.players.map((player) => player.id).filter((id) => id !== gone);
  const shortlist = [others[0]!, gone, ...others.slice(1, 5)];
  const fielded = fieldedFor(season, withLineup(shortlist), rule);

  it("takes them out and moves everybody below up one place", () => {
    const survivors = shortlist.filter((id) => id !== gone);
    expect(fielded.players.map((player) => player.id)).toEqual(survivors.slice(0, season.boards));
    expect(fielded.reserves.map((player) => player.id)).toEqual(
      survivors.slice(season.boards, season.boards + season.reserves),
    );
  });

  it("keeps them on the record rather than deleting them", () => {
    expect(fielded.withdrawn.map((player) => player.id)).toEqual([gone]);
  });
});

describe("the group message follows the team that is actually being fielded", () => {
  it("names the written-down team, not the rule's", () => {
    const standby = rule.standby[0]!.playerId;
    const shortlist = [...ruled.slice(0, 3), standby];
    const match = withLineup(shortlist, "Ada is away, so Hollis steps in.");
    const message = selectedTeam(season, match, rule, venues);

    const fielded = fieldedFor(season, match, rule);
    expect(message).toContain(`Playing: ${names(fielded.players).join(", ")}.`);
    expect(message).toContain("Ada is away, so Hollis steps in.");
  });

  it("still names the rule's team when nothing was overridden", () => {
    const fielded = fieldedFor(season, base, rule);
    expect(selectedTeam(season, base, rule, venues)).toContain(`Playing: ${names(fielded.players).join(", ")}.`);
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
    expect(fielded.reserves.map((player) => player.id)).toEqual(expected);
    expect(fielded.reserves.length).toBeGreaterThan(0);
  });

  it("never puts somebody on a board and in the reserves at once", () => {
    const boards = new Set(fielded.players.map((player) => player.id));
    expect(fielded.reserves.filter((player) => boards.has(player.id))).toEqual([]);
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
      }).map((entry) => entry.player.id),
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
    expect(reserves.map((player) => player.playerId)).toEqual(fielded.reserves.map((player) => player.id));

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
