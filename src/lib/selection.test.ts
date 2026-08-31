import { describe, expect, it } from "vitest";
import { compareRanked, decidingKey, explain, select, type Candidate, type Reply } from "@/lib/selection";

const SEED = "test-seed";

function candidate(playerId: string, reply: Reply, gamesPlayed = 0): Candidate {
  return { playerId, reply, gamesPlayed };
}

/** Someone who offered and then pulled out, keeping the reply they gave. */
function droppedOut(playerId: string, reply: Reply, gamesPlayed = 0): Candidate {
  return { playerId, reply, gamesPlayed, withdrawn: true };
}

function run(
  candidates: Candidate[],
  overrides: { matchId?: string; seed?: string; boards?: number; reserves?: number } = {},
) {
  return select({
    matchId: overrides.matchId ?? "match-1",
    seed: overrides.seed ?? SEED,
    boards: overrides.boards ?? 4,
    reserves: overrides.reserves ?? 2,
    candidates,
  });
}

const ids = (players: { playerId: string }[]) => players.map((player) => player.playerId);

describe("offering to stand in forgoes priority", () => {
  it("puts every yes ahead of every reserve, however many games they have played", () => {
    // The busy volunteer asked for a game; the rested reserve did not. Taking
    // "reserve" at face value means the board goes to the person who asked.
    const selection = run([candidate("busy-volunteer", "yes", 5), candidate("rested-reserve", "reserve", 0)]);
    expect(ids(selection.boardPlayers)).toEqual(["busy-volunteer", "rested-reserve"]);
  });

  it("still fills the boards from the reserves once the volunteers run out", () => {
    const selection = run([
      candidate("yes-1", "yes", 4),
      candidate("yes-2", "yes", 4),
      candidate("res-1", "reserve", 0),
      candidate("res-2", "reserve", 1),
    ]);
    expect(ids(selection.boardPlayers)).toEqual(["yes-1", "yes-2", "res-1", "res-2"]);
    expect(selection.unfilled).toBe(0);
  });

  it("ranks the reserves among themselves by fewest games", () => {
    const selection = run([
      candidate("busy-reserve", "reserve", 3),
      candidate("rested-reserve", "reserve", 0),
      candidate("middling-reserve", "reserve", 1),
    ]);
    expect(ids(selection.order)).toEqual(["rested-reserve", "middling-reserve", "busy-reserve"]);
  });
});

describe("the fairness rule, among the people who asked for a game", () => {
  it("picks the four who have played least", () => {
    const selection = run([
      candidate("played-three", "yes", 3),
      candidate("played-none", "yes", 0),
      candidate("played-two", "yes", 2),
      candidate("played-one", "yes", 1),
      candidate("played-four", "yes", 4),
    ]);

    expect(ids(selection.boardPlayers)).toEqual(["played-none", "played-one", "played-two", "played-three"]);
    expect(ids(selection.reservePlayers)).toEqual(["played-four"]);
  });

  it("counts a player who played last time below one who did not", () => {
    const before = run([candidate("a", "yes", 0), candidate("b", "yes", 0)], { matchId: "m1" });
    const first = before.boardPlayers[0]!.playerId;

    const after = run([candidate("a", "yes", first === "a" ? 1 : 0), candidate("b", "yes", first === "b" ? 1 : 0)], {
      matchId: "m2",
    });

    expect(after.boardPlayers[0]!.playerId).not.toBe(first);
  });
});

describe("the overspill", () => {
  it("sends the overspill yes to the top of the reserves, ahead of an equally rested reserve", () => {
    // Five say yes, three offer to stand in, everyone equally rested. The fifth
    // yes should be reserve number one: this is the case the captain was asked
    // about in the group chat.
    const selection = run([
      candidate("yes-1", "yes", 1),
      candidate("yes-2", "yes", 1),
      candidate("yes-3", "yes", 1),
      candidate("yes-4", "yes", 1),
      candidate("yes-5", "yes", 1),
      candidate("res-1", "reserve", 1),
      candidate("res-2", "reserve", 1),
      candidate("res-3", "reserve", 1),
    ]);

    expect(selection.boardPlayers).toHaveLength(4);
    for (const player of selection.boardPlayers) expect(player.reply).toBe("yes");

    const firstReserve = selection.reservePlayers[0]!;
    expect(firstReserve.reply).toBe("yes");
    expect(selection.reservePlayers[1]!.reply).toBe("reserve");
  });

  it("keeps the overspill yes above a reserve who has played nothing at all", () => {
    const selection = run([
      candidate("yes-1", "yes", 1),
      candidate("yes-2", "yes", 1),
      candidate("yes-3", "yes", 1),
      candidate("yes-4", "yes", 1),
      candidate("yes-5", "yes", 1),
      candidate("fresh-reserve", "reserve", 0),
    ]);

    for (const player of selection.boardPlayers) expect(player.reply).toBe("yes");
    expect(selection.reservePlayers[0]!.reply).toBe("yes");
    expect(selection.reservePlayers[1]!.playerId).toBe("fresh-reserve");
  });
});

