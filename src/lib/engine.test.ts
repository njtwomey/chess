import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Engine, evaluationShare, formatEvaluation, parseInfo, turnOf, type Evaluation } from "@/lib/engine";

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

/**
 * Stockfish, faked well enough to test the one thing that is hard to see.
 *
 * The real worker is a separate thread whose output arrives whenever it
 * arrives; what matters here is the ordering, so this lets a test say exactly
 * when a line comes out and check what the class does with it.
 */
class FakeWorker {
  static latest: FakeWorker | null = null;
  readonly sent: string[] = [];
  private listeners: ((event: { data: string }) => void)[] = [];
  terminated = false;

  constructor() {
    FakeWorker.latest = this;
  }

  addEventListener(type: string, fn: (event: { data: string }) => void) {
    if (type === "message") this.listeners.push(fn);
  }

  postMessage(message: string) {
    this.sent.push(message);
    if (message === "uci") this.emit("uciok");
  }

  terminate() {
    this.terminated = true;
  }

  /** A line out of the engine, right now. */
  emit(line: string) {
    for (const fn of this.listeners) fn({ data: line });
  }

  /** What has been sent since the last look. */
  drain(): string[] {
    return this.sent.splice(0, this.sent.length);
  }
}

describe("Engine", () => {
  const WHITE = START;
  const BLACK = BLACK_TO_MOVE;
  const options = { depth: 14, lines: 1 };

  beforeEach(() => {
    FakeWorker.latest = null;
    vi.stubGlobal("Worker", FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const started = async () => {
    const engine = new Engine("stockfish.js");
    const seen: Evaluation[] = [];
    await engine.analyse(WHITE, options, (result) => seen.push(result));
    const worker = FakeWorker.latest!;
    worker.drain();
    return { engine, worker, seen };
  };

  it("sets the lines before the position, because setoption is refused mid-search", async () => {
    const engine = new Engine("stockfish.js");
    await engine.analyse(WHITE, { depth: 18, lines: 3 }, () => {});
    expect(FakeWorker.latest!.sent).toEqual([
      "uci",
      "setoption name MultiPV value 3",
      `position fen ${WHITE}`,
      "go depth 18",
    ]);
  });

  it("reads a running search in the terms of the position it was started on", async () => {
    const { worker, seen } = await started();
    worker.emit("info depth 12 score cp 30 pv e2e4");
    expect(seen).toEqual([{ depth: 12, multipv: 1, cp: 30, mate: null, pv: ["e2e4"] }]);
  });

  it("does not hand the old search's output to the new position", async () => {
    // The reported symptom. `stop` is a request, not an event, so the engine
    // keeps talking about the old position for a while. Scoring those lines
    // against the new one flips the sign, because the mover has changed, and a
    // quiet game lurches from move to move for no reason anybody can see.
    const { engine, worker } = await started();

    const seen: Evaluation[] = [];
    await engine.analyse(BLACK, options, (result) => seen.push(result));

    // Still White's +30, arriving late. Read against a Black-to-move position
    // it would come out as -30, and the bar would swing the wrong way.
    worker.emit("info depth 14 score cp 30 pv e2e4");
    expect(seen).toEqual([]);
  });

  it("waits for bestmove before sending the next position", async () => {
    const { engine, worker } = await started();

    const seen: Evaluation[] = [];
    await engine.analyse(BLACK, options, (result) => seen.push(result));
    expect(worker.drain()).toEqual(["stop"]);

    worker.emit("bestmove e2e4");
    expect(worker.drain()).toEqual(["setoption name MultiPV value 1", `position fen ${BLACK}`, "go depth 14"]);

    worker.emit("info depth 14 score cp 30 pv d7d5");
    expect(seen).toEqual([{ depth: 14, multipv: 1, cp: -30, mate: null, pv: ["d7d5"] }]);
  });

  it("only ever starts the position asked for last", async () => {
    // Stepping through a game outruns the engine. Everything in between is
    // skipped rather than queued: the answer to a position three moves ago is
    // of no interest by the time it arrives.
    const { engine, worker } = await started();
    await engine.analyse(BLACK, options, () => {});
    await engine.analyse(WHITE, options, () => {});
    worker.drain();

    worker.emit("bestmove e2e4");
    expect(worker.drain()).toContain(`position fen ${WHITE}`);
  });

  it("goes quiet when stopped, and stays ready for the next position", async () => {
    const { engine, worker, seen } = await started();

    engine.stop();
    worker.emit("info depth 14 score cp 30 pv e2e4");
    expect(seen).toEqual([]);

    worker.emit("bestmove e2e4");
    expect(worker.drain()).toEqual(["stop"]);

    const later: Evaluation[] = [];
    await engine.analyse(WHITE, options, (result) => later.push(result));
    worker.emit("info depth 14 score cp 45 pv d2d4");
    expect(later).toHaveLength(1);
  });
});
