import { ArrowRight, BookOpen, ExternalLink, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { Page, Section } from "@/components/page";
import { competitionLabel } from "@/components/competition-link";
import { HomeAway } from "@/components/home-away";
import { seasonPath } from "@/components/season-context";
import { Badge } from "@/components/ui/badge";
import { seasons } from "@/lib/data";
import type { Season } from "@/lib/schema";
import { coverage, nextMatch, opponentTeam, orderedMatches } from "@/lib/season";
import { formatShortDate, today } from "@/lib/time";

/**
 * A team's season, as one card and one link.
 *
 * The team and the division go across the top, because "Autumn 2026" is true of
 * every side at the club at once and says nothing about which one this is. The
 * season's own detail sits under them.
 *
 * The whole card is the link. A card whose header was a heading and whose body
 * was a link meant aiming at half of it, and there is exactly one place any of
 * it could go.
 */
function SeasonCard({ season }: { season: Season }) {
  const next = nextMatch(season, today());
  const spread = coverage(season);
  const played = orderedMatches(season).filter((match) => match.status === "played").length;

  return (
    <Link
      to={seasonPath(season.id)}
      className="hover:border-primary/40 group block overflow-hidden rounded-lg border transition-colors"
    >
      <div className="bg-accent border-b px-5 py-4">
        <h3 className="text-lg leading-tight font-semibold">{season.team.name}</h3>
        <p className="text-muted-foreground mt-0.5 text-sm">{competitionLabel(season)}</p>
      </div>

      <div className="group-hover:bg-accent/40 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3.5 transition-colors">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{season.name}</span>
            {season.active && <Badge variant="secondary">Current</Badge>}
          </span>
          <span className="text-muted-foreground block text-sm">
            {season.matches.length} fixtures, {played} played · {spread.players} players
          </span>
        </span>

        {next && (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Next:</span>
            <HomeAway home={next.home} size="xs" />
            <span className="font-medium">{opponentTeam(season, next).name}</span>
            <span className="text-muted-foreground tabular">{formatShortDate(next.date)}</span>
            <ArrowRight className="text-muted-foreground size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
    </Link>
  );
}

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
 * The seasons the front page will admit to.
 *
 * The prototype is invented from end to end and exists to show somebody how the
 * site works. Putting it beside the real season on the way in invites a reader
 * to open it by mistake and take an invented team sheet for a real one. It
 * stays reachable from the season picker, which is a deliberate act.
 */
const real = seasons.filter((season) => !season.prototype);

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

  return (
    <Page title={current?.club.name ?? "Chess"} lede={leagues.join(" · ") || undefined}>
      <Section title="Teams" description="Fixtures, availability and results live inside a season.">
        <div className="space-y-4">
          {real.map((season) => (
            <SeasonCard key={season.id} season={season} />
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