describe("who is never picked", () => {
  it("leaves out not-sure and no, whatever their game count", () => {
    const selection = run([
      candidate("unsure-and-rested", "unsure", 0),
      candidate("cannot-come", "no", 0),
      candidate("available", "yes", 9),
    ]);

    expect(ids(selection.boardPlayers)).toEqual(["available"]);
    expect(ids(selection.unavailable).sort()).toEqual(["cannot-come", "unsure-and-rested"]);
    expect(selection.unfilled).toBe(3);
  });

  it("would rather report an unfilled board than field somebody who did not confirm", () => {
    const selection = run([candidate("only-one", "yes", 0), candidate("maybe", "unsure", 0)]);

    expect(selection.boardPlayers).toHaveLength(1);
    expect(selection.unfilled).toBe(3);
    expect(selection.reservePlayers).toHaveLength(0);
  });

  it("handles nobody at all", () => {
    const selection = run([]);
    expect(selection.boardPlayers).toEqual([]);
    expect(selection.unfilled).toBe(4);
  });

  it("gives unavailable players no position in the order", () => {
    const selection = run([candidate("a", "no", 0), candidate("b", "yes", 0)]);
    expect(selection.unavailable[0]!.position).toBeNull();
    expect(selection.unavailable[0]!.role).toBe("unavailable");
    expect(selection.boardPlayers[0]!.position).toBe(1);
  });
});

