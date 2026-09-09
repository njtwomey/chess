import { describe, expect, it } from "vitest";
import { chesscomUrl, lichessUrl, mapsUrl, taggedPgn } from "@/lib/links";
import type { Club, Game, Match, Venue } from "@/lib/schema";

const club = (overrides: Partial<Venue> = {}): Club => ({
  id: "bristol-clifton",
  name: "Bristol & Clifton Chess Club",
  links: { website: null },
  venue: { name: null, address: null, postcode: null, maps: null, lat: null, lon: null, ...overrides },
});

describe("maps links", () => {
  it("prefers a link somebody pasted", () => {
    expect(mapsUrl(club({ maps: "https://maps.app.goo.gl/abc" }))).toBe("https://maps.app.goo.gl/abc");
  });

  it("searches by name when there is no address, rather than inventing one", () => {
    const url = mapsUrl(club());
    expect(url).toContain("google.com/maps/search/");
    expect(decodeURIComponent(url)).toContain("Bristol & Clifton Chess Club, Bristol");
  });

  it("uses the address and postcode once they are known", () => {
    const url = mapsUrl(club({ address: "99 Oldfield Road", postcode: "BS8 4QQ" }));
    expect(decodeURIComponent(url)).toContain("99 Oldfield Road, BS8 4QQ");
  });
});

describe("analysis links", () => {
  const pgn = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0";

  it("hands the game to lichess and to chess.com", () => {
    expect(lichessUrl(pgn)).toContain("lichess.org/paste?pgn=");
    expect(chesscomUrl(pgn)).toContain("chess.com/analysis?pgn=");
  });

  it("encodes the moves so the hashes and plus signs survive", () => {
    expect(lichessUrl("1. e4 e5 2. Qh5 Nf6 3. Qxf7#")).toContain("%23");
    expect(lichessUrl("1. e4 e5 2. Bc4 Bc5 3. Qh5 Qe7+")).toContain("%2B");
  });

  it("declines rather than truncating a game too long for a URL", () => {
    const marathon = Array.from({ length: 400 }, (_, index) => `${index + 1}. Nf3 Nf6 ${index + 1}... Ng1 Ng8`).join(
      " ",
    );
    expect(lichessUrl(marathon)).toBeNull();
    expect(chesscomUrl(marathon)).toBeNull();
  });
});

describe("exporting a PGN", () => {
  const match: Match = {
    id: "fixture-3",
    opponentTeamId: "bristol-grendel/team-c",
    home: false,
    date: "2026-04-20",
    time: "19:30",
    status: "played",
    availability: [],
    settled: false,
    lineup: null,
    recordUrl: null,
    result: null,
  };

  const game: Game = {
    board: 1,
    playerId: "demo-club/team-d/ada-mercer",
    opponentId: "bristol-grendel/team-c/v-okonjo",
    colour: "black",
    result: "win",
    pgn: "1. d4 Nf6 2. c4 e6 0-1",
  };

  /** Away, so the league writes the home side first: they are, we are not. */
  const SIDES = { home: "Bristol Grendel C", away: "Bristol & Clifton G" };
  const pgnOf = (over: Partial<Game> = {}, us = "Ada Mercer") =>
    taggedPgn(match, { ...game, ...over }, us, "V. Okonjo", SIDES);

  it("writes the seven required tags", () => {
    const pgn = pgnOf();
    for (const tag of ["Event", "Site", "Date", "Round", "White", "Black", "Result"]) {
      expect(pgn).toContain(`[${tag} `);
    }
  });

  it("names the away team second and dots the date", () => {
    const pgn = pgnOf();
    expect(pgn).toContain('[Event "Bristol Grendel C v Bristol & Clifton G"]');
    expect(pgn).toContain('[Date "2026.04.20"]');
    expect(pgn).toContain('[Round "3.1"]');
  });

  it("puts our player on the right side of the board", () => {
    const pgn = pgnOf();
    expect(pgn).toContain('[White "V. Okonjo"]');
    expect(pgn).toContain('[Black "Ada Mercer"]');
  });

  it("writes the result from White's side, not ours", () => {
    // Our win with the black pieces is 0-1 in a PGN, and getting this backwards
    // is how a database ends up crediting the wrong player.
    expect(pgnOf()).toContain('[Result "0-1"]');
    expect(pgnOf({ colour: "white" })).toContain('[Result "1-0"]');
    expect(pgnOf({ result: "draw" })).toContain('[Result "1/2-1/2"]');
  });

  it("stands in a placeholder when there is no movetext", () => {
    expect(pgnOf({ pgn: null })).toMatch(/\n\*\n$/);
  });
});
