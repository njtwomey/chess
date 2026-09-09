import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activeSeason, seasonById, seasons } from "@/lib/data";
import type { Season } from "@/lib/schema";

const STORAGE_KEY = "season";

interface SeasonState {
  /** The season on screen, or the best guess at one for the global pages. */
  season: Season;
  seasons: Season[];
  /**
   * Whether the URL actually names a season.
   *
   * The site has a global half (the club, the venues, how selection works) and
   * a season half. `season` is always populated so a picker has something to
   * show, but the header must not offer Schedule and Team while nobody has
   * chosen a season.
   */
  inSeason: boolean;
  /** Switch season and go to the same page under it. */
  setSeasonId: (id: string) => void;
}

const SeasonContext = React.createContext<SeasonState | null>(null);

/** Season-scoped pages live under /season/<season id>, which is what makes them shareable. */
export function seasonPath(seasonId: string, page?: string): string {
  return page ? `/season/${seasonId}/${page}` : `/season/${seasonId}`;
}

/**
 * Longest first, so the split below cannot stop at a season whose id is a
 * prefix of another one's.
 */
const byLength = [...seasons].sort((a, b) => b.id.length - a.id.length);

/**
 * Which season a URL is about, and what comes after it.
 *
 * A season id is a path of its own (`bristol-district/bristol-clifton/team-g/
 * autumn-2026`), so where the id ends and the page begins cannot be read off
 * the slashes. The site knows every season at build time, which turns that into
 * a lookup rather than a guess and means nothing has to agree in advance about
 * how deep an id goes.
 *
 * The URL is the authority, not a stored preference, so a link pasted into the
 * group chat opens the season the sender was looking at rather than whichever
 * one the reader happened to choose last.
 */
export function splitSeasonPath(pathname: string): { season: Season; page: string } | null {
  const rest = pathname.replace(/^\/season\//, "").replace(/\/+$/, "");
  if (rest === pathname) return null;
  for (const season of byLength) {
    if (rest === season.id) return { season, page: "" };
    if (rest.startsWith(`${season.id}/`)) return { season, page: rest.slice(season.id.length + 1) };
  }
  return null;
}

function seasonFromPath(pathname: string): Season | null {
  return splitSeasonPath(pathname)?.season ?? null;
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
      // Stay on the same kind of page where there is one. A fixture belongs to
      // one season and cannot follow the switch, so anything deeper than a
      // season-level page lands on the new season's own home rather than
      // somewhere arbitrary.
      const page = splitSeasonPath(pathname)?.page;
      navigate(seasonPath(id, page && !page.includes("/") && !page.startsWith("fixture-") ? page : undefined));
    },
    [navigate, pathname],
  );

  const value = React.useMemo(
    () => ({ season, seasons, inSeason: fromPath !== null, setSeasonId }),
    [season, fromPath, setSeasonId],
  );
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
