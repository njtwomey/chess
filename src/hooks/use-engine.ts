import * as React from "react";
import { Engine, engineUrl, type Evaluation } from "@/lib/engine";

export interface EngineOptions {
  /**
   * How deep to look.
   *
   * Fourteen is the sensible default: it lands in well under a second per
   * position on one thread, and the difference between it and a
   * tournament-strength search is of no interest to anybody reviewing a club
   * game. Going deeper mostly means watching a spinner while stepping through
   * moves, which is why this is a setting rather than a constant.
   */
  depth: number;
  /** How many alternative lines to report. One is enough most of the time. */
  lines: number;
}

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = { depth: 14, lines: 1 };

interface EngineState {
  /** Best line first. Empty until the first result arrives. */
  lines: Evaluation[];
  thinking: boolean;
  error: string | null;
}

/**
 * Analyse whatever position is on the board, while the reader wants it.
 *
 * The engine is created on first use and torn down when analysis is switched
 * off, so a reader who never asks for it never downloads it. Nothing is
 * precomputed and no result is kept: stepping through a game replaces the
 * search rather than queueing another, because the answer to a position three
 * moves ago is of no interest by the time it arrives.
 */
export function useEngine(fen: string, enabled: boolean, options: EngineOptions = DEFAULT_ENGINE_OPTIONS): EngineState {
  const engine = React.useRef<Engine | null>(null);
  const [state, setState] = React.useState<EngineState>({ lines: [], thinking: false, error: null });
  const { depth, lines } = options;

  React.useEffect(() => {
    if (!enabled || !fen) {
      engine.current?.destroy();
      engine.current = null;
      setState({ lines: [], thinking: false, error: null });
      return;
    }

    engine.current ??= new Engine(engineUrl());
    const current = engine.current;
    let live = true;

    // Clear the previous position's numbers rather than leaving them under the
    // new board, where they would read as an evaluation of a position the
    // engine never saw.
    setState({ lines: [], thinking: true, error: null });

    current
      .analyse(fen, { depth, lines }, (evaluation) => {
        if (!live) return;
        setState((previous) => {
          // Each line is reported repeatedly as the search deepens, so the
          // newest one for a given multipv replaces the older one.
          const next = previous.lines.filter((line) => line.multipv !== evaluation.multipv);
          next.push(evaluation);
          next.sort((a, b) => a.multipv - b.multipv);
          return { lines: next, thinking: evaluation.depth < depth, error: null };
        });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({
          lines: [],
          thinking: false,
          error: error instanceof Error ? error.message : "The engine would not start",
        });
      });

    return () => {
      live = false;
      current.stop();
    };
  }, [fen, enabled, depth, lines]);

  // Tear the worker down for good when the viewer goes away.
  React.useEffect(() => {
    return () => {
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);

  return state;
}
