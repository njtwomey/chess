import { Check, ChevronDown, Crown, Menu, Moon, Sun } from "lucide-react";
import * as React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { seasonPath, splitSeasonPath, useSeason } from "@/components/season-context";
import { HomeAway } from "@/components/home-away";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { matchScore, opponentTeam, orderedMatches } from "@/lib/season";
import { formatShortDate, today } from "@/lib/time";
import { cn } from "@/lib/utils";

/** The pages that belong to a season rather than to the club. */
const SEASON_NAV = [
  { page: "team", label: "Team" },
  { page: "games", label: "Games" },
] as const;

const linkStyle =
  (extra?: string) =>
  ({ isActive }: { isActive: boolean }) =>
    cn(
      "hover:text-foreground rounded-md transition-colors",
      isActive ? "text-foreground font-medium" : "text-muted-foreground",
      extra,
    );

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
    >
      {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

/**
 * The way into a season, and the way between them.
 *
 * Grouped by team because `teams.json` is a list: there is one side today, and
 * grouping now costs nothing and means the shape does not have to change when
 * there is a second.
 */
function SeasonPicker({ onNavigate }: { onNavigate?: () => void }) {
  const { season, seasons, inSeason } = useSeason();

  // Grouped by the side whose campaign it is, in the order the seasons come in,
  // which is newest first. Taken from the seasons themselves because a team is
  // a fact about a season now: there is no separate list to fall behind.
  const sides = [...new Map(seasons.map((entry) => [entry.team.id, entry.team.name])).entries()];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:text-foreground inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors">
        {inSeason ? season.name : "Choose a season"}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {sides.map(([teamId, name]) => (
          <React.Fragment key={teamId}>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{name}</DropdownMenuLabel>
            {seasons
              .filter((entry) => entry.team.id === teamId)
              .map((entry) => {
                const here = inSeason && entry.id === season.id;
                return (
                  <DropdownMenuItem key={entry.id} asChild>
                    <Link
                      to={seasonPath(entry.id)}
                      onClick={onNavigate}
                      className={cn(
                        "text-muted-foreground focus:text-foreground cursor-pointer text-sm",
                        here && "text-foreground bg-accent font-medium",
                      )}
                    >
                      <span className="flex-1 truncate">{entry.name}</span>
                      {entry.prototype && (
                        <Badge variant="outline" className="text-[0.6rem]">
                          demo
                        </Badge>
                      )}
                      {here && <Check className="size-3.5" />}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            <DropdownMenuSeparator className="last:hidden" />
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Schedule, with every fixture hanging off it.
 *
 * The label still goes to the list; the chevron opens the fixtures. Getting to
 * a particular fixture was three clicks and is now one, which matters because a
 * fixture page is where the availability and the team actually live.
 */
function ScheduleNav({ onNavigate }: { onNavigate?: () => void }) {
  const { season } = useSeason();
  const { pathname } = useLocation();
  const matches = orderedMatches(season);
  // A fixture belongs to the schedule, so its page keeps the schedule lit. Both
  // questions come off the same split, because the season id has slashes in it
  // and picking either out of the path by hand gets that wrong.
  const page = splitSeasonPath(pathname)?.page ?? "";
  const onSchedule = page === "schedule" || page.startsWith("fixture-");
  const now = today();
  const currentId = page.startsWith("fixture-") ? (page.split("/")[0] ?? null) : null;

  return (
    <span className="inline-flex items-center gap-0.5">
      <NavLink
        to={seasonPath(season.id, "schedule")}
        onClick={onNavigate}
        className={cn(
          "hover:text-foreground rounded-md transition-colors",
          onSchedule ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        Schedule
      </NavLink>

      {matches.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Go to a match"
            className="text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {matches.map((match) => {
              const here = match.id === currentId;
              const score = matchScore(match);
              const won = match.result !== null && match.result.ourScore > match.result.theirScore;
              const lost = match.result !== null && match.result.ourScore < match.result.theirScore;
              return (
                <DropdownMenuItem key={match.id} asChild>
                  <Link
                    to={seasonPath(season.id, match.id)}
                    onClick={onNavigate}
                    className={cn(
                      "text-muted-foreground focus:text-foreground cursor-pointer text-sm",
                      here && "text-foreground bg-accent font-medium",
                    )}
                  >
                    <span className="tabular w-3 shrink-0 text-xs opacity-70">{match.number}</span>
                    <span className="tabular w-12 shrink-0 text-xs opacity-70">{formatShortDate(match.date)}</span>
                    <HomeAway home={match.home} size="xs" />
                    <span className="min-w-0 flex-1 truncate">{opponentTeam(season, match).name}</span>
                    {score ? (
                      <span
                        className={cn(
                          "tabular shrink-0 text-xs font-medium",
                          won && "text-reply-yes",
                          lost && "text-reply-no",
                          !won && !lost && "opacity-70",
                        )}
                      >
                        {score}
                      </span>
                    ) : (
                      match.date >= now &&
                      match.status === "scheduled" && <span className="bg-primary size-1.5 shrink-0 rounded-full" />
                    )}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}

/**
 * The season and its pages, in one box.
 *
 * The border is doing real work: it says that Schedule, Team and Games belong
 * to the season named beside them rather than to the site. Without it there is
 * nothing to tell a reader that switching season changes where those three
 * point. With no season chosen the box holds only the picker, which then reads
 * as an invitation rather than a label.
 */
function SeasonBox({ onNavigate }: { onNavigate?: () => void }) {
  const { season, inSeason } = useSeason();

  return (
    <div className="border-border/80 bg-muted/40 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-1.5 text-sm">
      <SeasonPicker onNavigate={onNavigate} />
      {inSeason && (
        <>
          <span className="bg-border h-4 w-px" aria-hidden />
          {/* Ahead of Schedule: the calendar is the shape of the season, and the
              schedule is the detail of it. */}
          <NavLink to={seasonPath(season.id, "calendar")} onClick={onNavigate} className={linkStyle()}>
            Calendar
          </NavLink>
          <ScheduleNav onNavigate={onNavigate} />
          {SEASON_NAV.map((item) => (
            <NavLink key={item.page} to={seasonPath(season.id, item.page)} onClick={onNavigate} className={linkStyle()}>
              {item.label}
            </NavLink>
          ))}
        </>
      )}
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();

  React.useEffect(() => setOpen(false), [pathname]);
  const close = () => setOpen(false);

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-5 sm:px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Crown className="text-primary size-4.5" />
          <span className="hidden sm:inline">Bristol &amp; Clifton G</span>
          <span className="sm:hidden">B&amp;C G</span>
        </NavLink>

        {/* Everything but the name hugs the right, in one run: the club's own
            pages, then the season and what belongs to it, then the theme. */}
        <nav className="ml-auto hidden items-center gap-4 text-sm lg:flex">
          <NavLink to="/" end className={linkStyle()}>
            Home
          </NavLink>
          <NavLink to="/clubs" className={linkStyle()}>
            Clubs
          </NavLink>
          <NavLink to="/how-it-works" className={linkStyle()}>
            Info
          </NavLink>
          <SeasonBox />
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-2">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="px-4 pt-4">Bristol &amp; Clifton G</SheetTitle>
              <nav className="flex flex-col gap-1 p-3 text-sm">
                <NavLink to="/" onClick={close} end className={linkStyle("hover:bg-accent px-3 py-2")}>
                  Home
                </NavLink>
                <NavLink to="/clubs" onClick={close} className={linkStyle("hover:bg-accent px-3 py-2")}>
                  Clubs
                </NavLink>
                <NavLink to="/how-it-works" onClick={close} className={linkStyle("hover:bg-accent px-3 py-2")}>
                  Info
                </NavLink>
                <div className="mt-3">
                  <SeasonBox onNavigate={close} />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
