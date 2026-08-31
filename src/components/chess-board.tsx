import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Key } from "@lichess-org/chessground/types";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FlipVertical2, Undo2 } from "lucide-react";
import * as React from "react";
import { EvalBar, EvalLines } from "@/components/evaluation";
import { Button } from "@/components/ui/button";
import { DEFAULT_ENGINE_OPTIONS, useEngine, type EngineOptions } from "@/hooks/use-engine";
import { turnOf } from "@/lib/engine";
import { legalDests, movePairs, playLine, playMove, replay, type Ply } from "@/lib/pgn";
import { cn } from "@/lib/utils";

/**
 * Lichess's own board.
 *
 * chessground draws the position and handles dragging. It knows no rules, so
 * the legal moves come from chess.js and are handed to it as `dests`, and it
 * refuses anything else by construction.
 *
 * It is imperative and owns its DOM, so React creates it once and then pushes
 * state at it. Re-creating it per render would throw away its animation and
 * make every step through a game flicker.
 */
export function Board({
  fen,
  orientation = "white",
  lastMove,
  onMove,
  className,
}: {
  fen: string;
  orientation?: "white" | "black";
  lastMove?: [string, string] | null;
  /** Given a legal move, lets the reader explore a line. Omit for a static board. */
  onMove?: (from: string, to: string) => void;
  className?: string;
}) {
  const mount = React.useRef<HTMLDivElement>(null);
  const api = React.useRef<Api | null>(null);
  // Held in a ref so the handler chessground keeps hold of always calls the
  // current one, without tearing the board down to rebind it.
  const move = React.useRef(onMove);
  move.current = onMove;

  React.useEffect(() => {
    if (!mount.current) return;
    api.current = Chessground(mount.current, {
      fen,
      orientation,
      coordinates: true,
      animation: { enabled: true, duration: 180 },
      drawable: { enabled: false },
      movable: { free: false, showDests: true, events: { after: (from, to) => move.current?.(from, to) } },
    });
    return () => {
      api.current?.destroy();
      api.current = null;
    };
    // Created once on purpose: every later change goes through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Joined rather than passed as an array so a fresh array of the same two
  // squares does not count as a change.
  const highlight = lastMove ? `${lastMove[0]}${lastMove[1]}` : "";

  React.useEffect(() => {
    const turn = turnOf(fen);
    api.current?.set({
      fen,
      orientation,
      turnColor: turn,
      lastMove: highlight ? ([highlight.slice(0, 2), highlight.slice(2)] as Key[]) : undefined,
      movable: {
        free: false,
        // Only the side to move, and only where the rules allow.
        color: onMove ? turn : undefined,
        dests: onMove ? (legalDests(fen) as Map<Key, Key[]>) : new Map(),
        showDests: true,
      },
    });
  }, [fen, orientation, highlight, onMove]);

  return <div ref={mount} className={cn("aspect-square w-full", className)} />;
}

/** A line the reader played on the board, branching off the game at `at`. */
interface Variation {
  /** Index into the mainline of the position it starts from. */
  at: number;
  plies: Ply[];
}

/**
 * A game, with the moves beside it.
 *
 * Arrow keys work because that is how anybody who has used a chess site expects
 * to step through a game, and reaching for the mouse for every half-move is
 * enough friction to stop people looking at all.
 *
 * Pieces can be moved. Doing so never alters the game, which is a record of
 * something that happened: it opens a line, shown indented in the move list,
 * and one button puts it away again.
 */
export function GameViewer({
  pgn,
  orientation = "white",
  analysing = false,
  engineOptions = DEFAULT_ENGINE_OPTIONS,
  white = "White",
  black = "Black",
}: {
  pgn: string;
  orientation?: "white" | "black";
  analysing?: boolean;
  engineOptions?: EngineOptions;
  /** Who played each side, for the move list header. */
  white?: string;
  black?: string;
}) {
  const plies = React.useMemo(() => replay(pgn), [pgn]);
  const [ply, setPly] = React.useState(0);
  const [variation, setVariation] = React.useState<Variation | null>(null);
  /** Where we are inside the line, or null when following the game. */
  const [inLine, setInLine] = React.useState<number | null>(null);
  const [flipped, setFlipped] = React.useState(orientation === "black");
  const listRef = React.useRef<HTMLDivElement>(null);

  /**
   * The move list is exactly as tall as the board beside it.
   *
   * A fixed height guesses wrong at every viewport, and letting the list size
   * itself leaves a ragged edge next to a square board. Measuring is the only
   * way to have the two agree while the board is fluid.
   */
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [boardHeight, setBoardHeight] = React.useState<number | null>(null);
  React.useEffect(() => {
    const element = boardRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setBoardHeight(entries[0]?.contentRect.height ?? null));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const mainline = React.useMemo(() => plies ?? [], [plies]);
  const onLine = variation !== null && inLine !== null;
  const current: Ply | undefined = onLine ? variation.plies[inLine] : mainline[ply];
  const last = onLine ? variation.plies.length - 1 : mainline.length - 1;
  const position = onLine ? (inLine ?? 0) : ply;

  const { lines, thinking, error } = useEngine(current?.fen ?? "", analysing && current !== undefined, engineOptions);

  /**
   * Whatever the reader is pointing at, shown on the board without committing.
   *
   * Two kinds: a move of the game itself, which is already a position we hold,
   * and a move of an engine line, which has to be played out from here. Both
   * behave the same way to a reader, which is the point.
   */
  const [preview, setPreview] = React.useState<{ line: number; moves: number } | null>(null);
  const [hovered, setHovered] = React.useState<Ply | null>(null);

  const previewPlies = React.useMemo(() => {
    const pv = preview ? lines[preview.line]?.pv : undefined;
    if (!pv || !current) return [];
    return playLine(current.fen, pv.slice(0, preview?.moves ?? 0));
  }, [preview, lines, current]);

  const shown: Ply | undefined = previewPlies.at(-1) ?? hovered ?? current;

  const closeLine = React.useCallback(() => {
    setVariation(null);
    setInLine(null);
  }, []);

  const step = React.useCallback(
    (to: number) => {
      if (onLine) {
        // Stepping back off the front of a line returns to the game.
        if (to < 0) {
          setInLine(null);
          setPly(variation.at);
          return;
        }
        setInLine(Math.min(to, variation.plies.length - 1));
        return;
      }
      setPly(Math.min(Math.max(to, 0), mainline.length - 1));
    },
    [onLine, variation, mainline.length],
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      // Leave the keys alone while somebody is in the PGN box.
      const active = document.activeElement?.tagName;
      if (active === "TEXTAREA" || active === "INPUT") return;
      event.preventDefault();
      if (event.key === "ArrowLeft") step(position - 1);
      if (event.key === "ArrowRight") step(position + 1);
      if (event.key === "End") step(last);
      if (event.key === "Home") {
        closeLine();
        setPly(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, last, step, closeLine]);

  React.useEffect(() => {
    listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [ply, inLine, variation]);

  // A preview belongs to the position it was raised from; moving on drops it.
  React.useEffect(() => {
    setPreview(null);
    setHovered(null);
  }, [ply, inLine, variation]);

  /**
   * Playing a move opens or extends a line.
   *
   * Replaying the move the game actually went on to play just steps forward
   * instead. Somebody nudging a piece towards the next move means "go on", and
   * a variation identical to the game would be noise.
   */
  const onMove = React.useCallback(
    (from: string, to: string) => {
      if (!current) return;

      if (!onLine) {
        const next = mainline[ply + 1];
        if (next && next.from === from && next.to === to) {
          setPly(ply + 1);
          return;
        }
        const played = playMove(current.fen, from, to);
        if (!played) return;
        setVariation({ at: ply, plies: [played] });
        setInLine(0);
        return;
      }

      const played = playMove(current.fen, from, to);
      if (!played) return;
      // Truncate anything after where we are, then append: exploring from the
      // middle of a line replaces the rest of it rather than branching again.
      const next = [...variation.plies.slice(0, (inLine ?? 0) + 1), played];
      setVariation({ at: variation.at, plies: next });
      setInLine(next.length - 1);
    },
    [current, onLine, mainline, ply, variation, inLine],
  );

  if (!plies || !current) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        This PGN could not be read as a game. The moves are still in the box below, and both analysis links will take it
        as it is.
      </div>
    );
  }

  const board = shown ?? current;
  const pairs = movePairs(mainline);
  const atStart = position === 0 && !onLine;
  const label = atStart
    ? "Start"
    : `${current.moveNumber}${current.colour === "white" ? "." : "..."} ${current.san ?? ""}`;

  /**
   * A line is an aside, not the game, so it is set quieter than the moves it
   * hangs off: smaller, muted, and with a plain rule rather than an accent one.
   * It should read as somebody's exploration at a glance.
   */
  const lineBlock = variation && (
    <div className="border-border/80 my-1 ml-5 border-l pl-2" onMouseLeave={() => setHovered(null)}>
      <p className="text-muted-foreground/70 mb-0.5 text-[0.6rem] tracking-wide uppercase">Line</p>
      <div className="flex flex-wrap items-baseline gap-0.5">
        {variation.plies.map((move, index) => (
          <button
            key={index}
            type="button"
            data-current={onLine && inLine === index}
            onMouseEnter={() => setHovered(move)}
            onFocus={() => setHovered(move)}
            onClick={() => setInLine(index)}
            className={cn(
              "hover:bg-accent hover:text-foreground text-muted-foreground tabular rounded px-1 py-0.5 text-[0.7rem]",
              onLine && inLine === index && "bg-accent text-foreground font-medium",
            )}
          >
            <span className="text-muted-foreground/60 mr-0.5">
              {move.colour === "white" ? `${move.moveNumber}.` : index === 0 ? `${move.moveNumber}...` : ""}
            </span>
            {move.san}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,34rem)_minmax(0,15rem)] sm:items-start">
      <div className="space-y-3">
        <div ref={boardRef} className="flex gap-2">
          {/* The bar goes against the left edge of the board, which is where
              every chess site puts it and so where the eye already looks. */}
          {analysing && <EvalBar evaluation={lines[0] ?? null} flipped={flipped} />}
          <Board
            fen={board.fen}
            orientation={flipped ? "black" : "white"}
            lastMove={board.from && board.to ? [board.from, board.to] : null}
            // Pieces are for exploring the game, not the engine's daydream. A
            // previewed position is somebody else's line, so it is read-only.
            onMove={preview ? undefined : onMove}
            className="min-w-0 flex-1"
          />
        </div>

        {analysing && (
          <EvalLines
            lines={lines}
            thinking={thinking}
            error={error}
            onPreview={setPreview}
            onCommit={(chosen) => {
              const pv = lines[chosen.line]?.pv;
              if (!pv || !current) return;
              const played = playLine(current.fen, pv.slice(0, chosen.moves));
              if (played.length === 0) return;
              // Take the engine's line as a line of our own, to carry on from.
              setPreview(null);
              setVariation({
                at: onLine ? variation.at : ply,
                plies: onLine ? [...variation.plies.slice(0, (inLine ?? 0) + 1), ...played] : played,
              });
              setInLine((onLine ? (inLine ?? 0) + 1 : 0) + played.length - 1);
            }}
          />
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              closeLine();
              setPly(0);
            }}
            disabled={atStart}
            aria-label="First move"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => step(position - 1)}
            disabled={atStart}
            aria-label="Previous move"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => step(position + 1)}
            disabled={position === last}
            aria-label="Next move"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => step(last)}
            disabled={position === last}
            aria-label="Last move"
          >
            <ChevronsRight className="size-4" />
          </Button>

          <span className="text-muted-foreground tabular ml-2 truncate text-xs">{label}</span>

          {variation && (
            <Button variant="ghost" size="sm" onClick={closeLine} className="ml-auto shrink-0">
              <Undo2 className="size-3.5" />
              Back to the game
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("shrink-0", !variation && "ml-auto")}
            onClick={() => setFlipped((value) => !value)}
            aria-label="Flip the board"
          >
            <FlipVertical2 className="size-4" />
          </Button>
        </div>

        <p className="text-muted-foreground text-xs/5">
          Drag a piece to explore a line. The game itself is not changed.
        </p>
      </div>

      <div
        className="flex max-h-[24rem] flex-col overflow-hidden rounded-lg border sm:h-[var(--board-h,28rem)] sm:max-h-none"
        style={{ "--board-h": boardHeight ? `${boardHeight}px` : undefined } as React.CSSProperties}
      >
        <div className="bg-muted/50 text-muted-foreground flex shrink-0 items-baseline gap-1 border-b px-1 py-1.5 text-[0.7rem] font-medium">
          <span className="w-5 shrink-0" />
          <span className="min-w-[2.9rem] truncate px-1" title={white}>
            {white}
          </span>
          <span className="min-w-[2.9rem] truncate px-1" title={black}>
            {black}
          </span>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1 text-xs" onMouseLeave={() => setHovered(null)}>
          {pairs.length === 0 && <p className="text-muted-foreground p-3 text-xs">No moves recorded.</p>}
          {variation?.at === 0 && lineBlock}
          {pairs.map((pair) => {
            // The line is drawn immediately under the move it branches from.
            const branchesHere =
              variation !== null &&
              [pair.white, pair.black].some((move) => move !== null && mainline.indexOf(move) === variation.at);

            return (
              <div key={pair.number}>
                <div className="tabular flex items-baseline gap-1 px-1">
                  <span className="text-muted-foreground w-5 shrink-0 text-right text-[0.7rem]">{pair.number}.</span>
                  {([pair.white, pair.black] as const).map((move, side) =>
                    move ? (
                      <button
                        key={side}
                        type="button"
                        data-current={!onLine && mainline.indexOf(move) === ply}
                        onMouseEnter={() => setHovered(move)}
                        onFocus={() => setHovered(move)}
                        onClick={() => {
                          closeLine();
                          setPly(mainline.indexOf(move));
                        }}
                        className={cn(
                          "hover:bg-accent min-w-[2.9rem] rounded px-1 py-0.5 text-left",
                          !onLine &&
                            mainline.indexOf(move) === ply &&
                            "bg-primary text-primary-foreground hover:bg-primary",
                        )}
                      >
                        {move.san}
                      </button>
                    ) : (
                      <span key={side} className="min-w-[2.9rem]" />
                    ),
                  )}
                </div>

                {branchesHere && lineBlock}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
