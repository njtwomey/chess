import { useSeason } from "@/components/season-context";

/**
 * The league's own pages live here rather than on the front page.
 *
 * They are the authority on fixtures and rules, and every player needs them at
 * some point, but nobody needs them twice a week. The footer is where a
 * reference link belongs: always reachable, never in the way.
 */
export function SiteFooter() {
  const { season, inSeason } = useSeason();

  const links = [
    // One side's fixture list, so only where the page is about that side.
    { href: inSeason ? season.team.links.fixtures : null, label: `${season.team.name} on the LMS` },
    { href: season.league.links.rules, label: "League rules" },
    { href: season.league.links.handbook, label: "FIDE Laws of Chess" },
    { href: season.club.links.website, label: `${season.club.name}` },
  ].filter((link): link is { href: string; label: string } => link.href !== null && link.href !== undefined);

  return (
    <footer className="mt-auto border-t">
      <div className="text-muted-foreground mx-auto w-full max-w-5xl space-y-3 px-5 py-6 text-xs sm:px-6">
        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            ))}
            <span className="text-muted-foreground/70">If this site and the LMS disagree, the LMS is right.</span>
          </div>
        )}
        {/* Only where the page is about a season. The club has more than one
            side, and naming whichever was last looked at reads as a claim that
            it is the one this page is about. */}
        {inSeason && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {season.team.name} · {season.league.name}
              {season.division === null ? "" : `, Division ${season.division}`}
            </p>
            <p className="tabular">
              Selection seed <code className="font-mono">{season.seed}</code>
            </p>
          </div>
        )}
      </div>
    </footer>
  );
}
