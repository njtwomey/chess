import { Download } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { Empty, Page, Section } from "@/components/page";
import { CompetitionLink } from "@/components/competition-link";
import { useSeason } from "@/components/season-context";
import { Button } from "@/components/ui/button";
import { icsFilename, toIcs } from "@/lib/ics";
import { boardExceptions, boardsFor, orderedMatches } from "@/lib/season";
import { today } from "@/lib/time";

/** "a", "a and b", "a, b and c": a list read aloud rather than printed. */
function listOut(parts: string[]): string {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function Schedule() {
  const { season } = useSeason();
  const matches = orderedMatches(season);
  // The season's shape, stated as a fact, so an evening played over a different
  // number of boards has to be named rather than averaged away.
  const exceptions = boardExceptions(season);
  const now = today();
  const upcoming = matches.filter((match) => match.date >= now && match.status !== "played");
  const past = matches.filter((match) => !upcoming.includes(match)).reverse();
  const [next, ...rest] = upcoming;

  const download = () => {
    const blob = new Blob([toIcs(season)], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = icsFilename(season);
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Page
      title="Schedule"
      lede={
        <>
          {season.matches.length} fixtures, {season.boards} boards each
          {exceptions.length > 0 &&
            ` except ${listOut(exceptions.map((match) => `fixture ${match.number} over ${boardsFor(season, match)}`))}`}
          , all starting at 19:30. Fixtures come from the <CompetitionLink season={season} />.
        </>
      }
      actions={
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-3.5" />
          Add to calendar
        </Button>
      }
    >
      {next && (
        <Section title="Next game" description="The one to plan around.">
          {/* Lifted out of the list and given the accent, because on a page of
              seven near-identical cards the next one is what almost everybody
              came to find. */}
          <MatchCard season={season} match={next} className="border-primary/50 bg-accent/30 shadow-sm" />
        </Section>
      )}

      <Section title={next ? "Later this season" : "Still to play"}>
        {rest.length === 0 ? (
          <Empty>{next ? "Nothing else this season." : "Nothing left this season."}</Empty>
        ) : (
          <div className="space-y-3">
            {rest.map((match) => (
              <MatchCard key={match.id} season={season} match={match} />
            ))}
          </div>
        )}
      </Section>

      {past.length > 0 && (
        <Section title="Played">
          <div className="space-y-3">
            {past.map((match) => (
              <MatchCard key={match.id} season={season} match={match} />
            ))}
          </div>
        </Section>
      )}
    </Page>
  );
}
