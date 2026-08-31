import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activeSeason, seasonById, seasons } from "@/lib/data";
import type { Season } from "@/lib/schema";

const STORAGE_KEY = "season";

interface SeasonState {
  season: Season;
  seasons: Season[];
  /** Switch season and go to the same page under it. */
  setSeasonId: (id: string) => void;
}

const SeasonContext = React.createContext<SeasonState | null>(null);

/** Season-scoped pages live under /season/:seasonId, which is what makes them shareable. */
export function seasonPath(seasonId: string, page?: string): string {
  return page ? `/season/${seasonId}/${page}` : `/season/${seasonId}`;
}

/**
 * Which season a URL is about.
 *
 * The URL is the authority, not a stored preference, so a link pasted into the
 * group chat opens the season the sender was looking at rather than whichever
 * one the reader happened to choose last. Every page names its season, matches
 * and games included, which is why this is one regex and not a lookup.
 */
function seasonFromPath(pathname: string): Season | null {
  const scoped = /^\/season\/([^/]+)/.exec(pathname);
  return scoped?.[1] ? (seasonById.get(scoped[1]) ?? null) : null;
}

function storedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing blocks localStorage; the active season is a fine default.
    return null;
  }
}

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [preferred, setPreferred] = React.useState<string | null>(storedId);

  const fromPath = seasonFromPath(pathname);
  const season = fromPath ?? (preferred ? (seasonById.get(preferred) ?? activeSeason) : activeSeason);

  // Remember where the reader has been, so that / lands somewhere sensible next
  // time. This only ever affects the entry point, never a shared link.
  React.useEffect(() => {
    if (!fromPath) return;
    setPreferred(fromPath.id);
    try {
      localStorage.setItem(STORAGE_KEY, fromPath.id);
    } catch {
      // The choice simply does not outlive the tab.
    }
  }, [fromPath]);

  const setSeasonId = React.useCallback(
    (id: string) => {
      if (!seasonById.has(id)) return;
      setPreferred(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // As above.
      }
      // Stay on the same kind of page where that makes sense. A match page
      // belongs to one season and cannot follow the switch, so it goes to that
      // season's schedule instead of nowhere.
      // A match belongs to one season and cannot follow the switch, so anything
      // deeper than a season-level page goes to that season's schedule instead.
      const scoped = /^\/season\/[^/]+\/?([^/]*)$/.exec(pathname);
      navigate(seasonPath(id, scoped ? scoped[1] || undefined : "schedule"));
    },
    [navigate, pathname],
  );

  const value = React.useMemo(() => ({ season, seasons, setSeasonId }), [season, setSeasonId]);
  return <SeasonContext value={value}>{children}</SeasonContext>;
}

export function useSeason(): SeasonState {
  const value = React.useContext(SeasonContext);
  if (!value) throw new Error("useSeason must be used inside a SeasonProvider");
  return value;
}

/** A link builder bound to the season currently on screen. */
export function useSeasonPath(): (page?: string) => string {
  const { season } = useSeason();
  return React.useCallback((page?: string) => seasonPath(season.id, page), [season.id]);
}
