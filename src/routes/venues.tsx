import { Empty, Page } from "@/components/page";
import { useSeason } from "@/components/season-context";
import { VenueMap } from "@/components/venue-map";
import { venues } from "@/lib/data";
import { mapsUrl } from "@/lib/links";
import { orderedMatches } from "@/lib/season";

/**
 * The clubs we visit this season, one card each.
 *
 * Season-scoped rather than a list of every venue we have ever played at. What
 * a player wants is the handful of places they are actually going, with a
 * fixture count that means something.
 */
export function Venues() {
  const { season } = useSeason();
  const matches = orderedMatches(season);
  const used = new Set(matches.map((match) => match.venueId));
  const seasonVenues = venues.filter((venue) => used.has(venue.id));

  return (
    <Page
      title="Venues"
      lede="Every map opens the place, not an address we have guessed at. Where a club's address is not confirmed, the link searches for it by name."
    >
      {seasonVenues.length === 0 ? (
        <Empty>No fixtures this season, so nowhere to go.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {seasonVenues.map((venue) => {
            const fixtures = matches.filter((match) => match.venueId === venue.id);
            return (
              <div key={venue.id} className="flex flex-col overflow-hidden rounded-lg border">
                <VenueMap venue={venue} className="w-full rounded-none border-0 border-b" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={mapsUrl(venue)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary font-medium"
                    >
                      {venue.name}
                    </a>
                    <span className="text-muted-foreground tabular shrink-0 text-xs">
                      {fixtures.length} {fixtures.length === 1 ? "fixture" : "fixtures"}
                    </span>
                  </div>
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
            );
          })}
        </div>
      )}
    </Page>
  );
}
