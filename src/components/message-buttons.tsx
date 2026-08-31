import { Check, ClipboardCopy, MessageSquare, Trophy, Users } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";
import { availabilityUpdate, callToAction, matchResult, selectedTeam } from "@/lib/messages";
import type { Match, Season } from "@/lib/schema";
import type { Selection } from "@/lib/selection";
import { cn } from "@/lib/utils";

/**
 * The messages for the group chat, ready to paste.
 *
 * All of them come from the same data the page is rendering, so a message
 * cannot drift from what the site says. The status one is available whether or
 * not the team is settled, because "where are we up to" is asked most often
 * while it is still open.
 */
export function MessageButtons({
  season,
  match,
  selection,
  settled,
  className,
}: {
  season: Season;
  match: Match;
  selection: Selection;
  settled: boolean;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  const [which, setWhich] = React.useState<string | null>(null);

  const send = (label: string, text: string) => {
    setWhich(label);
    void copy(text);
  };

  /**
   * Which messages make sense right now.
   *
   * A played match is done being organised, so asking who can play and
   * reporting where the replies got to are both noise; what is wanted then is
   * the result. Before that the result does not exist.
   */
  const played = match.result !== null;
  const messages = [
    ...(played
      ? [{ label: "Copy the result", Icon: Trophy, text: () => matchResult(season, match) ?? "" }]
      : [
          { label: "Ask who can play", Icon: MessageSquare, text: () => callToAction(season, match) },
          { label: "Copy the status", Icon: Users, text: () => availabilityUpdate(season, match) },
        ]),
    ...(settled
      ? [{ label: "Copy the team", Icon: ClipboardCopy, text: () => selectedTeam(season, match, selection) }]
      : []),
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {messages.map(({ label, Icon, text }) => (
        <Button key={label} variant="outline" size="sm" onClick={() => send(label, text())}>
          {copied && which === label ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
          {copied && which === label ? "Copied" : label}
        </Button>
      ))}
    </div>
  );
}
