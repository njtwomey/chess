import { Download } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { Empty, Page, Section } from "@/components/page";
import { useSeason } from "@/components/season-context";
import { Button } from "@/components/ui/button";
import { venueById } from "@/lib/data";
import { icsFilename, toIcs } from "@/lib/ics";
import { orderedMatches } from "@/lib/season";
import { today } from "@/lib/time";

export function Schedule() {
  const { season } = useSeason();
  const matches = orderedMatches(season);
  const now = today();
  const upcoming = matches.filter((match) => match.date >= now && match.status !== "played");
  const past = matches.filter((match) => !upcoming.includes(match)).reverse();
  const [next, ...rest] = upcoming;

  const download = () => {
    const blob = new Blob([toIcs(season, venueById)], { type: "text/calendar;charset=utf-8" });
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
      lede={`${season.matches.length} fixtures, ${season.boards} boards each, all starting at 19:30.`}
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
