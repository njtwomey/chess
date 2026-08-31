import type { Team } from "@/lib/schema";

/**
 * The competition, linking out to the league's own fixture list.
 *
 * The LMS is the authority on dates, results and standings, and this site is a
 * derived view of it. Hanging the link off the name of the competition puts it
 * where somebody would look to check one against the other, rather than making
 * them remember it is in the footer. It stays in the footer as well, because
 * that is where you go when you want it and are not already reading a subtitle.
 */
export function CompetitionLink({ team }: { team: Team }) {
  if (!team.links.fixtures) return <>{team.competition}</>;

  return (
    <a
      href={team.links.fixtures}
      target="_blank"
      rel="noreferrer"
      className="hover:text-foreground underline decoration-dotted underline-offset-4 transition-colors"
    >
      {team.competition}
    </a>
  );
}
