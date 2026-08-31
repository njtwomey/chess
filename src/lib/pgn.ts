/**
 * Turning a PGN into a list of positions to step through.
 *
 * chess.js does the chess. This exists so that the viewer never holds a mutable
 * board: stepping backwards through a game by undoing moves is where off-by-one
 * bugs live, and a plain array indexed by ply cannot have them.
 */
import { Chess } from "chess.js";

export interface Ply {
  /** The position after this move, as FEN. */
  fen: string;
  /** Null on the first entry, which is the starting position. */
  san: string | null;
  from: string | null;
  to: string | null;
  /** 1-based move number, and whose move it was. */
  moveNumber: number;
  colour: "white" | "black" | null;
}

/** Null when the PGN will not parse, which the UI shows rather than swallowing. */
export function replay(pgn: string): Ply[] | null {
  const source = new Chess();
  try {
    source.loadPgn(pgn);
  } catch {
    return null;
  }

  const moves = source.history({ verbose: true });
  const board = new Chess();
  const plies: Ply[] = [{ fen: board.fen(), san: null, from: null, to: null, moveNumber: 0, colour: null }];

  for (const move of moves) {
    board.move(move.san);
    plies.push({
      fen: board.fen(),
      san: move.san,
      from: move.from,
      to: move.to,
      moveNumber: Math.floor(plies.length / 2) + 1,
      colour: move.color === "w" ? "white" : "black",
    });
  }

  return plies;
}

/** The 64 squares of a FEN, rank 8 first, as single letters or null. */
export function squares(fen: string): (string | null)[] {
  const board = fen.split(" ")[0] ?? "";
  const out: (string | null)[] = [];
  for (const character of board) {
    if (character === "/") continue;
    const empty = Number(character);
    if (Number.isInteger(empty) && empty > 0) {
      for (let i = 0; i < empty; i += 1) out.push(null);
    } else {
      out.push(character);
    }
  }
  return out;
}

const FILES = "abcdefgh";

/** Index 0 is a8, index 63 is h1, which is the order `squares` returns. */
export function squareName(index: number): string {
  return `${FILES[index % 8]}${8 - Math.floor(index / 8)}`;
}

/** Moves paired up the way a scoresheet writes them. */
export function movePairs(plies: Ply[]): { number: number; white: Ply | null; black: Ply | null }[] {
  const pairs: { number: number; white: Ply | null; black: Ply | null }[] = [];
  for (let index = 1; index < plies.length; index += 1) {
    const ply = plies[index]!;
    const last = pairs.at(-1);
    if (ply.colour === "white" || !last || last.black !== null) {
      pairs.push({
        number: pairs.length + 1,
        white: ply.colour === "white" ? ply : null,
        black: ply.colour === "black" ? ply : null,
      });
    } else {
      last.black = ply;
    }
  }
  return pairs;
}

/**
 * Where every piece can legally go, in the shape chessground wants.
 *
 * Recomputed for the position on screen rather than cached: a game is a few
 * dozen positions and chess.js answers in well under a millisecond, so a cache
 * would be a correctness risk in exchange for nothing.
 */
export function legalDests(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  let board: Chess;
  try {
    board = new Chess(fen);
  } catch {
    return dests;
  }
  for (const move of board.moves({ verbose: true })) {
    dests.set(move.from, [...(dests.get(move.from) ?? []), move.to]);
  }
  return dests;
}

/**
 * Play a move from a position, for exploring a line on the board.
 *
 * Promotions become queens without asking. Underpromotion matters in maybe one
 * club game in a thousand, and a dialog in the way of every pawn reaching the
 * eighth rank is a worse trade than that.
 */
export function playMove(fen: string, from: string, to: string, promotion = "q"): Ply | null {
  let board: Chess;
  try {
    board = new Chess(fen);
  } catch {
    return null;
  }

  // The move number and side come from the position *before* the move.
  const fields = fen.split(" ");
  const colour = fields[1] === "b" ? ("black" as const) : ("white" as const);
  const moveNumber = Number(fields[5] ?? 1) || 1;

  try {
    const move = board.move({ from, to, promotion });
    if (!move) return null;
    return { fen: board.fen(), san: move.san, from: move.from, to: move.to, moveNumber, colour };
  } catch {
    return null;
  }
}

/**
 * Play a line of coordinate moves, as the engine reports them.
 *
 * Stops at the first move that will not play rather than throwing: a principal
 * variation is the engine's guess and the tail of it is not always legal by the
 * time it is printed, and half a line on the board beats an error.
 */
export function playLine(fen: string, moves: string[]): Ply[] {
  const plies: Ply[] = [];
  let position = fen;
  for (const move of moves) {
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length > 4 ? move.slice(4, 5) : "q";
    const played = playMove(position, from, to, promotion);
    if (!played) break;
    plies.push(played);
    position = played.fen;
  }
  return plies;
}
