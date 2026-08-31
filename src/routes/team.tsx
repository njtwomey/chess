import * as React from "react";
import { Empty, Page, Section } from "@/components/page";
import { RatingLabel, RatingTrend } from "@/components/rating";
import { useSeason } from "@/components/season-context";
import { compareValues, SortableHead, useSort } from "@/components/sortable-table";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { ecfUrl } from "@/lib/links";
import { coverage, statsFor, type PlayerStats } from "@/lib/season";
import { cn } from "@/lib/utils";

type Column = "name" | "rating" | "played" | "points" | "record";

/** What each column sorts on, and which way it runs on the first click. */
const COLUMNS: Record<Column, { natural: "asc" | "desc"; value: (entry: PlayerStats) => string | number | null }> = {
  name: { natural: "asc", value: (entry) => entry.player.name },
  rating: { natural: "desc", value: (entry) => entry.rating?.rating ?? null },
  played: { natural: "asc", value: (entry) => entry.played },
  points: { natural: "desc", value: (entry) => entry.points },
  record: { natural: "desc", value: (entry) => entry.wins },
};

export function Team() {
  const { season } = useSeason();
  const stats = statsFor(season);
  const spread = coverage(season);

  // Fewest games first by default, which is the order the selection rule works
  // down and therefore the question people open this page with.
  const { sort, toggle } = useSort<Column>({ key: "played", direction: "asc" });

  const ordered = React.useMemo(() => {
    const { value } = COLUMNS[sort.key];
    return [...stats].sort(
      (a, b) =>
        // Name breaks every tie, so the order is stable and a re-sort never
        // shuffles rows that compare equal.
        compareValues(value(a), value(b), sort.direction) || a.player.name.localeCompare(b.player.name),
    );
  }, [stats, sort]);

  if (stats.length === 0) {
    return (
      <Page title="Team" lede={`The squad for ${season.name}.`}>
        <Empty>
          <p className="font-medium">No squad has been entered yet.</p>
          <p className="mt-2">
            Add players to <code className="font-mono text-xs">content/seasons/{season.id}/players.json</code>. A player
            needs an id, a name and a junior flag; ratings can be added later and an empty list means unrated.
          </p>
        </Empty>
      </Page>
    );
  }

  return (
    <Page title="Team">
      <Section
        title="Games played"
        description="Any column sorts. A rating links to its ECF record. Ratings decide board order only, never who is picked."
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead column="name" sort={sort} toggle={toggle} natural={COLUMNS.name.natural}>
                  Player
                </SortableHead>
                <SortableHead
                  column="rating"
                  sort={sort}
                  toggle={toggle}
                  natural={COLUMNS.rating.natural}
                  align="right"
                  className="w-28"
                >
                  Rating
                </SortableHead>
                <SortableHead
                  column="played"
                  sort={sort}
                  toggle={toggle}
                  natural={COLUMNS.played.natural}
                  align="right"
                  className="w-24"
                >
                  Played
                </SortableHead>
                <SortableHead
                  column="points"
                  sort={sort}
                  toggle={toggle}
                  natural={COLUMNS.points.natural}
                  align="right"
                  className="w-24"
                >
                  Points
                </SortableHead>
                <SortableHead
                  column="record"
                  sort={sort}
                  toggle={toggle}
                  natural={COLUMNS.record.natural}
                  align="right"
                  className="w-32"
                >
                  W / D / L
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((entry) => (
                <TableRow key={entry.player.id} className={cn(entry.played === 0 && "bg-reply-unsure-soft/25")}>
                  <TableCell>
                    <span className="font-medium">{entry.player.name}</span>
                    {entry.player.role !== "member" && (
                      <Badge variant="secondary" className="ml-2 text-[0.65rem]">
                        Captain
                      </Badge>
                    )}
                    {entry.player.junior && (
                      <Badge variant="outline" className="ml-2 text-[0.65rem]">
                        Junior
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {entry.player.ecfCode ? (
                      <a
                        href={ecfUrl(entry.player.ecfCode)}
                        target="_blank"
                        rel="noreferrer"
                        title={`ECF record ${entry.player.ecfCode}`}
                        className="hover:text-primary underline-offset-4 hover:underline"
                      >
                        <RatingLabel rating={entry.rating} />
                      </a>
                    ) : (
                      <RatingLabel rating={entry.rating} />
                    )}
                    <RatingTrend ratings={entry.player.ratings} />
                  </TableCell>
                  <TableCell className="tabular text-right">{entry.played}</TableCell>
                  <TableCell className="tabular text-right">{entry.points}</TableCell>
                  <TableCell className="tabular text-muted-foreground text-right text-sm">
                    {entry.wins} / {entry.draws} / {entry.losses}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="text-muted-foreground mt-3 space-y-1 text-xs">
          {spread.unplayed > 0 && (
            <p>
              {spread.unplayed} {spread.unplayed === 1 ? "player has" : "players have"} not had a game yet. They are top
              of the order for the next fixture they are available for.
            </p>
          )}
          {stats.some((entry) => entry.player.ratings.length === 0) && (
            <p>
              Unrated:{" "}
              {stats
                .filter((entry) => entry.player.ratings.length === 0)
                .map((entry) => entry.player.name)
                .join(", ")}
              . Unrated players sort to the bottom of the rating column whichever way it runs, because absent is not the
              same as low.
            </p>
          )}
        </div>
      </Section>
    </Page>
  );
}
