import { ExternalLink, Scissors } from "lucide-react";
import { KnightIcon, PawnIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chesscomUrl, lichessUrl } from "@/lib/links";
import { cn } from "@/lib/utils";

/**
 * Send this game somewhere that can analyse it properly.
 *
 * Both sites take a PGN in the query string and both refuse a long one, so a
 * long game goes without its tags and, past that, without its last few moves.
 * The scissors say when that has happened: an analysis board quietly missing
 * the end of the game is worse than one that says so, and the PGN below the
 * board is always the whole thing.
 */
export function AnalysisLinks({ pgn, className }: { pgn: string; className?: string }) {
  const targets = [
    { name: "Lichess", ...lichessUrl(pgn), Icon: KnightIcon },
    { name: "Chess.com", ...chesscomUrl(pgn), Icon: PawnIcon },
  ];
  const clipped = targets.some((target) => target.clipped);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {targets.map(({ name, url, Icon }) => (
        <Button key={name} variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <Icon className="size-3.5" />
            {name}
            <ExternalLink className="size-3" />
          </a>
        </Button>
      ))}
      {clipped && <ClippedNote />}
    </div>
  );
}

/**
 * Why the analysis board stops before the game does.
 *
 * An icon rather than a word, because it sits in a row of icons and a game that
 * fits says nothing at all. The tooltip has to carry the whole of it: that the
 * link is short, why, and what to do instead, which is to take the PGN and give
 * it to whichever engine you prefer.
 */
export function ClippedNote({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label="This link is shortened"
          className={cn("text-muted-foreground inline-flex items-center p-1.5", className)}
          onClick={(event) => event.stopPropagation()}
        >
          <Scissors className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Shortened, because the game is too long for a link: these open without the last moves. Copy the PGN instead and
        paste it into the engine of your choice.
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The same thing as two icons, for a row in a table.
 *
 * A full button per site would swamp a list of sixteen games, but the links are
 * worth having there: most people want to open a game in an analysis board
 * without stopping at the game's own page first.
 */
export function AnalysisIcons({ pgn, className }: { pgn: string; className?: string }) {
  const targets = [
    { name: "Open in Lichess", ...lichessUrl(pgn), Icon: KnightIcon },
    { name: "Open in Chess.com", ...chesscomUrl(pgn), Icon: PawnIcon },
  ];

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {targets.some((target) => target.clipped) && <ClippedNote />}
      {targets.map(({ name, url, Icon }) => (
        <Tooltip key={name}>
          <TooltipTrigger asChild>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={name}
              // The row is itself a link, so a click here must not also follow it.
              onClick={(event) => event.stopPropagation()}
              className="text-muted-foreground hover:text-primary hover:bg-accent rounded p-1.5 transition-colors"
            >
              <Icon className="size-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent>{name}</TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}
