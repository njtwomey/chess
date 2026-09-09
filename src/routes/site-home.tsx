import { ArrowRight, BookOpen, ExternalLink, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { Page, Section } from "@/components/page";
import { CompetitionLink } from "@/components/competition-link";
import { HomeAway } from "@/components/home-away";
import { seasonPath } from "@/components/season-context";
import { Badge } from "@/components/ui/badge";
import { seasons } from "@/lib/data";
import type { Season } from "@/lib/schema";
import { coverage, nextMatch, opponentTeam, orderedMatches } from "@/lib/season";
import { formatShortDate, today } from "@/lib/time";

/**
 * One season, as a row inside its team's card.
 *
 * A season is mostly a name and a date range, which is not much to pick from,
 * so the row carries what actually distinguishes one: how far through it is and
 * what happens next.
 */
function SeasonRow({ season }: { season: Season }) {
  const next = nextMatch(season, today());
  const spread = coverage(season);
  const played = orderedMatches(season).filter((match) => match.status === "played").length;

  return (
    <Link
      to={seasonPath(season.id)}
      className="hover:bg-accent/40 group flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3.5 transition-colors"
    >
      <div className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{season.name}</span>
          {season.active && <Badge variant="secondary">Current</Badge>}
        </span>
        <span className="text-muted-foreground block text-sm">
          {season.matches.length} fixtures, {played} played · {spread.players} players
        </span>
      </div>

      {next && (
        <span className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Next:</span>
          <HomeAway home={next.home} size="xs" />
          <span className="font-medium">{opponentTeam(season, next).name}</span>
          <span className="text-muted-foreground tabular">{formatShortDate(next.date)}</span>
          <ArrowRight className="text-muted-foreground size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
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
    <div className="grid gap-3 sm:grid-cols-2">
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

/**
 * A team, and every season it has played.
 *
 * The card is the team rather than the season, because two sides of one club
 * both run an "Autumn 2026" and a page of cards with that written on each of
 * them says nothing at all. The name and the division go across the top, where
 * somebody looking for their own team will find them, and the seasons are rows
 * underneath.
 */
function TeamCard({ teamId }: { teamId: string }) {
  const played = real.filter((season) => season.team.id === teamId);
  // The newest, for the heading: a team's division is a fact about a season and
  // moves with promotion, so the current one is the one worth putting at the top.
  const current = played[0];
  if (!current) return null;

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* The two together, stacked, because they are the pair that identifies
          the side: "Autumn 2026" is true of every team at the club at once. */}
      <div className="bg-team-soft border-b px-5 py-4">
        <h3 className="text-lg leading-tight font-semibold">{current.team.name}</h3>
        <p className="text-team mt-0.5 text-sm">
          <CompetitionLink season={current} className="hover:opacity-75" />
        </p>
      </div>
      <div className="divide-y">
        {played.map((season) => (
          <SeasonRow key={season.id} season={season} />
        ))}
      </div>
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
  // The club, not one of its sides. The front page used to be titled after the
  // most recent season's team, which named G and said nothing about F: the two
  // are equally the club's, and a player arriving here should not have to read
  // past somebody else's team to find their own.
  const current = real[0];
  const leagues = [...new Set(real.map((season) => season.league.name))];
  // Only sides that have a season to show, so no card stands over an empty one.
  // Newest first, which is the order the seasons come in.
  const sides = [...new Set(real.map((season) => season.team.id))];

  return (
    <Page title={current?.club.name ?? "Chess"} lede={leagues.join(" · ") || undefined}>
      <Section title="Teams" description="Fixtures, availability and results live inside a season.">
        <div className="space-y-4">
          {sides.map((teamId) => (
            <TeamCard key={teamId} teamId={teamId} />
          ))}
        </div>
      </Section>

      {/* At the bottom, because they are references rather than the way in:
          needed rarely and urgently, and never on the way to a fixture. */}
      {current && (
        <Section title="The rules" description="The documents every side here plays under." className="mt-8">
          <LeagueLinks season={current} />
        </Section>
      )}
    </Page>
  );
}
