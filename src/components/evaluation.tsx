import { Cpu, Loader2, Settings2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { EngineOptions } from "@/hooks/use-engine";
import { evaluationShare, formatEvaluation, type Evaluation } from "@/lib/engine";
import { cn } from "@/lib/utils";

/**
 * The evaluation bar, running down the side of the board.
 *
 * White fills from the bottom, which is the convention on every chess site, so
 * it needs no legend. It follows the board when the board is flipped, because a
 * bar that disagrees with the orientation in front of you is worse than none.
 */
export function EvalBar({
  evaluation,
  flipped = false,
  className,
}: {
  evaluation: Evaluation | null;
  flipped?: boolean;
  className?: string;
}) {
  const share = evaluation ? evaluationShare(evaluation) : 0.5;

  return (
    <div
      className={cn("relative w-3 shrink-0 overflow-hidden rounded-sm border bg-neutral-800", className)}
      role="img"
      aria-label={evaluation ? `Evaluation ${formatEvaluation(evaluation)}` : "No evaluation yet"}
    >
      <div
        className={cn(
          "absolute inset-x-0 bg-neutral-100 transition-[height] duration-300",
          flipped ? "top-0" : "bottom-0",
        )}
        style={{ height: `${share * 100}%` }}
      />
    </div>
  );
}

/**
 * The engine's lines, each move hoverable.
 *
 * Pointing at a move puts that position on the board, so a line can be read
 * without playing it out, and clicking keeps it as a line to carry on from.
 * This is the part that turns an evaluation from a number into something you
 * can look at.
 */
export function EvalLines({
  lines,
  thinking,
  error,
  onPreview,
  onCommit,
  className,
}: {
  lines: Evaluation[];
  thinking: boolean;
  error: string | null;
  /** Line index and how many moves of it to show, or null to put the board back. */
  onPreview: (preview: { line: number; moves: number } | null) => void;
  onCommit: (preview: { line: number; moves: number }) => void;
  className?: string;
}) {
  if (error) {
    return (
      <p className={cn("text-muted-foreground text-xs", className)}>
        The engine could not start, so there is no evaluation. Everything else on this page still works.
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <p className={cn("text-muted-foreground flex items-center gap-2 text-xs", className)}>
        <Loader2 className="size-3 animate-spin" />
        Thinking about this position.
      </p>
    );
  }

  return (
    <div className={cn("space-y-1", className)} onMouseLeave={() => onPreview(null)}>
      {lines.map((line, index) => (
        <div key={line.multipv} className="flex items-baseline gap-2 text-sm">
          <span
            className={cn(
              "tabular w-12 shrink-0 text-right font-semibold",
              index > 0 && "text-muted-foreground font-normal",
            )}
          >
            {formatEvaluation(line)}
          </span>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-0.5">
            {line.pv.slice(0, 10).map((move, moveIndex) => (
              <button
                key={moveIndex}
                type="button"
                onMouseEnter={() => onPreview({ line: index, moves: moveIndex + 1 })}
                onFocus={() => onPreview({ line: index, moves: moveIndex + 1 })}
                onClick={() => onCommit({ line: index, moves: moveIndex + 1 })}
                className="hover:bg-accent text-muted-foreground hover:text-foreground rounded px-1 py-0.5 font-mono text-xs"
              >
                {move}
              </button>
            ))}
          </div>
          {index === 0 && thinking && <Loader2 className="text-muted-foreground size-3 shrink-0 animate-spin" />}
          {index === 0 && <span className="text-muted-foreground ml-auto shrink-0 text-xs">depth {line.depth}</span>}
        </div>
      ))}
    </div>
  );
}

const DEPTHS = [10, 14, 18, 22];
const LINES = [1, 2, 3, 4, 5];

/**
 * Turn the engine off, and say how hard it should work.
 *
 * On by default on a game page, off everywhere else: Stockfish is 650KB of
 * WebAssembly that nothing but this page needs, so it is loaded here and never
 * by somebody looking up which board they are on. Only the position on screen
 * is ever analysed, on demand: nothing is precomputed and no evaluation is
 * kept, which is why more lines costs time rather than memory.
 */
export function EngineSwitch({
  enabled,
  onToggle,
  options,
  onOptions,
  className,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  options: EngineOptions;
  onOptions: (options: EngineOptions) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Cpu className="text-muted-foreground size-3.5" />
      <Label htmlFor="engine" className="cursor-pointer text-sm font-normal">
        Stockfish
      </Label>
      <Switch id="engine" checked={enabled} onCheckedChange={onToggle} />

      {enabled && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Engine settings">
              <Settings2 className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="depth" className="text-xs">
                Depth
              </Label>
              <Select
                value={String(options.depth)}
                onValueChange={(value) => onOptions({ ...options, depth: Number(value) })}
              >
                <SelectTrigger id="depth" size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPTHS.map((depth) => (
                    <SelectItem key={depth} value={String(depth)}>
                      {depth}
                      {depth === 14 && " (default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lines" className="text-xs">
                Lines
              </Label>
              <Select
                value={String(options.lines)}
                onValueChange={(value) => onOptions({ ...options, lines: Number(value) })}
              >
                <SelectTrigger id="lines" size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINES.map((lines) => (
                    <SelectItem key={lines} value={String(lines)}>
                      {lines === 1 ? "Best line only" : `Best ${lines} lines`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-muted-foreground text-xs/5">
              Deeper takes longer for each position. More lines makes every one of them slower, because the engine can
              no longer discard the alternatives.
            </p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
