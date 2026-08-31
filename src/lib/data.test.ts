/**
 * The shipped data, checked against the same rules the site relies on.
 *
 * `data.ts` throws at import when the season files disagree with each other, so
 * merely importing it here is most of the test. The rest covers the things that
 * would render as something plausible and wrong: a PGN that no board can
 * replay, and the worked example the whole selection page is built on.
 */
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { activeSeason, playerById, seasonById, seasons, venueById, venues } from "@/lib/data";
import { candidatesFor, fieldedFor, gamesPlayedBefore, orderedMatches, selectionFor } from "@/lib/season";
import { select } from "@/lib/selection";

describe("the season files load", () => {
  it("finds both seasons and one active one", () => {
    expect(seasons.map((season) => season.id).sort()).toEqual(["2026-autumn-g", "demo"]);
    expect(seasons.filter((season) => season.active)).toHaveLength(1);
    expect(activeSeason.id).toBe("2026-autumn-g");
  });

  it("keeps invented players inside the season badged as a prototype", () => {
    // The rule that stops a made-up player turning up on a real team sheet.
    // Real seasons have real rosters now, so the check is that the two casts
    // never overlap rather than that the real ones are empty.
    const invented = new Set(
      seasons.filter((season) => season.prototype).flatMap((season) => season.players.map((player) => player.id)),
    );
    expect(invented.size).toBeGreaterThan(0);

    for (const season of seasons) {
      if (season.prototype) continue;
      for (const player of season.players) expect(invented.has(player.id)).toBe(false);
    }
    expect(seasonById.get("demo")!.prototype).toBe(true);
  });

  it("has a squad for the real season, some of it rated and some not", () => {
    const real = seasonById.get("2026-autumn-g")!;
    expect(real.players).toHaveLength(16);
    // Unrated is a real state, not a gap to fill with a zero, and a squad is
    // normally a mix. Selection ignores ratings entirely either way.
    expect(real.players.some((player) => player.ratings.length > 0)).toBe(true);
    expect(real.players.some((player) => player.ratings.length === 0)).toBe(true);
  });

  it("keeps the two Alexes apart", () => {
    // Alex and Alexandra are two different people whose names both start the
    // same way. Ids feed the tiebreak hash and every availability entry, so
    // conflating them would field the wrong player.
    const real = seasonById.get("2026-autumn-g")!;
    const ids = real.players.map((player) => player.id);
    expect(ids).toContain("alex");
    expect(ids).toContain("alexandra");
    expect(playerById(real, "alex")!.ecfCode).toBe("386591F");
    expect(playerById(real, "alexandra")!.ecfCode).toBe("380878G");
  });

  it("names every player by their name, with no placeholders left behind", () => {
    // "player-a" and a display name of "A" were both stand-ins for somebody
    // whose name we did not know. A placeholder that survives into a season is
    // a person nobody has checked on.
    for (const season of seasons) {
      for (const player of season.players) {
        expect(player.id).not.toMatch(/^player-/);
        expect(player.name.length).toBeGreaterThan(1);
      }
    }
  });

  it("derives every player id from their name", () => {
    // The convention, so an id can be read and typed. If a display name ever
    // has to change after a match has been played, keep the id and record the
    // divergence here deliberately: renaming an id re-decides past coin tosses.
    const slug = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    for (const season of seasons) {
      for (const player of season.players) expect(player.id).toBe(slug(player.name));
    }
  });

  it("settles a match only when there is a full team to publish", () => {
    // Settling is what puts a running order in front of the squad, so the thing
    // worth catching is a short one: a published team sheet with a board nobody
    // is on is worse than saying nothing yet. Matches still taking replies stay
    // unsettled, which is the default and is checked by the absence of a team.
    for (const season of seasons) {
      for (const match of season.matches) {
        if (!match.settled || match.result) continue;
        const fielded = fieldedFor(season, match, selectionFor(season, match));
        expect({ match: `${season.id}/${match.id}`, unfilled: fielded.unfilled }).toEqual({
          match: `${season.id}/${match.id}`,
          unfilled: 0,
        });
      }
    }
  });

  it("names a team only on a match that is settled", () => {
    // The pair the loader enforces, kept here as well because the failure is
    // silent: a team written down and never shown.
    for (const season of seasons) {
      for (const match of season.matches) {
        if (match.lineup) expect(match.settled || match.result !== null).toBe(true);
      }
    }
  });

  it("gives every recorded ECF code the shape the ECF uses", () => {
    for (const season of seasons) {
      for (const player of season.players) {
        if (player.ecfCode === null) continue;
        expect(player.ecfCode).toMatch(/^\d{6}[A-Z]$/);
      }
    }
  });

  it("names a venue for every match", () => {
    for (const season of seasons) {
      for (const match of season.matches) expect(venueById.has(match.venueId)).toBe(true);
    }
  });

  it("can get to a map for every venue", () => {
    // An address is allowed to be missing. A way of finding the place is not.
    for (const venue of venues) expect(venue.maps ?? venue.name).toBeTruthy();
  });
});

describe("the real fixture list", () => {
  const season = seasonById.get("2026-autumn-g")!;

  it("is the seven fixtures the league published, in order", () => {
    expect(orderedMatches(season).map((match) => [match.date, match.opponent, match.home])).toEqual([
      ["2026-09-08", "South Bristol D", true],
      ["2026-09-15", "Horfield & Redland E", true],
      ["2026-10-05", "Bristol Grendel C", false],
      ["2026-10-20", "Downend & Fishponds F", true],
      ["2026-10-28", "South Bristol E", false],
      ["2026-12-02", "UWE B", false],
      ["2026-12-15", "Hanham Folk Centre B", true],
    ]);
  });

  it("plays every home match at the team's own club", () => {
    for (const match of season.matches) {
      if (match.home) expect(match.venueId).toBe(season.team.homeVenueId);
    }
  });

  it("gives every team a link to the league's fixture list", () => {
    // Required, not optional: it is the authority on when and where a match is,
    // and every match page points back at it.
    for (const season of seasons) expect(season.team.links.fixtures).toMatch(/^https:\/\//);
  });

  it("names its team once, rather than repeating the string in every season", () => {
    expect(season.team.id).toBe("bristol-clifton-g");
    expect(season.team.name).toBe("Bristol & Clifton G");
    // Both seasons are the same side, so they resolve to the same record.
    expect(seasonById.get("demo")!.team).toBe(season.team);
  });

  it("comes to 28 places, which is the arithmetic the whole system is for", () => {
    expect(season.matches.length * season.boards).toBe(28);
  });
});

describe("every recorded PGN is a game a board can replay", () => {
  const games = seasons.flatMap((season) =>
    season.matches.flatMap((match) =>
      (match.result?.games ?? []).map((game) => ({ id: `${match.id} board ${game.board}`, pgn: game.pgn })),
    ),
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
