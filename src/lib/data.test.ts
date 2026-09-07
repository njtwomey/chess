/**
 * The prototype season, and nothing else.
 *
 * No test here reads the live season. A test that asserts on real availability,
 * a real roster or a real fixture list fails on the commit that is hardest to
 * argue with: recording something that actually happened. The captain should
 * never have to edit a test to write down a reply.
 *
 * What guards the real data instead is `data.ts`, which parses every file at
 * import and throws listing every problem at once. Importing it here runs those
 * checks over both seasons, which is the whole point: the guarantee lives where
 * the site itself depends on it rather than in a test that only CI sees.
 */
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { seasonById } from "@/lib/data";
import { candidatesFor, gamesPlayedBefore, selectionFor } from "@/lib/season";
import { select } from "@/lib/selection";

describe("the season files load", () => {
  it("loads the prototype season, flagged as one", () => {
    // Everything else this block used to assert is now enforced by the loader,
    // which runs over both seasons at import: ids matching names, placeholders,
    // a venue on every match, a team only on a settled match, and the two casts
    // never overlapping. Importing `data.ts` above is what runs them.
    expect(seasonById.get("demo")!.prototype).toBe(true);
  });
});

describe("every recorded PGN is a game a board can replay", () => {
  // The prototype's, which are the only recorded games there are. A real PGN is
  // checked the moment somebody opens its board, because the viewer parses it
  // with this same library.
  const games = seasonById
    .get("demo")!
    .matches.flatMap((match) =>
      (match.result?.games ?? []).map((game) => ({ id: `${match.id} board ${game.board}`, pgn: game.pgn })),
    );

  it("has some to check", () => {
    expect(games.filter((game) => game.pgn !== null).length).toBeGreaterThan(0);
  });

  it.each(games.filter((game) => game.pgn !== null))("$id", ({ pgn }) => {
    const board = new Chess();
    expect(() => board.loadPgn(pgn!)).not.toThrow();
    expect(board.history().length).toBeGreaterThan(0);
  });
});

describe("the worked example on the organisation page", () => {
  const season = seasonById.get("demo")!;
  const match = season.matches.find((candidate) => candidate.id === "r5")!;

  it("has the game counts the four played matches produced", () => {
    const played = gamesPlayedBefore(season, match);
    expect(Object.fromEntries(played)).toMatchObject({
      "ada-mercer": 3,
      "bruno-halliday": 3,
      "cass-oyelaran": 2,
      "dermot-kavanagh": 2,
      "elin-pryce": 1,
      "keeley-monrove": 0,
      "liam-ferrers": 0,
      "mira-vance": 0,
      "noor-abadi": 0,
    });
  });

  it("fields the least-played of the people who asked for a game", () => {
    const selection = selectionFor(season, match);
    const boards = selection.boardPlayers.map((player) => player.playerId);

    expect(boards).toHaveLength(4);
    expect(selection.unfilled).toBe(0);
    // Everybody on a board asked to play. Keeley has played none of them.
    for (const player of selection.boardPlayers) expect(player.reply).toBe("yes");
    expect(boards).toContain("keeley-monrove");
  });

  it("puts the reserves below every volunteer, however rested they are", () => {
    const selection = selectionFor(season, match);
    // Noor has played nothing and still sits below Ada and Bruno, who have three
    // games each but asked for a game. Offering to stand in forgoes priority.
    const noor = selection.order.find((player) => player.playerId === "noor-abadi")!;
    expect(noor.reply).toBe("reserve");
    expect(noor.role).not.toBe("board");

    const lastVolunteer = selection.order.filter((player) => player.reply === "yes").at(-1)!;
    expect(noor.position!).toBeGreaterThan(lastVolunteer.position!);
  });

  it("takes a dropout off the team without re-ranking anybody else", () => {
    // Mira said yes, was picked, and then had to pull out.
    const selection = selectionFor(season, match);
    const withdrawn = selection.withdrawn.map((player) => player.playerId);
    expect(withdrawn).toEqual(["mira-vance"]);
    expect(selection.boardPlayers.map((player) => player.playerId)).not.toContain("mira-vance");

    // The order of everyone else is exactly what it was before she dropped out.
    const asIfPresent = select({
      matchId: match.id,
      seed: season.seed,
      boards: season.boards,
      reserves: season.reserves,
      candidates: candidatesFor(season, match).map((candidate) => ({ ...candidate, withdrawn: false })),
    });
    expect(selection.order.map((player) => player.playerId)).toEqual(
      asIfPresent.order.map((player) => player.playerId).filter((id) => id !== "mira-vance"),
    );
  });

  it("promotes the player who was top of the reserves, and says so", () => {
    const selection = selectionFor(season, match);
    expect(selection.promoted.length).toBeGreaterThan(0);

    const movedOntoABoard = selection.promoted.find((player) => player.role === "board");
    expect(movedOntoABoard).toBeDefined();
    // They were the first reserve before the dropout, not somebody new.
    expect(movedOntoABoard!.standingPosition).toBe(season.boards + 1);
  });

  it("leaves out the rested player who has not confirmed", () => {
    const selection = selectionFor(season, match);
    expect(selection.order.map((player) => player.playerId)).not.toContain("liam-ferrers");
    expect(selection.unavailable.map((player) => player.playerId)).toContain("liam-ferrers");
  });

  it("leaves the two who have played most out of the team, though they said yes", () => {
    const selection = selectionFor(season, match);
    for (const id of ["ada-mercer", "bruno-halliday"]) {
      expect(selection.boardPlayers.map((player) => player.playerId)).not.toContain(id);
    }
  });

  it("reports the short board on the round nobody has answered yet", () => {
    const empty = season.matches.find((candidate) => candidate.id === "r7")!;
    expect(selectionFor(season, empty).unfilled).toBe(4);
  });

  it("says how many boards it cannot fill on a thin week", () => {
    const thin = season.matches.find((candidate) => candidate.id === "r6")!;
    const selection = selectionFor(season, thin);
    expect(selection.boardPlayers).toHaveLength(3);
    expect(selection.unfilled).toBe(1);
  });
});
