import { ArrowUp, TriangleAlert } from "lucide-react";
import { MessageButtons } from "@/components/message-buttons";
import { ReplyBadge, RoleBadge } from "@/components/reply-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { playerName } from "@/lib/data";
import type { Season } from "@/lib/schema";
import { replyOf } from "@/lib/season";
import { decidingKey, KEY_LABEL, type Ranked, type Reply, type Selection } from "@/lib/selection";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/schema";

/**
 * Why this player is above the next one, but only where it decided something.
 *
 * Two players in the same band, both playing, were not in competition: their
 * order between themselves changes nothing, and board order is settled later by
 * rating anyway. Explaining it there reads as a contest that never happened.
 * The comparison that matters is the one across a line, where somebody on one
 * side got a game and somebody on the other did not.
 */
function reason(player: Ranked, next: Ranked | undefined): string {
  if (!next || player.role === next.role) return "";
  return KEY_LABEL[decidingKey(player, next)];
}

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
    return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
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
              <TableRow key={player.id}>
                <TableCell className="font-medium">{player.name}</TableCell>
                <TableCell>
                  <ReplyBadge reply={replyOf(match, player.id)} />
                </TableCell>
                <TableCell className="tabular text-right">{played.get(player.id) ?? 0}</TableCell>
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
  settled,
}: {
  season: Season;
  match: Match;
  selection: Selection;
  settled: boolean;
}) {
  const name = (id: string) => playerName(season, id);

  /**
   * Was anybody actually turned away?
   *
   * Only if somebody who said they can play did not get a board. If everyone
   * who asked for a game got one, there was no decision to explain and the
   * whole column is noise dressed up as reasoning.
   */
  const contested = selection.order.some((player) => player.role !== "board" && player.reply === "yes");

  if (!settled) return <AvailabilityTable season={season} match={match} selection={selection} />;

  return (
    <div className="space-y-4">
      {selection.unfilled > 0 && (
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
              <TableHead className="w-28">Outcome</TableHead>
              {contested && (
                <TableHead className="hidden md:table-cell">Above the player below because they…</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {selection.standing.map((player) => {
              const dropped = player.role === "withdrawn";
              const promoted = selection.promoted.includes(player);
              // The list is the standing order, so a dropout still occupies the
              // place it had. The cut line follows the players who are actually
              // left, which is what makes the pull-up visible as a pull-up.
              const next = player.position === null ? undefined : selection.order[player.position];
              return (
                <TableRow
                  key={player.playerId}
                  className={cn(
                    player.role === "board" && "bg-accent/40",
                    dropped && "text-muted-foreground",
                    player.position === selection.boards && "border-b-primary/40 border-b-2",
                  )}
                >
                  <TableCell className="tabular text-muted-foreground text-right text-xs">
                    {player.position ?? "—"}
                  </TableCell>
                  <TableCell className={cn("font-medium", dropped && "line-through")}>
                    {name(player.playerId)}
                  </TableCell>
                  <TableCell>
                    <ReplyBadge reply={player.reply} />
                  </TableCell>
                  <TableCell className="tabular text-right">{player.gamesPlayed}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <RoleBadge role={player.role} />
                    {promoted && (
                      <span className="text-reply-yes ml-1.5 inline-flex items-center gap-0.5 text-[0.7rem] font-medium">
                        <ArrowUp className="size-3" />
                        moved up
                      </span>
                    )}
                  </TableCell>
                  {contested && (
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {dropped ? "Dropped out after replying" : reason(player, next)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {selection.unavailable.map((player) => (
              <TableRow key={player.playerId} className="text-muted-foreground">
                <TableCell />
                <TableCell>{name(player.playerId)}</TableCell>
                <TableCell>
                  <ReplyBadge reply={replyOf(match, player.playerId)} />
                </TableCell>
                <TableCell className="tabular text-right">{player.gamesPlayed}</TableCell>
                <TableCell colSpan={contested ? 2 : 1} className="text-xs">
                  Not selectable
                </TableCell>
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