describe("determinism", () => {
  const tied = Array.from({ length: 8 }, (_, index) => candidate(`player-${index}`, "yes", 1));

  it("gives the same answer every time it is asked", () => {
    const once = run(tied);
    const again = run(tied);
    expect(ids(again.order)).toEqual(ids(once.order));
  });

  it("does not depend on the order the candidates arrive in", () => {
    const forwards = run(tied);
    const backwards = run([...tied].reverse());
    const shuffled = run([tied[3]!, tied[7]!, tied[0]!, tied[5]!, tied[1]!, tied[6]!, tied[2]!, tied[4]!]);

    expect(ids(backwards.order)).toEqual(ids(forwards.order));
    expect(ids(shuffled.order)).toEqual(ids(forwards.order));
  });

  it("breaks the same tie differently in different matches", () => {
    const orders = new Set(
      Array.from({ length: 12 }, (_, index) => ids(run(tied, { matchId: `match-${index}` }).order).join(",")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("breaks the same tie differently under a different seed", () => {
    const orders = new Set(
      Array.from({ length: 12 }, (_, index) => ids(run(tied, { seed: `seed-${index}` }).order).join(",")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("is a total order, so no two players are ever interchangeable", () => {
    const { order } = run(tied);
    for (let i = 0; i + 1 < order.length; i += 1) {
      expect(compareRanked(order[i]!, order[i + 1]!)).toBeLessThan(0);
    }
  });
});

describe("the tiebreak is fair over a season", () => {
  it("does not favour any player when everyone is tied", () => {
    // If the hash were biased, the same names would keep winning the toss, and
    // the fairness the whole system promises would quietly not happen. Fourteen
    // players, four boards, a thousand matches: each should be picked about
    // 1000 * 4 / 14 = 286 times.
    const squad = Array.from({ length: 14 }, (_, index) =>
      candidate(`player-${String(index).padStart(2, "0")}`, "yes", 2),
    );
    const picked = new Map<string, number>(squad.map((player) => [player.playerId, 0]));

    for (let match = 0; match < 1000; match += 1) {
      for (const player of run(squad, { matchId: `match-${match}` }).boardPlayers) {
        picked.set(player.playerId, (picked.get(player.playerId) ?? 0) + 1);
      }
    }

    const counts = [...picked.values()];
    expect(Math.min(...counts)).toBeGreaterThan(220);
    expect(Math.max(...counts)).toBeLessThan(350);
  });
});

describe("dropping out", () => {
  // Eight players, no ties on games, so the order is fixed and obvious. That
  // makes it possible to assert exactly who moves where.
  const squad = [
    candidate("a", "yes", 0),
    candidate("b", "yes", 1),
    candidate("c", "yes", 2),
    candidate("d", "yes", 3),
    candidate("e", "yes", 4),
    candidate("f", "yes", 5),
    candidate("g", "yes", 6),
    candidate("h", "yes", 7),
  ];

  const withdraw = (id: string) =>
    squad.map((player) => (player.playerId === id ? { ...player, withdrawn: true } : player));

  it("pulls the top reserve onto the empty board", () => {
    const before = run(squad);
    expect(ids(before.boardPlayers)).toEqual(["a", "b", "c", "d"]);
    expect(ids(before.reservePlayers)).toEqual(["e", "f"]);

    const after = run(withdraw("c"));
    expect(ids(after.boardPlayers)).toEqual(["a", "b", "d", "e"]);
    expect(ids(after.reservePlayers)).toEqual(["f", "g"]);
  });

  it("does not re-draw anybody else's place", () => {
    // The property the captain asked for, stated directly: the survivors keep
    // the exact relative order they had before the dropout.
    const before = ids(run(squad).order);
    for (const gone of ["a", "c", "e", "h"]) {
      const after = ids(run(withdraw(gone)).order);
      expect(after).toEqual(before.filter((id) => id !== gone));
    }
  });

  it("holds even when the order was decided by coin tosses", () => {
    // The dangerous case: everybody tied, so the order came out of the hash.
    // Re-running the rule could reshuffle it; removing one player must not.
    const tied = Array.from({ length: 9 }, (_, index) => candidate(`player-${index}`, "yes", 2));
    const before = ids(run(tied).order);
    const dropped = before[2]!;
    const after = ids(run(tied.map((p) => (p.playerId === dropped ? { ...p, withdrawn: true } : p))).order);
    expect(after).toEqual(before.filter((id) => id !== dropped));
  });

  it("keeps a dropout in the story rather than deleting them", () => {
    const after = run(withdraw("c"));
    const gone = after.withdrawn;
    expect(ids(gone)).toEqual(["c"]);
    expect(gone[0]!.role).toBe("withdrawn");
    // Still shown where they were, and with the reply they actually gave.
    expect(gone[0]!.standingPosition).toBe(3);
    expect(gone[0]!.position).toBeNull();
    expect(gone[0]!.reply).toBe("yes");
    expect(ids(after.standing)).toContain("c");
    expect(ids(after.order)).not.toContain("c");
  });

  it("names who moved up, and only those who crossed a line", () => {
    const after = run(withdraw("c"));
    // e went reserve to board, g went standby to reserve. d and f shifted a
    // place without changing what they are, so they are not promotions.
    expect(ids(after.promoted)).toEqual(["e", "g"]);
  });

  it("reports nobody promoted when there was no dropout", () => {
    expect(run(squad).promoted).toEqual([]);
    expect(run(squad).withdrawn).toEqual([]);
  });

  it("leaves a board unfilled when the squad runs out", () => {
    const thin = [candidate("a", "yes", 0), droppedOut("b", "yes", 1), candidate("c", "yes", 2)];
    const selection = run(thin);
    expect(ids(selection.boardPlayers)).toEqual(["a", "c"]);
    expect(selection.unfilled).toBe(2);
  });

  it("counts a dropout as unavailable for the purpose of filling boards", () => {
    const all = squad.slice(0, 4).map((player) => ({ ...player, withdrawn: true }));
    const selection = run(all);
    expect(selection.boardPlayers).toEqual([]);
    expect(selection.unfilled).toBe(4);
    expect(selection.withdrawn).toHaveLength(4);
  });

  it("says so in the message for the group chat", () => {
    const lines = explain(run(withdraw("c")), (id) => id.toUpperCase()).join(" ");
    expect(lines).toContain("C has had to drop out");
    expect(lines).toContain("everybody below moves up one place");
    expect(lines).toContain("E, G moves up");
  });
});

describe("the shape of the result", () => {
  it("splits the order into boards, reserves and the rest with nothing lost", () => {
    const squad = Array.from({ length: 9 }, (_, index) => candidate(`player-${index}`, "yes", 0));
    const selection = run(squad);

    expect(selection.boardPlayers).toHaveLength(4);
    expect(selection.reservePlayers).toHaveLength(2);
    expect(selection.standby).toHaveLength(3);
    expect(ids(selection.order)).toEqual([
      ...ids(selection.boardPlayers),
      ...ids(selection.reservePlayers),
      ...ids(selection.standby),
    ]);
    expect(selection.order.map((player) => player.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(selection.unfilled).toBe(0);
  });

  it("respects a season that plays a different number of boards", () => {
    const squad = Array.from({ length: 6 }, (_, index) => candidate(`player-${index}`, "yes", 0));
    const selection = run(squad, { boards: 5, reserves: 0 });

    expect(selection.boardPlayers).toHaveLength(5);
    expect(selection.reservePlayers).toHaveLength(0);
    expect(selection.standby).toHaveLength(1);
  });
});

describe("bad input", () => {
  it("refuses two replies from the same player", () => {
    expect(() => run([candidate("a", "yes", 0), candidate("a", "no", 0)])).toThrow(/replied twice/);
  });

  it("refuses an impossible game count", () => {
    expect(() => run([candidate("a", "yes", -1)])).toThrow(/impossible game count/);
  });
});

describe("showing the working", () => {
  it("names the key that separated two players", () => {
    const selection = run([candidate("fewer", "yes", 0), candidate("more", "yes", 1)]);
    expect(decidingKey(selection.order[0]!, selection.order[1]!)).toBe("games");

    // The reply is asked first now, so it decides even against a game count.
    const onReply = run([candidate("said-yes", "yes", 4), candidate("offered", "reserve", 0)]);
    expect(decidingKey(onReply.order[0]!, onReply.order[1]!)).toBe("reply");

    const onToss = run([candidate("a", "yes", 1), candidate("b", "yes", 1)]);
    expect(decidingKey(onToss.order[0]!, onToss.order[1]!)).toBe("tiebreak");
  });

  it("does not explain a cut that turned nobody away", () => {
    // Four can play and there are four boards, so the reserves are reserves by
    // their own choice. Explaining the last board would invent a contest.
    const lines = explain(
      run([
        candidate("ada", "yes", 0),
        candidate("bruno", "yes", 0),
        candidate("cass", "yes", 0),
        candidate("dermot", "yes", 0),
        candidate("elin", "reserve", 0),
        candidate("farid", "reserve", 0),
      ]),
      (id) => id,
    ).join(" ");

    expect(lines).toContain("Playing:");
    expect(lines).not.toContain("took the last board");
  });

  it("explains the cut when somebody who asked for a game missed out", () => {
    const lines = explain(
      run([
        candidate("ada", "yes", 0),
        candidate("bruno", "yes", 0),
        candidate("cass", "yes", 0),
        candidate("dermot", "yes", 0),
        candidate("elin", "yes", 1),
      ]),
      (id) => id,
    ).join(" ");

    expect(lines).toContain("took the last board");
  });

  it("writes a message the captain can paste into the group chat", () => {
    const selection = run([
      candidate("ada", "yes", 0),
      candidate("bruno", "yes", 0),
      candidate("cass", "yes", 1),
      candidate("dermot", "yes", 1),
      candidate("elin", "yes", 2),
      candidate("farid", "unsure", 0),
    ]);

    const lines = explain(selection, (id) => id.toUpperCase()).join(" ");
    expect(lines).toMatch(/^Playing: /);
    expect(lines).toContain("Reserves, in this order: ELIN.");
    expect(lines).toContain("Still to hear from: FARID.");
  });

  it("says how many boards are short rather than staying quiet about it", () => {
    const lines = explain(run([candidate("ada", "yes", 0)]), (id) => id).join(" ");
    expect(lines).toContain("3 boards still unfilled");
  });
});
