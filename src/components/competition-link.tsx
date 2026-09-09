import type { Season } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * The competition, linking out to the league's own fixture list.
 *
 * The LMS is the authority on dates, results and standings, and this site is a
 * derived view of it. Hanging the link off the name of the competition puts it
 * where somebody would look to check one against the other, rather than making
 * them remember it is in the footer. It stays in the footer as well, because
 * that is where you go when you want it and are not already reading a subtitle.
 *
 * The name belongs to the league and the link to our team in it, which is why
 * this takes the season rather than either one on its own.
 */
/** The competition in words, for the places that cannot hold a link. */
export function competitionLabel(season: Season): string {
  return season.division === null ? season.league.name : `${season.league.name}, Division ${season.division}`;
}

export function CompetitionLink({ season, className }: { season: Season; className?: string }) {
  const label = competitionLabel(season);
  if (!season.team.links.fixtures) return <>{label}</>;

  return (
    <a
      href={season.team.links.fixtures}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "underline decoration-dotted underline-offset-4 transition-colors",
        className ?? "hover:text-foreground",
      )}
    >
      {label}
    </a>
  );
}
