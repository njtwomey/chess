import { Link } from "react-router-dom";
import { seasonPath } from "@/components/season-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Match, Season } from "@/lib/schema";
import { orderedMatches } from "@/lib/season";
import { today } from "@/lib/time";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The days of one month, with blanks for the lead-in.
 *
 * Weeks start on Monday, because that is how a British calendar reads and a
 * fixture list where Saturday and Sunday sit apart from each other is harder to
 * scan than one where the weekend is at the end.
 */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [
    ...Array.from<null>({ length: lead }).fill(null),
    ...Array.from({ length: days }, (_, index) => `${year}-${pad(month + 1)}-${pad(index + 1)}`),
  ];
}

function monthsBetween(start: string, end: string): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  const [startYear = 0, startMonth = 1] = start.split("-").map(Number);
  const [endYear = 0, endMonth = 1] = end.split("-").map(Number);
  for (let year = startYear, month = startMonth - 1; year < endYear || (year === endYear && month < endMonth);) {
    out.push({ year, month });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return out;
}

const MONTH_NAME = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" });

export function FixtureCalendar({ season }: { season: Season }) {
  const byDate = new Map<string, Match>(orderedMatches(season).map((match) => [match.date, match]));
  const now = today();
  const months = monthsBetween(season.start, season.end);

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {months.map(({ year, month }) => {
        const days = monthGrid(year, month);
        const hasMatch = days.some((date) => date && byDate.has(date));
        return (
          <div key={`${year}-${month}`} className={cn("rounded-lg border p-3", !hasMatch && "opacity-55")}>
            <p className="mb-2 text-sm font-medium">
              {MONTH_NAME.format(new Date(Date.UTC(year, month, 1)))}{" "}
              <span className="text-muted-foreground font-normal">{year}</span>
            </p>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((day, index) => (
                <span key={index} className="text-muted-foreground pb-1 text-[0.65rem] font-medium">
                  {day}
                </span>
              ))}
              {days.map((date, index) => {
                if (!date) return <span key={index} />;
                const match = byDate.get(date);
                const day = Number(date.slice(-2));
                if (!match) {
                  return (
                    <span
                      key={date}
                      className={cn(
                        "tabular rounded py-1 text-xs",
                        date === now ? "ring-primary/40 font-semibold ring-1" : "text-muted-foreground",
                      )}
                    >
                      {day}
                    </span>
                  );
                }
                return (
                  <Tooltip key={date}>
                    <TooltipTrigger asChild>
                      <Link
                        to={seasonPath(season.id, `match/${match.id}`)}
                        className={cn(
                          "tabular block rounded py-1 text-xs font-semibold",
                          match.home
                            ? "bg-primary text-primary-foreground hover:opacity-85"
                            : "bg-fixture-away text-fixture-away-foreground hover:opacity-85",
                        )}
                      >
                        {day}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      {match.home ? "Home to " : "Away to "}
                      {match.opponent}, {match.time}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarKey() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="bg-primary size-3 rounded-sm" /> Home
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-fixture-away size-3 rounded-sm" /> Away
      </span>
    </div>
  );
}
