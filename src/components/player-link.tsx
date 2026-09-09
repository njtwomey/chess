import type { Player } from "@/lib/schema";
import { playerUrl } from "@/lib/links";
import { RatingLabel } from "@/components/rating";
import { ratingOn } from "@/lib/season";
import { cn } from "@/lib/utils";

/**
 * A player's name, linked to their record where there is one.
 *
 * Used for both sides of the board on purpose. Opponents arrived with a league
 * page and ours with an ECF code, and for a while only theirs was clickable,
 * which read as a slight rather than as the accident it was.
 */
export function PlayerLink({ player, className }: { player: Player; className?: string }) {
  const url = playerUrl(player);
  if (!url) return <span className={className}>{player.name}</span>;

  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn("hover:text-primary hover:underline", className)}>
      {player.name}
    </a>
  );
}

/**
 * A player as every table shows them: their name, linked, and their rating.
 *
 * One component because the pairing was being assembled by hand in four places,
 * and they had already drifted: on one page a player was a link and on the next
 * the same player was not. A table that wants only the name still uses
 * `PlayerLink`; anything showing a rating beside it should use this.
 *
 * `on` is the date the rating should be read as at, which is how our own are
 * shown: the grade that applied when the game was played, not today's. Left out
 * for an opponent, whose short rating list is by construction what was read at
 * the time.
 */
export function PlayerCell({
  player,
  on,
  badge,
  className,
}: {
  player: Player;
  on?: string;
  /** Anything that belongs beside the name, such as a captain or junior mark. */
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <PlayerLink player={player} className="font-medium" />
      {badge}
      <span className="text-muted-foreground text-xs">
        <RatingLabel rating={ratingOn(player, on)} />
      </span>
    </span>
  );
}
