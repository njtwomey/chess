import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Page, Section } from "@/components/page";
import { CompetitionLink } from "@/components/competition-link";
import { seasonPath } from "@/components/season-context";
import { Badge } from "@/components/ui/badge";
import { seasons, teams } from "@/lib/data";
import type { Team } from "@/lib/schema";
import { coverage, nextMatch, orderedMatches } from "@/lib/season";
import { formatShortDate, today } from "@/lib/time";

/**
 * The way into a season, with enough on it to choose.
 *
 * A season is mostly a name and a date range, which is not much to pick from,
 * so each card carries what actually distinguishes one: how far through it is
 * and what happens next.
 */
function SeasonCard({ season }: { season: (typeof seasons)[number] }) {
  const next = nextMatch(season, today());
  const spread = coverage(season);
  const played = orderedMatches(season).filter((match) => match.status === "played").length;

  return (
    <Link
      to={seasonPath(season.id)}
      className="hover:border-primary/40 hover:bg-accent/40 group block rounded-lg border p-4 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{season.name}</span>
        {season.active && <Badge variant="secondary">Current</Badge>}
      </div>

      <p className="text-muted-foreground mt-1 text-sm">
        {season.matches.length} fixtures, {played} played · {spread.players} players
      </p>

      {next && (
        <p className="mt-3 flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Next:</span>
          <span className="font-medium">
            {next.home ? "" : "away to "}
            {next.opponent}
          </span>
          <span className="text-muted-foreground tabular">{formatShortDate(next.date)}</span>
          <ArrowRight className="text-muted-foreground size-3.5 transition-transform group-hover:translate-x-0.5" />
        </p>
      )}
    </Link>
  );
}

/**
 * The seasons the front page will admit to.
 *
 * The prototype is invented from end to end and exists to show somebody how the
 * site works. Putting it beside the real season on the way in invites a reader
 * to open it by mistake and take an invented team sheet for a real one. It
 * stays reachable from the season picker, which is a deliberate act.
 */
const real = seasons.filter((season) => !season.prototype);

function TeamBlock({ team }: { team: Team }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {real
        .filter((season) => season.teamId === team.id)
        .map((season) => (
          <SeasonCard key={season.id} season={season} />
        ))}
    </div>
  );
}

/**
 * The front of the site, and the only page that is about the club rather than
 * about one season.
 *
 * Everything season-specific hangs off a season, so this exists to say what the
 * team is and let somebody choose which season they mean. The rest of the
 * global half, the venues and the selection rule, is one click from here and
 * from the header.
 */
export function SiteHome() {
  const team = teams[0];
  // A team with nothing to show would render an empty grid under a heading.
  const sides = teams.filter((entry) => real.some((season) => season.teamId === entry.id));

  return (
    <Page
      title={team?.name ?? "Chess"}
      lede={
        team ? (
          <>
            {team.club} · <CompetitionLink team={team} />
          </>
        ) : undefined
      }
    >
      <p className="max-w-2xl text-[0.95rem]/7">A transparent organiser for picking teams for the chess league.</p>

      <Section title="Seasons" description="Fixtures, availability and results live inside a season.">
        {sides.map((entry) => (
          <TeamBlock key={entry.id} team={entry} />
        ))}
      </Section>
    </Page>
  );
}
