import { RATING_SOURCE_LABEL, type Rating } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * A rating, or an honest gap where one would be.
 *
 * Unrated is shown as unrated. Substituting a zero, a dash in a numeric column
 * or an estimate would each read as a claim about how strong somebody is, and
 * several members simply have no published grade yet.
 */
export function RatingLabel({ rating, className }: { rating: Rating | null; className?: string }) {
  if (!rating) return <span className={cn("text-muted-foreground text-sm", className)}>Unrated</span>;

  return (
    <span className={cn("tabular text-sm", className)}>
      {rating.rating}
      {rating.source !== "ecf" && (
        <span className="text-muted-foreground ml-1 text-xs">{RATING_SOURCE_LABEL[rating.source]}</span>
      )}
    </span>
  );
}

/** The direction of travel, when there is more than one rating to compare. */
export function RatingTrend({ ratings }: { ratings: Rating[] }) {
  const latest = ratings.at(-1);
  const previous = ratings.at(-2);
  if (!latest || !previous) return null;

  const change = latest.rating - previous.rating;
  if (change === 0) return null;

  return (
    <span className={cn("tabular ml-1.5 text-xs", change > 0 ? "text-reply-yes" : "text-reply-no")}>
      {change > 0 ? "+" : ""}
      {change}
    </span>
  );
}
