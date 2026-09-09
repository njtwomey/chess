import * as React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { Page } from "@/components/page";
import { SeasonProvider, seasonPath, splitSeasonPath, useSeason } from "@/components/season-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteHome } from "@/routes/site-home";

/**
 * The site home is in the main bundle because it is what almost everyone opens
 * first. Everything else is split, so a player checking where they are playing
 * on Tuesday does not download the game viewer and chessground with it.
 */
const SeasonCalendar = React.lazy(() => import("@/routes/calendar").then((m) => ({ default: m.SeasonCalendar })));
const Schedule = React.lazy(() => import("@/routes/schedule").then((m) => ({ default: m.Schedule })));
const Team = React.lazy(() => import("@/routes/team").then((m) => ({ default: m.Team })));
const Games = React.lazy(() => import("@/routes/games").then((m) => ({ default: m.Games })));
const Clubs = React.lazy(() => import("@/routes/clubs").then((m) => ({ default: m.Clubs })));
const GamePage = React.lazy(() => import("@/routes/games").then((m) => ({ default: m.GamePage })));
const MatchPage = React.lazy(() => import("@/routes/match").then((m) => ({ default: m.MatchPage })));
const HowItWorks = React.lazy(() => import("@/routes/how-it-works").then((m) => ({ default: m.HowItWorks })));

/**
 * A client-side navigation keeps the old scroll position, which lands you
 * halfway down a page you have not read.
 */
function ScrollOnNavigate() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    // A block body on purpose. Returning `window.scrollTo(...)` from the arrow
    // hands React whatever that call evaluates to, and React treats an effect's
    // return value as the cleanup function, so anything other than undefined
    // takes the whole app down on the next navigation.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * The entry point sends you to a season-scoped URL.
 *
 * Every page worth sharing names its season in the path, so a link pasted into
 * the group chat opens what the sender was looking at. This is the one place
 * that consults the reader's own last choice, and it redirects rather than
 * rendering so the address bar always shows something shareable.
 */
function EnterSeason({ page }: { page?: string }) {
  const { season } = useSeason();
  return <Navigate to={seasonPath(season.id, page)} replace />;
}

/**
 * Everything under a season, dispatched by hand.
 *
 * A season id is itself a path, so `:seasonId` cannot match it and a fixed
 * shape would bake its depth into every route in the app. A splat plus a lookup
 * costs one function and stays right whatever the ids look like.
 *
 * A season on its own redirects to its calendar rather than rendering it, so
 * the calendar has exactly one URL: two paths showing the same page is how a
 * shared link stops matching what the header says is current.
 */
const SEASON_PAGES: Record<string, React.ComponentType> = {
  calendar: SeasonCalendar,
  schedule: Schedule,
  team: Team,
  games: Games,
};

function SeasonRoutes() {
  const { pathname } = useLocation();
  const found = splitSeasonPath(pathname);
  if (!found) return <Navigate to="/" replace />;

  const { season, page } = found;
  if (page === "") return <Navigate to={seasonPath(season.id, "calendar")} replace />;

  const Known = SEASON_PAGES[page];
  if (Known) return <Known />;

  // A fixture, and under it a board. Both say what they are, so the path needs
  // no `/match/` or `/board/` segment to explain them.
  const parts = /^(fixture-\d+)(?:\/(board-\d+))?$/.exec(page);
  if (!parts?.[1]) return <Navigate to={seasonPath(season.id, "schedule")} replace />;
  if (!parts[2]) return <MatchPage seasonId={season.id} matchId={parts[1]} />;
  return <GamePage seasonId={season.id} matchId={parts[1]} board={Number(parts[2].slice("board-".length))} />;
}

function RouteFallback() {
  return (
    <Page>
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </Page>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={200}>
        <Router basename={import.meta.env.BASE_URL}>
          <SeasonProvider>
            <ScrollOnNavigate />
            <div className="flex min-h-dvh flex-col">
              <SiteHeader />
              <React.Suspense fallback={<RouteFallback />}>
                <Routes>
                  {/* The global half: about the club, not about one season. */}
                  <Route path="/" element={<SiteHome />} />
                  <Route path="/clubs" element={<Clubs />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />

                  {/* Season-scoped, and therefore shareable. The season id is
                      a path in its own right, so one splat covers every page
                      under it, fixtures and boards included. */}
                  <Route path="/season/*" element={<SeasonRoutes />} />

                  {/* The unscoped forms are kept as entry points: someone who
                    types /schedule, or follows a link from before the season
                    was in the path, lands on the current season's version. */}
                  <Route path="/calendar" element={<EnterSeason page="calendar" />} />
                  <Route path="/schedule" element={<EnterSeason page="schedule" />} />
                  <Route path="/team" element={<EnterSeason page="team" />} />
                  <Route path="/games" element={<EnterSeason page="games" />} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </React.Suspense>
              <SiteFooter />
            </div>
          </SeasonProvider>
        </Router>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
