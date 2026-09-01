import { cn } from "@/lib/utils";

/**
 * Home or away, in the calendar's two colours.
 *
 * Amber for home and teal for away already mean that on the calendar, so
 * repeating them here costs a reader nothing to learn. Filled rather than
 * outlined for the same reason it is filled there: an outline reads as a
 * qualifier on something else, and this is the first thing worth knowing about
 * a fixture.
 *
 * The long wording is for the page title, where the badge is doing the work of
 * a sentence. Beside a venue the place has already been named, so "Home" is
 * enough and "Home game" would be repeating the heading it sits under.
 */
export function HomeAway({ home, size = "sm" }: { home: boolean; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "rounded-md align-middle font-semibold whitespace-nowrap",
        home ? "bg-primary text-primary-foreground" : "bg-fixture-away text-fixture-away-foreground",
        size === "lg" ? "mr-2.5 px-2.5 py-1 text-base sm:text-lg" : "ml-2 px-2 py-0.5 text-xs",
      )}
    >
      {size === "lg" ? (home ? "Home game" : "Away game") : home ? "Home" : "Away"}
    </span>
  );
}
