import { ExternalLink } from "lucide-react";
import { KnightIcon, PawnIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chesscomUrl, lichessUrl } from "@/lib/links";
import { cn } from "@/lib/utils";

/**
 * Send this game somewhere that can analyse it properly.
 *
 * Both sites take a PGN in the query string, and both refuse a URL past a
 * couple of thousand characters. When a game is too long the button is dropped
 * rather than shown broken, and the PGN box below the board is the way through.
 */
export function AnalysisLinks({ pgn, className }: { pgn: string; className?: string }) {
  const targets = [
    { name: "Lichess", url: lichessUrl(pgn), Icon: KnightIcon },
    { name: "Chess.com", url: chesscomUrl(pgn), Icon: PawnIcon },
  ].filter((target) => target.url !== null);

  if (targets.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {targets.map(({ name, url, Icon }) => (
        <Button key={name} variant="outline" size="sm" asChild>
          <a href={url ?? undefined} target="_blank" rel="noreferrer">
            <Icon className="size-3.5" />
            {name}
            <ExternalLink className="size-3" />
          </a>
        </Button>
      ))}
    </div>
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
    { name: "Open in Lichess", url: lichessUrl(pgn), Icon: KnightIcon },
    { name: "Open in Chess.com", url: chesscomUrl(pgn), Icon: PawnIcon },
  ].filter((target) => target.url !== null);

  if (targets.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {targets.map(({ name, url, Icon }) => (
        <Tooltip key={name}>
          <TooltipTrigger asChild>
            <a
              href={url ?? undefined}
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
