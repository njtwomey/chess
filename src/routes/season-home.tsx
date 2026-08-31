import { Download } from "lucide-react";
import { CalendarKey, FixtureCalendar } from "@/components/fixture-calendar";
import { Page, Section } from "@/components/page";
import { CompetitionLink } from "@/components/competition-link";
import { useSeason } from "@/components/season-context";
import { Button } from "@/components/ui/button";
import { venueById } from "@/lib/data";
import { icsFilename, toIcs } from "@/lib/ics";

/**
 * Download the calendar the page is already showing.
 *
 * Built in the browser from the same data rather than served as a file, so a
 * rearranged fixture cannot leave a stale .ics sitting in public/.
 */
function DownloadIcs() {
  const { season } = useSeason();

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
    <Button variant="outline" size="sm" onClick={download}>
      <Download className="size-3.5" />
      Add to calendar
    </Button>
  );
}

/**
 * A season's front page: the calendar, and nothing else.
 *
 * Everything that used to sit around it was either a second route to somewhere
 * the header already goes or a summary of a page one click away. The calendar
 * is the one thing here that is not available anywhere else: it shows the shape
 * of the whole season at a glance, and every marked day is a link.
 */
export function SeasonHome() {
  const { season } = useSeason();

  return (
    <Page
      title={season.team.name}
      lede={
        <>
          <CompetitionLink team={season.team} /> · {season.name}
        </>
      }
      actions={<DownloadIcs />}
    >
      {season.prototype && (
        <div className="border-reply-unsure/40 bg-reply-unsure-soft/40 text-reply-unsure mb-6 rounded-lg border px-4 py-3 text-sm">
          <strong className="font-semibold">This season is invented.</strong> The players, ratings, results and games in{" "}
          {season.name} are made up so the site can be tried out end to end. Switch to Autumn 2026 in the header for the
          real fixture list.
        </div>
      )}

      <Section
        title="The season"
        description="Fixtures are on Tuesdays unless the league says otherwise, always at 19:30. Every marked day links to the match."
        actions={<CalendarKey />}
      >
        <FixtureCalendar season={season} />
      </Section>
    </Page>
  );
}
