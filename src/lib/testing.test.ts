import { describe, expect, it } from "vitest";
import { aMatch, aPlayer, aSeason, aSquad, said } from "@/lib/testing";
import { selectionFor } from "@/lib/season";

describe("the builders", () => {
  it("make a season the rule can run on", () => {
    const season = aSeason({
      players: aSquad(6),
      matches: [aMatch({ id: "r1", availability: [said("p1", "yes"), said("p2", "yes"), said("p3", "reserve")] })],
    });
    const selection = selectionFor(season, season.matches[0]!);
    // p1 and p2 are level, so the toss orders them: the set is the assertion.
    expect(selection.boardPlayers.map((p) => p.playerId).sort()).toEqual(["p1", "p2", "p3"]);
    expect(selection.unfilled).toBe(1);
    // And the reserve is behind both of the people who said yes.
    expect(selection.order.at(-1)!.playerId).toBe("p3");
  });

  it("fill in every default the schema asks for", () => {
    expect(aPlayer({ id: "x", name: "X" })).toMatchObject({ junior: false, ratings: [], ecfCode: null, url: null });
    expect(aMatch()).toMatchObject({ settled: false, lineup: null, result: null, recordUrl: null });
  });
});
