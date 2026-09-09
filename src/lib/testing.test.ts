import { describe, expect, it } from "vitest";
import { aMatch, aPlayer, aSeason, aSquad, ours, said } from "@/lib/testing";
import { selectionFor } from "@/lib/season";

describe("the builders", () => {
  it("make a season the rule can run on", () => {
    const season = aSeason({
      players: aSquad(6),
      matches: [
        aMatch({
          id: "fixture-1",
          availability: [said(ours("p1"), "yes"), said(ours("p2"), "yes"), said(ours("p3"), "reserve")],
        }),
      ],
    });
    const selection = selectionFor(season, season.matches[0]!);
    // p1 and p2 are level, so the toss orders them: the set is the assertion.
    expect(selection.boardPlayers.map((p) => p.playerId).sort()).toEqual([ours("p1"), ours("p2"), ours("p3")]);
    expect(selection.unfilled).toBe(1);
    // And the reserve is behind both of the people who said yes.
    expect(selection.order.at(-1)!.playerId).toBe(ours("p3"));
  });

  it("resolve a player's id to the whole path, as the loader does", () => {
    const season = aSeason({ players: aSquad(2) });
    expect(season.players.map((player) => player.playerId)).toEqual([ours("p1"), ours("p2")]);
    // The side we are playing is built too, or a fixture could not name a venue.
    expect(season.teams).toHaveLength(2);
  });

  it("fill in every default the schema asks for", () => {
    expect(aPlayer({ playerId: "x", name: "X" })).toMatchObject({
      junior: false,
      ratings: [],
      ecfCode: null,
      url: null,
      fullName: null,
    });
    expect(aMatch()).toMatchObject({ settled: false, lineup: null, result: null, recordUrl: null });
  });
});
