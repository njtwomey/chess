import { Clock, MapPin, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { seasonPath } from "@/components/season-context";
import { Badge } from "@/components/ui/badge";
import { venueById } from "@/lib/data";
import { mapsUrl } from "@/lib/links";
import type { Match, Season } from "@/lib/schema";
import { matchScore } from "@/lib/season";
import { formatLongDate, formatShortDate, formatWeekday, relativeDay, today } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Where and when, as one line.
 *
 * The captain asked for this front and centre on every match, and he is right:
 * a player who already knows they are picked opens the page to find out where
 * they are going, and everything else on it is somebody else's problem.
 */
export function VenueLine({ match, className }: { match: Match; className?: string }) {
  const venue = venueById.get(match.venueId);
  if (!venue) return null;

  const place = [venue.address, venue.postcode].filter(Boolean).join(", ");
  return (
    <a
      href={mapsUrl(venue)}
      target="_blank"
      rel="noreferrer"
      className={cn("group inline-flex items-start gap-2 text-sm", className)}
    >
      <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="group-hover:text-primary font-medium underline-offset-4 group-hover:underline">
          {venue.name}
        </span>
        {place ? (
          <span className="text-muted-foreground"> · {place}</span>
        ) : (
          <span className="text-muted-foreground"> · address to be confirmed</span>
        )}
      </span>
    </a>
  );
}

export function TimeLine({ match, className }: { match: Match; className?: string }) {
  return (
    <span className={cn("text-muted-foreground inline-flex items-center gap-2 text-sm", className)}>
      <Clock className="size-4 shrink-0" />
      <span>
        {formatLongDate(match.date)}, {match.time}
      </span>
    </span>
  );
}

export function HomeAway({ home }: { home: boolean }) {
  return (
    <Badge variant={home ? "secondary" : "outline"} className="shrink-0">
      {home ? "Home" : "Away"}
    </Badge>
  );
}

export function MatchCard({ season, match, className }: { season: Season; match: Match; className?: string }) {
  const score = matchScore(match);
  const now = today();
  const past = match.date < now;

  return (
    <Link
      to={seasonPath(season.id, `match/${match.id}`)}
      className={cn(
        "hover:border-primary/40 hover:bg-accent/40 block rounded-lg border p-4 transition-colors",
        match.status === "cancelled" && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground tabular text-xs">Round {match.round}</span>
            <HomeAway home={match.home} />
            {match.status === "cancelled" && <Badge variant="outline">Cancelled</Badge>}
          </div>
          <p className="mt-1.5 font-medium">
            <span className="text-muted-foreground">{match.home ? "" : "away to "}</span>
            {match.opponent}
          </p>
        </div>

        <div className="text-right">
          <p className="tabular text-sm font-medium">
            {formatWeekday(match.date)} {formatShortDate(match.date)}
          </p>
          <p className="text-muted-foreground tabular text-xs">
            {match.time} · {relativeDay(now, match.date)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <VenueLine match={match} />
        {score ? (
          <span
            className={cn(
              "tabular inline-flex items-center gap-1.5 text-sm font-semibold",
              match.result && match.result.ourScore > match.result.theirScore && "text-reply-yes",
              match.result && match.result.ourScore < match.result.theirScore && "text-reply-no",
            )}
          >
            <Trophy className="size-3.5" />
            {score}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            {match.availability.length > 0
              ? `${match.availability.length} of ${season.players.length} replied`
              : past
                ? "No result recorded"
                : "Availability not asked yet"}
          </span>
        )}
      </div>
    </Link>
  );
}
