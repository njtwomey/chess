import { ChevronDown, Crown, Menu, Moon, Sun } from "lucide-react";
import * as React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { seasonPath, useSeason } from "@/components/season-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import { matchScore, orderedMatches } from "@/lib/season";
import { formatShortDate, today } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * `page` is undefined for the season's own home page, and everything else hangs
 * off the season so that every link in the header is one somebody can paste.
 * "How it works" is the exception: the rule is the same in every season.
 */
const NAV = [
  { page: undefined, label: "Home", end: true },
  { page: "schedule", label: "Schedule" },
  { page: "venues", label: "Venues" },
  { page: "team", label: "Team" },
  { page: "games", label: "Games" },
] as const;

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

function SeasonPicker() {
  const { season, seasons, setSeasonId } = useSeason();
  return (
    <Select value={season.id} onValueChange={setSeasonId}>
      <SelectTrigger size="sm" className="w-[9.5rem]" aria-label="Season">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {seasons.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Schedule, with every fixture hanging off it.
 *
 * The label still goes to the list, so the item behaves as it always did; the
 * chevron opens the rounds. Getting to a particular match was three clicks and
 * is now one, which matters because a match page is where the availability and
 * the team actually live.
 */
function ScheduleNav({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { season } = useSeason();
  const { pathname } = useLocation();
  const matches = orderedMatches(season);
  const onSchedule = pathname.startsWith(seasonPath(season.id, "schedule")) || pathname.includes("/match/");
  const now = today();

  // Which match is on screen, so the list can mark it. The label itself stays
  // just "Schedule": naming the round there as well says the same thing twice.
  const currentId = /\/match\/([^/]+)/.exec(pathname)?.[1] ?? null;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
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
                    // The same type and colours as the navbar itself: muted
                    // until it is where you are, then foreground and medium.
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

function useLinks() {
  const { season } = useSeason();

  return (onNavigate?: () => void, className?: string) => {
    const style = ({ isActive }: { isActive: boolean }) =>
      cn(
        "hover:text-foreground rounded-md transition-colors",
        isActive ? "text-foreground font-medium" : "text-muted-foreground",
        className,
      );

    return [
      ...NAV.map((item) =>
        item.page === "schedule" ? (
          <ScheduleNav key={item.label} onNavigate={onNavigate} className={className} />
        ) : (
          <NavLink
            key={item.label}
            to={seasonPath(season.id, item.page)}
            end={"end" in item ? item.end : false}
            onClick={onNavigate}
            className={style}
          >
            {item.label}
          </NavLink>
        ),
      ),
      <NavLink key="how" to="/how-it-works" onClick={onNavigate} className={style}>
        How it works
      </NavLink>,
    ];
  };
}

export function SiteHeader() {
  const { season } = useSeason();
  const links = useLinks();
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-5 sm:px-6">
        <NavLink to={seasonPath(season.id)} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Crown className="text-primary size-4.5" />
          <span className="hidden sm:inline">Bristol &amp; Clifton G</span>
          <span className="sm:hidden">B&amp;C G</span>
        </NavLink>

        {season.prototype && (
          <Badge variant="outline" className="border-reply-unsure/50 text-reply-unsure hidden shrink-0 md:inline-flex">
            Prototype data
          </Badge>
        )}

        <nav className="ml-auto hidden items-center gap-5 text-sm lg:flex">{links()}</nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-4">
          <SeasonPicker />
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="px-4 pt-4">Bristol &amp; Clifton G</SheetTitle>
              <nav className="flex flex-col gap-1 p-2 text-sm">
                {links(() => setOpen(false), "hover:bg-accent px-3 py-2")}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
