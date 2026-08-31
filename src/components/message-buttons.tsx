import { Check, ClipboardCopy, MessageSquare, Users } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";
import { playerName } from "@/lib/data";
import { availabilitySummary, callToAction } from "@/lib/messages";
import type { Match, Season } from "@/lib/schema";
import { explain, type Selection } from "@/lib/selection";
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

  const messages = [
    { label: "Ask who can play", Icon: MessageSquare, text: () => callToAction(season, match) },
    { label: "Copy the status", Icon: Users, text: () => availabilitySummary(season, match) },
    ...(settled
      ? [
          {
            label: "Copy the team",
            Icon: ClipboardCopy,
            text: () => explain(selection, (id: string) => playerName(season, id)).join("\n\n"),
          },
        ]
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
