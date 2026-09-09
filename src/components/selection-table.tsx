import { ArrowUp, TriangleAlert } from "lucide-react";
import { MessageButtons } from "@/components/message-buttons";
import { PlayerLink } from "@/components/player-link";
import { ReplyBadge, RoleBadge } from "@/components/reply-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { playerById, playerName } from "@/lib/data";
import type { Season } from "@/lib/schema";
import { replyOf, roleFor, type Fielded } from "@/lib/season";
import { type Reply, type Selection } from "@/lib/selection";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/schema";

/**
 * Least available last: can play, then can reserve, then not sure, then the
 * people who have not answered, then the people who cannot come.
 *
 * A silent player sits between "not sure" and "cannot play" because that is
 * roughly what silence is worth: still worth a message, but less promising than
 * somebody who has actually engaged with the question.
 */
const REPLY_ORDER: (Reply | null)[] = ["yes", "reserve", "unsure", null, "no"];

/**
 * A squad member by id, linked like everywhere else.
 *
 * This table works in ids because that is what the rule hands back, so the
 * lookup happens here rather than the table quietly being the one place a
 * player is not a link.
 */
function PlayerOf({ season, id }: { season: Season; id: string }) {
  const player = playerById(season, id);
  return player ? <PlayerLink player={player} className="font-medium" /> : <span className="font-medium">{id}</span>;
}

/**
 * The replies so far, with nothing decided.
 *
 * Before a team is settled this shows who has answered and no more: no
 * position, no outcome, no reasoning. Those are all the rule's proposal, and
 * publishing them mid-week presents a lineup as though it were fixed when the
 * replies are still arriving. The rule has still run, and the captain can see
 * it by settling the match.
 */
function AvailabilityTable({ season, match, selection }: { season: Season; match: Match; selection: Selection }) {
  const played = new Map(
    [...selection.standing, ...selection.unavailable].map((player) => [player.playerId, player.gamesPlayed]),
  );

  const rows = [...season.players].sort((a, b) => {
    const rank = (id: string) => REPLY_ORDER.indexOf(replyOf(match, id));
    return rank(a.playerId) - rank(b.playerId) || a.name.localeCompare(b.name);
  });

  const replied = match.availability.length;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Replied</TableHead>
              <TableHead className="w-24 text-right">Games</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((player) => (
              <TableRow key={player.playerId}>
                <TableCell>
                  <PlayerLink player={player} className="font-medium" />
                </TableCell>
                <TableCell>
                  <ReplyBadge reply={replyOf(match, player.playerId)} />
                </TableCell>
                <TableCell className="tabular text-right">{played.get(player.playerId) ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-md text-xs/5">
          These are the replies so far, {replied} of {season.players.length}, and nothing more. Nobody has been picked
          yet: the team is settled nearer the match, and this page will show it then.
        </p>
        <MessageButtons season={season} match={match} selection={selection} settled={false} />
      </div>
    </div>
  );
}

export function SelectionTable({
  season,
  match,
  selection,
  fielded,
  settled,
}: {
  season: Season;
  match: Match;
  selection: Selection;
  fielded: Fielded;
  settled: boolean;
}) {
  const name = (id: string) => playerName(season, id);

  // Whether the rule had to separate anybody, which is what the note about the
  // coin flip is for. Asked of the rule rather than of the team on the sheet:
  // the flip either decided something or it did not.
  const contested = selection.order.some((player) => player.role !== "board" && player.reply === "yes");

  if (!settled) return <AvailabilityTable season={season} match={match} selection={selection} />;

  // The rule's own order, always, because that is what this table is: what the
  // rule produced from the replies. Leading with the captain's team instead
  // reordered the one thing the section exists to show, and then had to draw a
  // line after the fourth row to say where the boards stopped, which was a
  // claim the badges beside it contradicted whenever he had changed anything.
  //
  // Who is actually playing is a column now. The team that took the field is
  // above this in board order, and says so.
  const rows = [...selection.standing];

  // Numbered down the page rather than read off the rule, so the column and the
  // rows cannot disagree. A dropout gets none: they are shown where they stood,
  // not counted among those still in line.
  let counted = 0;

  return (
    <div className="space-y-4">
      {/* Only while there is still something to do about it. A fixture that has
          been played cannot have boards that "cannot be filled": whoever turned
          up is in the result above, and where no replies were ever recorded the
          rule has nothing to work from and would otherwise announce that the
          whole team was missing. */}
      {selection.unfilled > 0 && match.result === null && (
        <div className="border-reply-unsure/40 bg-reply-unsure-soft/50 text-reply-unsure flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">
              {selection.unfilled} of {selection.boards} boards cannot be filled
            </strong>{" "}
            from the replies so far. Nobody who answered "not sure" is picked, however few games they have played, so
            these are the people to chase.
          </p>
        </div>
      )}

      {selection.withdrawn.length > 0 && (
        <div className="bg-muted/40 rounded-lg border px-4 py-3 text-sm">
          <p>
            <strong className="font-semibold">
              {selection.withdrawn.map((player) => name(player.playerId)).join(", ")}
            </strong>{" "}
            dropped out after replying. Nobody was re-ranked: everyone below simply moved up one place, so the top
            reserve took the empty board.
            {selection.promoted.length > 0 && (
              <>
                {" "}
                <strong className="font-semibold">
                  {selection.promoted.map((player) => name(player.playerId)).join(" and ")}
                </strong>{" "}
                moved up as a result.
              </>
            )}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Replied</TableHead>
              <TableHead className="w-20 text-right">Games</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((player) => {
              const role = roleFor(fielded, player);
              const dropped = role === "withdrawn";
              const promoted = selection.promoted.includes(player);
              const number = dropped ? null : (counted += 1);
              return (
                <TableRow key={player.playerId} className={cn(dropped && "text-muted-foreground")}>
                  <TableCell className="tabular text-muted-foreground text-right text-xs">{number ?? "—"}</TableCell>
                  <TableCell className={cn(dropped && "line-through")}>
                    <PlayerOf season={season} id={player.playerId} />
                  </TableCell>
                  <TableCell>
                    <ReplyBadge reply={player.reply} quiet />
                  </TableCell>
                  <TableCell className="tabular text-right">{player.gamesPlayed}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <RoleBadge role={role} />
                    {promoted && (role === "board" || role === "reserve") && (
                      <span className="text-reply-yes ml-1.5 inline-flex items-center gap-0.5 text-[0.7rem] font-medium">
                        <ArrowUp className="size-3" />
                        moved up
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {selection.unavailable.map((player) => (
              <TableRow key={player.playerId} className="text-muted-foreground">
                <TableCell />
                <TableCell>
                  <PlayerOf season={season} id={player.playerId} />
                </TableCell>
                <TableCell>
                  <ReplyBadge reply={replyOf(match, player.playerId)} quiet />
                </TableCell>
                <TableCell className="tabular text-right">{player.gamesPlayed}</TableCell>
                <TableCell className="text-xs">Not selectable</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {contested
            ? "Where two people cannot be separated, a digital coin flip settles it. It gives the same answer every time this page is opened, and lands differently in every match."
            : "Everybody who said they can play is playing, so nobody was turned away and there was nothing to decide."}
        </p>
        <MessageButtons season={season} match={match} selection={selection} settled />
      </div>
    </div>
  );
}
