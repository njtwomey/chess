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
import { seasonById } from "@/lib/data";
import { selectedTeam } from "@/lib/messages";
import { fieldedFor, selectionFor } from "@/lib/season";
import type { Match } from "@/lib/schema";

const season = seasonById.get("demo")!;
const base = season.matches.find((match) => match.id === "r5")!;

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
    expect(fielded.reserves.map((player) => player.id)).toEqual(expected);
    expect(fielded.reserves.length).toBeGreaterThan(0);
  });

  it("never puts somebody on a board and in the reserves at once", () => {
    const boards = new Set(fielded.players.map((player) => player.id));
    expect(fielded.reserves.filter((player) => boards.has(player.id))).toEqual([]);
  });
});
