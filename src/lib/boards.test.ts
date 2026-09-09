import { describe, expect, it } from "vitest";
import { assignBoards, clockFor, expectedColour, formatClock } from "@/lib/boards";
import type { Player, TimeControl } from "@/lib/schema";

const CONTROL: TimeControl = {
  standard: { minutes: 80, increment: 10 },
  junior: { minutes: 55, increment: 10 },
  juniorUnder: 16,
  juniorOn: null,
};

function player(id: string, rating: number | null, junior = false): Player {
  return {
    playerId: id,
    name: id,
    fullName: null,
    role: "member",
    junior,
    ecfCode: null,
    url: null,
    ratings: rating === null ? [] : [{ date: "2026-01-01", rating, source: "ecf" }],
  };
}

const options = { timeControl: CONTROL };

describe("board order", () => {
  it("puts the strongest on board one and descends", () => {
    const boards = assignBoards([player("weak", 1200), player("strong", 1800), player("middle", 1500)], options);
    expect(boards.map((entry) => entry.player.playerId)).toEqual(["strong", "middle", "weak"]);
    expect(boards.map((entry) => entry.board)).toEqual([1, 2, 3]);
  });

  it("puts unrated players below every graded one", () => {
    const boards = assignBoards([player("unrated", null), player("graded", 1100)], options);
    expect(boards.map((entry) => entry.player.playerId)).toEqual(["graded", "unrated"]);
  });

  it("uses the most recent rating, not the first", () => {
    const improving: Player = {
      playerId: "improving",
      name: "improving",
      fullName: null,
      role: "member",
      junior: false,
      ecfCode: null,
      url: null,
      ratings: [
        { date: "2026-01-01", rating: 1200, source: "ecf" },
        { date: "2026-06-01", rating: 1700, source: "ecf" },
      ],
    };
    const boards = assignBoards([player("steady", 1500), improving], options);
    expect(boards[0]!.player.playerId).toBe("improving");
  });

  it("orders equal ratings alphabetically, whatever order they arrive in", () => {
    const squad = [player("carla", 1500), player("aaron", 1500), player("bev", 1500)];
    const forwards = assignBoards(squad, options).map((entry) => entry.player.playerId);
    expect(forwards).toEqual(["aaron", "bev", "carla"]);
    expect(assignBoards([...squad].reverse(), options).map((entry) => entry.player.playerId)).toEqual(forwards);
  });

  it("orders unrated players alphabetically, which is the whole order when nobody is rated", () => {
    // A seeded coin toss would be stable but unexplainable, and board order is
    // not a fairness question.
    const squad = [player("imre-solt", null), player("gwen-tsai", null), player("hollis-barr", null)];
    expect(assignBoards(squad, options).map((entry) => entry.player.playerId)).toEqual([
      "gwen-tsai",
      "hollis-barr",
      "imre-solt",
    ]);
  });

  it("puts the one rated player on board one, then the rest alphabetically", () => {
    const squad = [
      player("imre-solt", null),
      player("noor-abadi", 1214),
      player("gwen-tsai", null),
      player("hollis-barr", null),
    ];
    expect(assignBoards(squad, options).map((entry) => entry.player.playerId)).toEqual([
      "noor-abadi",
      "gwen-tsai",
      "hollis-barr",
      "imre-solt",
    ]);
  });
});

describe("clocks", () => {
  it("is 80+10 by default", () => {
    const { clock, junior } = clockFor(CONTROL, false, false);
    expect(formatClock(clock)).toBe("80+10");
    expect(junior).toBe(false);
  });

  it("drops to 55+10 when our player is under 16", () => {
    expect(formatClock(clockFor(CONTROL, true, false).clock)).toBe("55+10");
  });

  it("drops to 55+10 when their player is under 16, even though ours is not", () => {
    const { clock, junior } = clockFor(CONTROL, false, true);
    expect(formatClock(clock)).toBe("55+10");
    expect(junior).toBe(true);
  });

  it("is not certain of the long clock while the opponent is unknown", () => {
    expect(clockFor(CONTROL, false, null)).toMatchObject({ certain: false, junior: false });
    // A junior of ours settles it regardless of who turns up.
    expect(clockFor(CONTROL, true, null).certain).toBe(true);
  });

  it("marks a junior's board as junior before the match is played", () => {
    const boards = assignBoards([player("adult", 1500), player("child", 1400, true)], options);
    expect(boards[0]!.clock.junior).toBe(false);
    expect(boards[1]!.clock.junior).toBe(true);
    expect(formatClock(boards[1]!.clock.clock)).toBe("55+10");
  });
});

describe("expected colours", () => {
  it("gives the home team Black on the odd boards", () => {
    // Home starts on Black at board one, which is this league's way round.
    expect([1, 2, 3, 4].map((board) => expectedColour(true, board))).toEqual(["black", "white", "black", "white"]);
    expect([1, 2, 3, 4].map((board) => expectedColour(false, board))).toEqual(["white", "black", "white", "black"]);
  });
});
