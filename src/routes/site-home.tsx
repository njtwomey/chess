import { ArrowRight, BookOpen, CalendarDays, ExternalLink, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { Page, Section } from "@/components/page";
import { CompetitionLink } from "@/components/competition-link";
import { seasonPath } from "@/components/season-context";
import { Badge } from "@/components/ui/badge";
import { seasons } from "@/lib/data";
import type { Season } from "@/lib/schema";
import { coverage, nextMatch, opponentTeam, orderedMatches } from "@/lib/season";
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
            {opponentTeam(season, next).name}
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

/**
 * The league's own pages, at the top rather than only in the footer.
 *
 * Three links that are needed rarely but urgently: the fixture list when
 * somebody doubts a date, the rules when there is an argument, and the Laws
 * when the argument is about the game itself. They are the authority and this
 * site is a derived view, so they belong where somebody looking for the source
 * will find them without being told.
 */
function LeagueLinks({ season }: { season: Season }) {
  const links = [
    {
      href: season.team.links.fixtures,
      label: "Fixtures",
      Icon: CalendarDays,
      blurb: "The league's own table. If it and this site disagree, it is right.",
    },
    {
      href: season.league.links.rules,
      label: "League rules",
      Icon: Scale,
      blurb: `How the ${season.league.name.replace(/ Chess League$/, "")} league is run.`,
    },
    {
      href: season.league.links.handbook,
      label: "Laws of Chess",
      Icon: BookOpen,
      blurb: "FIDE, for when the argument is about the game.",
    },
  ].filter((link) => link.href !== null);
  if (links.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {links.map(({ href, label, Icon, blurb }) => (
        <a
          key={label}
          href={href ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="hover:border-primary/40 hover:bg-accent/40 group bg-card block rounded-lg border p-4 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="text-primary size-4 shrink-0" />
            <span className="font-medium">{label}</span>
            <ExternalLink className="text-muted-foreground ml-auto size-3.5 shrink-0" />
          </div>
          <p className="text-muted-foreground mt-1.5 text-sm/6">{blurb}</p>
        </a>
      ))}
    </div>
  );
}

function TeamBlock({ teamId }: { teamId: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {real
        .filter((season) => season.team.id === teamId)
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
  // The most recent real season speaks for the club: the team's name, its club
  // and the competition it is in are all facts about a season now, so there is
  // no separate record of them to fall out of step.
  const current = real[0];
  // Only sides that have a season to show, so no heading stands over an empty
  // grid. Newest first, which is the order the seasons come in.
  const sides = [...new Set(real.map((season) => season.team.id))];

  return (
    <Page
      title={current?.team.name ?? "Chess"}
      lede={
        current ? (
          <>
            {current.club.name} · <CompetitionLink season={current} />
          </>
        ) : undefined
      }
    >
      {current && <LeagueLinks season={current} />}

      <Section title="Seasons" description="Fixtures, availability and results live inside a season.">
        {sides.map((teamId) => (
          <TeamBlock key={teamId} teamId={teamId} />
        ))}
      </Section>
    </Page>
  );
}
