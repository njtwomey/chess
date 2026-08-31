import { ArrowUp, Check, ClipboardCopy, TriangleAlert } from "lucide-react";
import { ReplyBadge, RoleBadge } from "@/components/reply-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCopy } from "@/hooks/use-copy";
import { playerName } from "@/lib/data";
import type { Season } from "@/lib/schema";
import { replyOf } from "@/lib/season";
import { decidingKey, explain, KEY_LABEL, type Ranked, type Selection } from "@/lib/selection";
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

export function SelectionTable({ season, match, selection }: { season: Season; match: Match; selection: Selection }) {
  const { copied, copy } = useCopy();
  const name = (id: string) => playerName(season, id);
  const message = explain(selection, name).join("\n\n");

  /**
   * Was anybody actually turned away?
   *
   * Only if somebody who said they can play did not get a board. If everyone
   * who asked for a game got one, there was no decision to explain and the
   * whole column is noise dressed up as reasoning.
   */
  const contested = selection.order.some((player) => player.role !== "board" && player.reply === "yes");

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
            ? "Ties are broken by a hash of the season seed, this match and the player id, so the order is the same every time this page is opened and different in every match."
            : "Everybody who said they can play is playing, so nobody was turned away and there was nothing to decide."}
        </p>
        <Button variant="outline" size="sm" onClick={() => copy(message)}>
          {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
          {copied ? "Copied" : "Copy for the group chat"}
        </Button>
      </div>
    </div>
  );
}
