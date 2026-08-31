import * as React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { Page } from "@/components/page";
import { SeasonProvider, seasonPath, useSeason } from "@/components/season-context";
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
const SeasonHome = React.lazy(() => import("@/routes/season-home").then((m) => ({ default: m.SeasonHome })));
const Schedule = React.lazy(() => import("@/routes/schedule").then((m) => ({ default: m.Schedule })));
const Team = React.lazy(() => import("@/routes/team").then((m) => ({ default: m.Team })));
const Games = React.lazy(() => import("@/routes/games").then((m) => ({ default: m.Games })));
const Venues = React.lazy(() => import("@/routes/venues").then((m) => ({ default: m.Venues })));
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
                  <Route path="/venues" element={<Venues />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />

                  {/* Season-scoped, and therefore shareable. */}
                  <Route path="/season/:seasonId" element={<SeasonHome />} />
                  <Route path="/season/:seasonId/schedule" element={<Schedule />} />
                  <Route path="/season/:seasonId/team" element={<Team />} />
                  <Route path="/season/:seasonId/games" element={<Games />} />
                  {/* Venues used to hang off a season and was published that
                      way, so an old link keeps working rather than silently
                      landing somebody on the front page. */}
                  <Route path="/season/:seasonId/venues" element={<Navigate to="/venues" replace />} />

                  {/* A match belongs to a season and a game is a board of a
                      match, so the path says exactly that. It also lets a match
                      be `r1` rather than repeating the season id inside it. */}
                  <Route path="/season/:seasonId/match/:matchId" element={<MatchPage />} />
                  <Route path="/season/:seasonId/match/:matchId/board/:board" element={<GamePage />} />

                  {/* The unscoped forms are kept as entry points: someone who
                    types /schedule, or follows a link from before the season
                    was in the path, lands on the current season's version. */}
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
