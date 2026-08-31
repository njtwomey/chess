import { useSeason } from "@/components/season-context";

/**
 * The league's own pages live here rather than on the front page.
 *
 * They are the authority on fixtures and rules, and every player needs them at
 * some point, but nobody needs them twice a week. The footer is where a
 * reference link belongs: always reachable, never in the way.
 */
export function SiteFooter() {
  const { season } = useSeason();

  const links = [
    { href: season.team.links.fixtures, label: "Fixtures on the LMS" },
    { href: season.team.links.rules, label: "League rules" },
    { href: season.team.links.handbook, label: "FIDE Laws of Chess" },
  ].filter((link) => link.href);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {season.team.name} · {season.team.competition}
          </p>
          <p className="tabular">
            Selection seed <code className="font-mono">{season.seed}</code>
          </p>
        </div>
      </div>
    </footer>
  );
}
