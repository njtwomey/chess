import * as React from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

/** What "system" currently resolves to. */
function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function stored(): Theme {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/**
 * Light/dark, with "system" as the default rather than a hard-coded light.
 *
 * The class is applied by a blocking script in index.html as well as here. That
 * duplication is deliberate: React runs after first paint, so without the inline
 * script a dark-mode reader gets a white flash on every navigation into the site.
 * This hook keeps the two in step afterwards.
 */
/**
 * The chosen theme, shared by every caller.
 *
 * Held outside React because the preference is one fact about the page and not
 * a fact about a component. With a `useState` per call the header toggle would
 * update only itself, and a second consumer such as a chart reading the resolved
 * value would never hear the change. That costs nothing today and would be a
 * silent bug the moment anything but the toggle asks.
 */
const listeners = new Set<() => void>();
let choice: Theme = typeof window === "undefined" ? "system" : stored();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    query.removeEventListener("change", onChange);
  };
}

export function useTheme() {
  const theme = React.useSyncExternalStore(
    subscribe,
    () => choice,
    () => "system" as const,
  );

  const resolved = React.useSyncExternalStore(
    subscribe,
    () => (choice === "system" ? systemTheme() : choice),
    () => "light" as const,
  );

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = React.useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    choice = next;
    for (const listener of listeners) listener();
  }, []);

  /**
   * Flip to the opposite of whatever is on screen now.
   *
   * Until this is called the site follows the system, which is the right
   * default because the reader has already expressed a preference there. The
   * first press turns that into an explicit choice, and there is no way back to
   * "system" from the button. That is the trade a two-state control makes, and
   * it is worth it: a three-way cycle means pressing a button and not knowing
   * what you will get.
   */
  const toggle = React.useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return { theme, resolved, setTheme, toggle };
}
