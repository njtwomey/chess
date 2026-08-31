/**
 * Stockfish, in a Worker, speaking UCI.
 *
 * This is the single-threaded WebAssembly build on purpose. The fast
 * multi-threaded one needs SharedArrayBuffer, which needs cross-origin
 * isolation headers, which a static host such as GitHub Pages cannot send. A
 * single thread is more than enough to tell a club player whether they were
 * winning on move 24.
 *
 * The engine is never loaded unless somebody asks for analysis: it is 650KB and
 * most people opening a game want to see the moves, not an evaluation.
 *
 * The parsing below is pure and separately tested, because UCI is a text
 * protocol full of small traps and getting the sign wrong would confidently
 * tell a player they were losing a game they won.
 */

export interface Evaluation {
  /** How deep the engine had looked when it said this. */
  depth: number;
  /** Which line this is, 1 being the one it likes best. */
  multipv: number;
  /** Centipawns, always from White's point of view. Null during a forced mate. */
  cp: number | null;
  /** Moves to mate, from White's point of view. Negative means Black mates. */
  mate: number | null;
  /** The line it wants to play, in coordinate notation. */
  pv: string[];
}

/** Whose move it is, from a FEN. */
export function turnOf(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

/**
 * One `info` line into an evaluation.
 *
 * UCI reports the score from the point of view of the side to move, so the same
 * position is `+120` for White and `-120` after Black's reply even though
 * nothing changed. Everything above this line works in White's terms, which is
 * what an evaluation bar needs and what a reader expects.
 */
export function parseInfo(line: string, fen: string): Evaluation | null {
  if (!line.startsWith("info ") || !line.includes(" score ")) return null;
  // Bounds are the engine thinking aloud about a move it has not committed to.
  if (line.includes(" lowerbound") || line.includes(" upperbound")) return null;

  const tokens = line.split(/\s+/);
  const after = (key: string) => {
    const index = tokens.indexOf(key);
    return index === -1 ? null : (tokens[index + 1] ?? null);
  };

  const depth = Number(after("depth") ?? 0);
  const multipv = Number(after("multipv") ?? 1) || 1;
  const scoreIndex = tokens.indexOf("score");
  const kind = tokens[scoreIndex + 1];
  const value = Number(tokens[scoreIndex + 2]);
  if (!Number.isFinite(value)) return null;

  const sign = turnOf(fen) === "black" ? -1 : 1;
  const pvIndex = tokens.indexOf("pv");
  const pv = pvIndex === -1 ? [] : tokens.slice(pvIndex + 1);

  if (kind === "mate") return { depth, multipv, cp: null, mate: sign * value, pv };
  if (kind === "cp") return { depth, multipv, cp: sign * value, mate: null, pv };
  return null;
}

/** "+1.24", "-0.60", "M4", "-M2". Always from White's side. */
export function formatEvaluation(evaluation: Evaluation): string {
  if (evaluation.mate !== null) {
    return `${evaluation.mate < 0 ? "-" : ""}M${Math.abs(evaluation.mate)}`;
  }
  const pawns = (evaluation.cp ?? 0) / 100;
  return `${pawns > 0 ? "+" : pawns < 0 ? "-" : ""}${Math.abs(pawns).toFixed(2)}`;
}

/**
 * How full the White half of the bar is, 0 to 1.
 *
 * Centipawns are unbounded and a linear bar would sit pinned at one end for
 * most of any decisive game. The curve below saturates gently, so the bar keeps
 * moving through the range a club game actually lives in and still reads as
 * winning when it is.
 */
export function evaluationShare(evaluation: Evaluation): number {
  if (evaluation.mate !== null) return evaluation.mate > 0 ? 1 : 0;
  const pawns = (evaluation.cp ?? 0) / 100;
  return 1 / (1 + Math.exp(-0.4 * pawns));
}

type Listener = (evaluation: Evaluation) => void;

interface Request {
  fen: string;
  options: { depth: number; lines: number };
  listener: Listener;
}

/**
 * A Worker running Stockfish, driven one position at a time.
 *
 * Only the most recent request matters: somebody stepping through a game
 * changes position faster than the engine finishes, so each new position
 * replaces the previous search rather than queueing behind it.
 *
 * Replacing it is not as simple as sending the next position, though, and the
 * difference is the whole reason this class exists. `stop` is a request, not an
 * event: the search keeps emitting `info` lines until the engine gets round to
 * ending it, and those lines are still about the *old* position. Attributing
 * them to the new one gets the sign backwards every single time, because the
 * side to move alternates with every move, so a quiet position reads as a
 * lurch in one direction and then snaps back when the real lines arrive.
 *
 * So a search is only ever started when the engine is idle. `bestmove` is the
 * one thing that says a search is over and no more of its output is coming,
 * and it is emitted whether the search ran out of depth or was stopped. The
 * position waiting to be analysed is held until then.
 */
export class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  /**
   * The search actually running, and the position it belongs to. Null while the
   * engine is idle. The listener is dropped when a search is abandoned, but the
   * entry stays until `bestmove`, because until then the engine is still busy.
   */
  private running: { fen: string; listener: Listener | null } | null = null;
  /** The most recently asked for position, waiting for the engine to go idle. */
  private next: Request | null = null;

  constructor(private readonly url: string) {}

  private start(): Promise<void> {
    if (this.ready) return this.ready;

    this.ready = new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(this.url);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      this.worker = worker;

      const onMessage = (event: MessageEvent) => {
        const line = String(event.data ?? "");
        // Ready means uciok, and nothing else. This build never answers
        // `isready`, so waiting for `readyok` waits for ever and the panel sits
        // on a spinner that never resolves.
        if (line === "uciok") {
          resolve();
          return;
        }

        // The search is over and the engine is idle, so whatever is waiting can
        // now be sent. Everything before this line belonged to the old position.
        if (line.startsWith("bestmove")) {
          this.running = null;
          this.launch();
          return;
        }

        if (!this.running?.listener) return;
        const evaluation = parseInfo(line, this.running.fen);
        if (evaluation) this.running.listener(evaluation);
      };

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", () => reject(new Error("Stockfish failed to start")));
      worker.postMessage("uci");
    });

    return this.ready;
  }

  /** Analyse a position, replacing whatever it was doing. */
  async analyse(fen: string, options: { depth: number; lines: number }, onEvaluation: Listener): Promise<void> {
    await this.start();
    if (!this.worker) return;

    this.next = { fen, options, listener: onEvaluation };
    if (this.running) {
      // Abandon the running search now, so none of its remaining output is
      // delivered, and start the new one when its `bestmove` says it is safe.
      this.running.listener = null;
      this.worker.postMessage("stop");
      return;
    }
    this.launch();
  }

  /**
   * Send a position to an idle engine.
   *
   * MultiPV is set here rather than beside the request because Stockfish
   * refuses `setoption` during a search: sent at the wrong moment it is
   * silently dropped, and the reader gets one line after asking for three.
   */
  private launch() {
    const request = this.next;
    if (!request || !this.worker) return;
    this.next = null;
    this.running = { fen: request.fen, listener: request.listener };
    this.worker.postMessage(`setoption name MultiPV value ${request.options.lines}`);
    this.worker.postMessage(`position fen ${request.fen}`);
    this.worker.postMessage(`go depth ${request.options.depth}`);
  }

  stop() {
    this.next = null;
    if (!this.running) return;
    this.running.listener = null;
    this.worker?.postMessage("stop");
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.running = null;
    this.next = null;
  }
}

/** Where `scripts/copy-engine.mjs` puts the engine, honouring the site's base path. */
export function engineUrl(): string {
  return `${import.meta.env.BASE_URL}engine/stockfish.wasm.js`;
}
