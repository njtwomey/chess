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
 * The shape of the whole season, on a page of its own.
 *
 * It used to be what a season opened on, which made it the one page here with
 * no name and no way back to it: somebody who navigated off had to work out
 * that the season's own link was the way to return. Giving it a URL and a place
 * in the header makes it shareable and returnable, which is what everything
 * else on this site already is.
 */
export function SeasonCalendar() {
  const { season } = useSeason();

  return (
    <Page
      title="Calendar"
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
        title="Fixtures"
        description="On Tuesdays unless the league says otherwise, always at 19:30. Every marked day links to the match."
        actions={<CalendarKey />}
      >
        <FixtureCalendar season={season} />
      </Section>
    </Page>
  );
}
