import { MapPin } from "lucide-react";
import { mapsUrl } from "@/lib/links";
import type { Venue } from "@/lib/schema";
import { osmUrl, tilesAround } from "@/lib/tiles";
import { cn } from "@/lib/utils";

/** Street level: enough to see which corner the building is on. */
const ZOOM = 16;

/**
 * A square of OpenStreetMap with the venue marked.
 *
 * Tiles are drawn directly rather than through OSM's embed or a map library.
 * That keeps it to a few lazily-loaded images with nothing to initialise, and
 * it is a fixed view on purpose: this answers "where is that" and then gets out
 * of the way. Clicking it opens the venue in Maps, which is what somebody
 * pointing at it wants.
 *
 * The attribution is not decoration. OpenStreetMap's licence requires it, and
 * it has to link back.
 */
export function VenueMap({ venue, className }: { venue: Venue; className?: string }) {
  const { lat, lon } = venue;

  if (lat === null || lon === null) {
    return (
      <a
        href={mapsUrl(venue)}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-xs transition-colors",
          className,
        )}
      >
        <MapPin className="size-5" />
        <span>No map pinned yet. Search for it instead.</span>
      </a>
    );
  }

  const tiles = tilesAround(lat, lon, ZOOM);

  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-lg border bg-neutral-200", className)}>
      <a
        href={mapsUrl(venue)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Map of ${venue.name}`}
        className="absolute inset-0 block"
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            loading="lazy"
            width={256}
            height={256}
            // Positioned from the centre of the box, which is where the venue is.
            className="pointer-events-none absolute max-w-none"
            style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }}
          />
        ))}

        {/* The pin sits on the point, so its tip rather than its middle. */}
        <MapPin
          className="text-primary absolute size-7 -translate-x-1/2 -translate-y-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          style={{ left: "50%", top: "50%" }}
          fill="currentColor"
        />
      </a>

      <a
        href={osmUrl(lat, lon, ZOOM)}
        target="_blank"
        rel="noreferrer"
        className="absolute right-0 bottom-0 bg-white/80 px-1.5 py-0.5 text-[0.6rem] text-neutral-700 hover:underline"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
