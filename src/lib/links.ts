/**
 * Links out: maps, and the two analysis boards.
 *
 * Everything here is a URL builder. Nothing fetches, and nothing analyses — the
 * site hands a game to a site that can analyse it and gets out of the way.
 */
import { type Club, type Game, type Match, type Player, type PlayerCode } from "@/lib/schema";

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
 * What a URL will carry, measured rather than guessed.
 *
 * Lichess answers 200 up to about 2050 characters and 400 past it, which is a
 * 2048-byte limit with the scheme and host on top. This leaves a margin under
 * that: a link that 400s is worse than no link, which is the whole reason there
 * is a cap at all.
 */
const MAX_URL = 2000;

/** The result marker, which means nothing on a game that has been cut short. */
const RESULT = /^(1-0|0-1|1\/2-1\/2|\*)$/;

/**
 * As much of a game as will fit, and whether anything was left behind.
 *
 * Three steps down. The whole thing with its tags, because knowing who played
 * and when is worth the two hundred characters it costs. Then the moves alone,
 * which is what gets a long game through: the tags are a fifth of the length
 * and an analysis board does not need them. Then the moves cut at a whole move,
 * so the board opens on the position the game reached rather than not opening.
 *
 * Something always fits, so this never returns nothing.
 */
function pack(base: string, parameter: string, tagged: string): { url: string; clipped: boolean } {
  const link = (text: string) => `${base}?${parameter}=${encodeURIComponent(text.trim())}`;
  const whole = link(tagged);
  if (whole.length <= MAX_URL) return { url: whole, clipped: false };

  const body = tagged.slice(tagged.lastIndexOf("]\n") + 2);
  const bare = link(body);
  if (bare.length <= MAX_URL) return { url: bare, clipped: false };

  // Whole moves off the end, and the result marker with them: the game no
  // longer reaches it. A trailing move number goes too, or the PGN is invalid.
  const words = body
    .trim()
    .split(/\s+/)
    .filter((word) => !RESULT.test(word));
  for (let count = words.length - 1; count > 0; count -= 1) {
    const kept = words.slice(0, count);
    while (kept.length > 0 && /^\d+\.+$/.test(kept.at(-1) ?? "")) kept.pop();
    const url = link(kept.join(" "));
    if (url.length <= MAX_URL) return { url, clipped: true };
  }
  return { url: link(words[0] ?? ""), clipped: true };
}

/** Lichess's import page, prefilled with as much of the game as fits. */
export function lichessUrl(pgn: string) {
  return pack("https://lichess.org/paste", "pgn", pgn);
}

/** Chess.com's analysis board, the same way. */
export function chesscomUrl(pgn: string) {
  return pack("https://www.chess.com/analysis", "pgn", pgn);
}

/**
 * A PGN with the seven tag pairs the standard requires.
 *
 * The stored PGN is usually bare movetext, because that is what somebody types
 * up from a scoresheet. Both analysis sites accept that, but a file saved out of
 * here should be a valid PGN, and the tags are the difference between a game
 * that keeps its context and a list of moves.
 */
/**
 * A name reduced to its initials, keeping anything already written as one.
 *
 * "Bristol & Clifton" becomes "BC" and "UWE" stays "UWE", because a lone "U"
 * would be worse than the name it replaced. Two letters at least before a word
 * counts as an initialism, or the "V." of "V. Okonjo" would survive whole and
 * the rest would not. Ampersands and anything else with no letter in it drop
 * out.
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z]/gi, ""))
    .filter((word) => word.length > 0)
    .map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word[0]!.toUpperCase()))
    .join("");
}

/**
 * A team as a short code: "Bristol & Clifton G" becomes "BC-G".
 *
 * The last word of a team's name is the letter the league gives it, and it is
 * the only part worth keeping whole: it is what tells two sides of one club
 * apart.
 */
export function teamCode(name: string): string {
  const words = name.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word));
  const letter = words.at(-1) ?? name;
  const club = initials(words.slice(0, -1).join(" "));
  return club ? `${club}-${letter.toUpperCase()}` : letter.toUpperCase();
}

/**
 * An exported game names nobody, and says only what sharing it needs.
 *
 * A PGN leaves here for lichess or chess.com, which are public, and it carries
 * an opponent who never agreed to appear on either. Initials keep a game
 * findable by whoever played it and identify nobody to anybody else, which is
 * the most a scoresheet copied off somebody else's handwriting has any business
 * publishing.
 *
 * Four tags, not the standard seven. This is a link somebody opens, not an
 * archive: the archive is the working file under `games/`, which keeps the
 * fuller form. Site and Round are things this site already shows around the
 * board, and Date rides along inside Event rather than paying for a tag of its
 * own. What is left is who played, what happened, and enough to tell one game
 * from another. The saving is around 130 characters of URL, which on a long
 * game is six or seven moves that would otherwise be cut off the end.
 */
export function taggedPgn(
  match: Match,
  game: Game,
  playerName: string,
  opponentName: string,
  where: { home: string; away: string },
): string {
  const us = initials(playerName);
  const them = initials(opponentName);
  const white = game.colour === "white" ? us : them;
  const black = game.colour === "white" ? them : us;
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

  // The board number is what tells two games of one evening apart, and the date
  // is what tells one evening from another, so both ride in the event's name.
  const tags = [
    ["Event", `${teamCode(where.home)} vs ${teamCode(where.away)} B${game.board}, ${match.date.replace(/-/g, ".")}`],
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
