/**
 * Links out: maps, and the two analysis boards.
 *
 * Everything here is a URL builder. Nothing fetches, and nothing analyses — the
 * site hands a game to a site that can analyse it and gets out of the way.
 */
import type { Game, Match, Venue } from "@/lib/schema";

/**
 * Where the match is, on a map.
 *
 * A pasted link wins when there is one. Otherwise this searches for the venue by
 * name rather than by an address, because the addresses are not all confirmed
 * and a guessed one sends somebody to the wrong side of Bristol on a Tuesday
 * evening. A search for the club name lands on the right place or visibly fails,
 * and both of those beat quiet confidence.
 */
export function mapsUrl(venue: Venue): string {
  if (venue.maps) return venue.maps;
  const query = [venue.name, venue.address, venue.postcode, "Bristol"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Browsers and servers stop being reliable somewhere above 2000 characters, and
 * a truncated PGN would open an analysis board on the wrong position rather than
 * failing visibly. Past this length the UI offers the PGN box instead, which is
 * why that box is not an optional extra.
 */
const MAX_URL = 1800;

function withPgn(base: string, parameter: string, pgn: string): string | null {
  const url = `${base}?${parameter}=${encodeURIComponent(pgn.trim())}`;
  return url.length > MAX_URL ? null : url;
}

/** Lichess's import page, prefilled. Null when the game is too long to fit in a URL. */
export function lichessUrl(pgn: string): string | null {
  return withPgn("https://lichess.org/paste", "pgn", pgn);
}

/** Chess.com's analysis board, prefilled. Null when the game is too long to fit in a URL. */
export function chesscomUrl(pgn: string): string | null {
  return withPgn("https://www.chess.com/analysis", "pgn", pgn);
}

/**
 * A PGN with the seven tag pairs the standard requires.
 *
 * The stored PGN is usually bare movetext, because that is what somebody types
 * up from a scoresheet. Both analysis sites accept that, but a file saved out of
 * here should be a valid PGN, and the tags are the difference between a game
 * that keeps its context and a list of moves.
 */
export function taggedPgn(match: Match, game: Game, playerName: string, team: string): string {
  const white = game.colour === "white" ? playerName : game.opponent;
  const black = game.colour === "white" ? game.opponent : playerName;
  const scores: Record<Game["result"], string> = {
    win: "1-0",
    "default-win": "1-0",
    draw: "1/2-1/2",
    loss: "0-1",
    "default-loss": "0-1",
  };
  // The PGN result is from White's side, so a Black win is 0-1 and a Black loss
  // is 1-0. Our result is from ours, and the two only coincide half the time.
  const ours = scores[game.result];
  const result = game.colour === "white" ? ours : ours === "1-0" ? "0-1" : ours === "0-1" ? "1-0" : ours;

  const tags = [
    ["Event", `${match.home ? team : match.opponent} v ${match.home ? match.opponent : team}`],
    ["Site", "Bristol, England"],
    ["Date", match.date.replace(/-/g, ".")],
    // Team chess numbers a round by match and board, which is what makes two
    // games from the same evening distinguishable in a database.
    ["Round", `${match.round}.${game.board}`],
    ["White", white],
    ["Black", black],
    ["Result", result],
  ];

  const body = game.pgn?.trim() ?? "";
  const movetext = body.length > 0 ? body : "*";
  const withResult = movetext.endsWith(result) || movetext.endsWith("*") ? movetext : `${movetext} ${result}`;
  return `${tags.map(([tag, value]) => `[${tag} "${value}"]`).join("\n")}\n\n${withResult}\n`;
}

/** A player's published record on the ECF rating site. */
export function ecfUrl(code: string): string {
  return `https://rating.englishchess.org.uk/players?ECF_code=${code}`;
}
