/**
 * Links out: maps, and the two analysis boards.
 *
 * Everything here is a URL builder. Nothing fetches, and nothing analyses — the
 * site hands a game to a site that can analyse it and gets out of the way.
 */
import { fixtureNumber, type Club, type Game, type Match, type Player, type PlayerCode } from "@/lib/schema";

/**
 * The building, in the order an envelope would have it.
 *
 * The club's own name is not in here: it is the heading this sits under, and
 * repeating it would read as two different places. Any of the parts can be
 * missing, and a club whose address nobody has confirmed yet shows none of them
 * rather than a guess.
 */
export function addressLines(club: Club): string[] {
  return [club.venue.name, club.venue.address, club.venue.postcode].filter((line) => line !== null);
}

/**
 * Where the match is, on a map.
 *
 * A pasted link wins when there is one. Otherwise this searches for the club by
 * name rather than by an address, because the addresses are not all confirmed
 * and a guessed one sends somebody to the wrong side of Bristol on a Tuesday
 * evening. A search for the club name lands on the right place or visibly fails,
 * and both of those beat quiet confidence.
 */
export function mapsUrl(club: Club): string {
  if (club.venue.maps) return club.venue.maps;
  const query = [club.name, ...addressLines(club), "Bristol"].join(", ");
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
export function taggedPgn(
  match: Match,
  game: Game,
  playerName: string,
  opponentName: string,
  sides: { home: string; away: string },
): string {
  const white = game.colour === "white" ? playerName : opponentName;
  const black = game.colour === "white" ? opponentName : playerName;
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
    ["Event", `${sides.home} v ${sides.away}`],
    ["Site", "Bristol, England"],
    ["Date", match.date.replace(/-/g, ".")],
    // Team chess numbers a round by match and board, which is what makes two
    // games from the same evening distinguishable in a database.
    ["Round", `${fixtureNumber(match)}.${game.board}`],
    ["White", white],
    ["Black", black],
    ["Result", result],
  ];

  const body = game.pgn?.trim() ?? "";
  const movetext = body.length > 0 ? body : "*";
  const withResult = movetext.endsWith(result) || movetext.endsWith("*") ? movetext : `${movetext} ${result}`;
  return `${tags.map(([tag, value]) => `[${tag} "${value}"]`).join("\n")}\n\n${withResult}\n`;
}

/** Where each body publishes the player it knows by that number. */
const CODE_URL: Record<PlayerCode["source"], (code: string) => string> = {
  ecf: (code) => `https://rating.englishchess.org.uk/players?ECF_code=${code}`,
  fide: (code) => `https://ratings.fide.com/profile/${code}`,
  lms: (code) => `https://lms.englishchess.org.uk/lms/player/${code}/view`,
};

export function codeUrl(entry: PlayerCode): string {
  return CODE_URL[entry.source](entry.code);
}

/**
 * The most authoritative record we can reach, in that order.
 *
 * The ECF's own page is the authority on an English rating, FIDE's on an
 * international one, and the league's management site is where an opponent's
 * rating was read off when nobody had a code to hand. Ours mostly have the
 * first and theirs mostly the last, and the page must not care which: a name
 * that links on one side of the board and not the other reads as an oversight,
 * because it is one.
 */
const PREFERRED: PlayerCode["source"][] = ["ecf", "fide", "lms"];

export function playerUrl(player: Player): string | null {
  for (const source of PREFERRED) {
    const found = player.codes.find((entry) => entry.source === source);
    if (found) return codeUrl(found);
  }
  return null;
}
