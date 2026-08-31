import { Check, ChevronDown, Crown, Menu, Moon, Sun } from "lucide-react";
import * as React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { seasonPath, useSeason } from "@/components/season-context";
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
import { teams } from "@/lib/data";
import { matchScore, orderedMatches } from "@/lib/season";
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:text-foreground inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors">
        {inSeason ? season.name : "Choose a season"}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {teams.map((team) => (
          <React.Fragment key={team.id}>
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{team.name}</DropdownMenuLabel>
            {seasons
              .filter((entry) => entry.teamId === team.id)
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
 * The label still goes to the list; the chevron opens the rounds. Getting to a
 * particular match was three clicks and is now one, which matters because a
 * match page is where the availability and the team actually live.
 */
function ScheduleNav({ onNavigate }: { onNavigate?: () => void }) {
  const { season } = useSeason();
  const { pathname } = useLocation();
  const matches = orderedMatches(season);
  const onSchedule = pathname.startsWith(seasonPath(season.id, "schedule")) || pathname.includes("/match/");
  const now = today();
  const currentId = /\/match\/([^/]+)/.exec(pathname)?.[1] ?? null;

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
          <DropdownMenuContent align="start" className="w-68">
            {matches.map((match) => {
              const here = match.id === currentId;
              return (
                <DropdownMenuItem key={match.id} asChild>
                  <Link
                    to={seasonPath(season.id, `match/${match.id}`)}
                    onClick={onNavigate}
                    className={cn(
                      "text-muted-foreground focus:text-foreground cursor-pointer text-sm",
                      here && "text-foreground bg-accent font-medium",
                    )}
                  >
                    <span className="tabular w-4 shrink-0 text-xs opacity-70">{match.round}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {match.home ? "" : "away to "}
                      {match.opponent}
                    </span>
                    <span className="tabular shrink-0 text-xs opacity-70">
                      {match.status === "played" ? (matchScore(match) ?? "") : formatShortDate(match.date)}
                    </span>
                    {match.status === "scheduled" && match.date >= now && (
                      <span className="bg-primary size-1.5 shrink-0 rounded-full" />
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
          <NavLink to="/venues" className={linkStyle()}>
            Venues
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
                <NavLink to="/venues" onClick={close} className={linkStyle("hover:bg-accent px-3 py-2")}>
                  Venues
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
