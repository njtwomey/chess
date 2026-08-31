import { describe, expect, it } from "vitest";
import { evaluationShare, formatEvaluation, parseInfo, turnOf, type Evaluation } from "@/lib/engine";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BLACK_TO_MOVE = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

const evaluation = (overrides: Partial<Evaluation> = {}): Evaluation => ({
  depth: 12,
  multipv: 1,
  cp: 0,
  mate: null,
  pv: [],
  ...overrides,
});

describe("turnOf", () => {
  it("reads the side to move out of a FEN", () => {
    expect(turnOf(START)).toBe("white");
    expect(turnOf(BLACK_TO_MOVE)).toBe("black");
  });
});

describe("parseInfo", () => {
  it("reads depth, score and the principal variation", () => {
    const line = "info depth 14 seldepth 18 score cp 34 nodes 1000 pv e2e4 e7e5 g1f3";
    expect(parseInfo(line, START)).toEqual({ depth: 14, multipv: 1, cp: 34, mate: null, pv: ["e2e4", "e7e5", "g1f3"] });
  });

  it("flips the sign when it is Black to move", () => {
    // UCI scores from the mover's side. +80 for Black is -80 for White, and
    // showing it unflipped would put the bar on the wrong side of the board.
    const line = "info depth 10 score cp 80 pv d7d5";
    expect(parseInfo(line, BLACK_TO_MOVE)!.cp).toBe(-80);
    expect(parseInfo(line, START)!.cp).toBe(80);
  });

  it("reads a forced mate, and flips that too", () => {
    expect(parseInfo("info depth 20 score mate 3 pv f3f7", START)).toMatchObject({ mate: 3, cp: null });
    expect(parseInfo("info depth 20 score mate 3 pv f3f7", BLACK_TO_MOVE)).toMatchObject({ mate: -3 });
  });

  it("ignores bounds, which are the engine thinking aloud", () => {
    expect(parseInfo("info depth 9 score cp 55 lowerbound nodes 5", START)).toBeNull();
    expect(parseInfo("info depth 9 score cp 55 upperbound nodes 5", START)).toBeNull();
  });

  it("ignores lines that carry no score", () => {
    expect(parseInfo("info depth 1 currmove e2e4 currmovenumber 1", START)).toBeNull();
    expect(parseInfo("bestmove e2e4 ponder e7e5", START)).toBeNull();
    expect(parseInfo("readyok", START)).toBeNull();
  });

  it("reads which line it is, for multi-line analysis", () => {
    expect(parseInfo("info depth 12 multipv 2 score cp -15 pv d2d4", START)!.multipv).toBe(2);
    // Absent means the only line, which is what a single-line search reports.
    expect(parseInfo("info depth 12 score cp -15 pv d2d4", START)!.multipv).toBe(1);
  });

  it("copes with no principal variation", () => {
    expect(parseInfo("info depth 4 score cp 12", START)!.pv).toEqual([]);
  });
});

describe("formatEvaluation", () => {
  it("writes pawns with a sign", () => {
    expect(formatEvaluation(evaluation({ cp: 124 }))).toBe("+1.24");
    expect(formatEvaluation(evaluation({ cp: -60 }))).toBe("-0.60");
    expect(formatEvaluation(evaluation({ cp: 0 }))).toBe("0.00");
  });

  it("writes a mate as a mate", () => {
    expect(formatEvaluation(evaluation({ cp: null, mate: 4 }))).toBe("M4");
    expect(formatEvaluation(evaluation({ cp: null, mate: -2 }))).toBe("-M2");
  });
});

describe("evaluationShare", () => {
  it("is even at nought", () => {
    expect(evaluationShare(evaluation({ cp: 0 }))).toBeCloseTo(0.5);
  });

  it("moves towards White as White gets better, and never leaves the bar", () => {
    const share = [-2000, -300, -50, 0, 50, 300, 2000].map((cp) => evaluationShare(evaluation({ cp })));
    for (let i = 1; i < share.length; i += 1) expect(share[i]!).toBeGreaterThan(share[i - 1]!);
    for (const value of share) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("fills the bar completely for a forced mate", () => {
    expect(evaluationShare(evaluation({ cp: null, mate: 2 }))).toBe(1);
    expect(evaluationShare(evaluation({ cp: null, mate: -2 }))).toBe(0);
  });
});
