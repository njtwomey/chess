import * as React from "react";
import { Empty, Page } from "@/components/page";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VenueMap } from "@/components/venue-map";
import { venues } from "@/lib/data";
import { mapsUrl } from "@/lib/links";
import { cn } from "@/lib/utils";

/**
 * How many venues to a row.
 *
 * Tailwind reads class names statically, so these are written out rather than
 * built from a number: a template string would produce a class that survives
 * the build only by accident.
 *
 * Every size collapses to one column on a phone. The choice is really about how
 * much map you get, and the map is the reason to be on this page: at five
 * across it is a thumbnail for recognising somewhere you already know, at two
 * it is big enough to plan an approach from.
 */
const SIZES = {
  small: { label: "Small", columns: "sm:grid-cols-3 lg:grid-cols-5" },
  medium: { label: "Medium", columns: "sm:grid-cols-2 lg:grid-cols-3" },
  large: { label: "Large", columns: "sm:grid-cols-2" },
} as const;

type Size = keyof typeof SIZES;

const STORAGE_KEY = "venue-size";

function storedSize(): Size {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "small" || value === "medium" || value === "large") return value;
  } catch {
    // Private browsing blocks localStorage, and medium is the right default.
  }
  return "medium";
}

/**
 * Every club, once.
 *
 * Global rather than season-scoped: a venue is a building, not a fixture, and
 * the same handful come round every year. No fixture counts either, because
 * that is a fact about a season and this page is not about one.
 */
export function Venues() {
  const [size, setSize] = React.useState<Size>(storedSize);

  const choose = (value: string) => {
    // The group hands back "" when you click the item that is already on.
    // Ignore it: a size grid has no meaningful off state.
    if (!(value in SIZES)) return;
    setSize(value as Size);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The choice simply does not outlive the tab.
    }
  };

  return (
    <Page
      title="Venues"
      lede="Every club we play at. Each map opens the place, not an address we have guessed at; where a club's address is not confirmed, the link searches for it by name."
      actions={
        <ToggleGroup type="single" size="sm" variant="outline" value={size} onValueChange={choose}>
          {(Object.keys(SIZES) as Size[]).map((key) => (
            <ToggleGroupItem key={key} value={key} aria-label={`${SIZES[key].label} maps`}>
              {SIZES[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      {venues.length === 0 ? (
        <Empty>No venues recorded.</Empty>
      ) : (
        <div className={cn("grid gap-4", SIZES[size].columns)}>
          {venues.map((venue) => (
            <div key={venue.id} className="flex flex-col overflow-hidden rounded-lg border">
              <VenueMap venue={venue} className="w-full rounded-none border-0 border-b" />
              <div className="flex flex-1 flex-col p-4">
                <a href={mapsUrl(venue)} target="_blank" rel="noreferrer" className="hover:text-primary font-medium">
                  {venue.name}
                </a>
                <p className="text-muted-foreground mt-1 text-sm">
                  {[venue.address, venue.postcode].filter(Boolean).join(", ") || "Address not confirmed yet"}
                </p>
                {venue.note && <p className="text-muted-foreground mt-1.5 text-xs/5">{venue.note}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <a href={mapsUrl(venue)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Open in Maps
                  </a>
                  {venue.website && (
                    <a href={venue.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Club website
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
