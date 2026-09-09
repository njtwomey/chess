import { Check, CircleHelp, Hand, Minus, X } from "lucide-react";
import { REPLY_LABEL, ROLE_LABEL, type Reply, type Role } from "@/lib/selection";
import { cn } from "@/lib/utils";

/**
 * The four answers, in the four colours they have everywhere on the site.
 *
 * An icon as well as a colour, because "can play" and "cannot play" are the two
 * that matter most and green against red is the pair a colour-blind reader is
 * least likely to separate.
 */
const REPLY_STYLE: Record<Reply, { className: string; Icon: typeof Check }> = {
  yes: { className: "bg-reply-yes-soft text-reply-yes", Icon: Check },
  reserve: { className: "bg-reply-reserve-soft text-reply-reserve", Icon: Hand },
  unsure: { className: "bg-reply-unsure-soft text-reply-unsure", Icon: CircleHelp },
  no: { className: "bg-reply-no-soft text-reply-no", Icon: X },
};

export function ReplyBadge({ reply, className }: { reply: Reply | null; className?: string }) {
  if (reply === null) {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-1.5 rounded-full border border-dashed px-2 py-0.5 text-xs",
          className,
        )}
      >
        <Minus className="size-3" />
        No reply
      </span>
    );
  }

  const { className: tone, Icon } = REPLY_STYLE[reply];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", tone, className)}
    >
      <Icon className="size-3" />
      {REPLY_LABEL[reply]}
    </span>
  );
}

/**
 * The same four colours the replies use, because they mean the same things.
 *
 * Somebody who said "can play" and is playing reads as one green row rather
 * than as a green answer and an amber verdict, and a reserve is blue on both
 * sides of the table. The amber is the site's own accent and saying nothing
 * with it here leaves it to mean "this is the thing you clicked".
 */
const ROLE_STYLE: Record<Role, string> = {
  board: "bg-reply-yes-soft text-reply-yes",
  reserve: "bg-reply-reserve-soft text-reply-reserve",
  standby: "bg-muted text-muted-foreground",
  withdrawn: "bg-reply-no-soft text-reply-no",
  unavailable: "bg-transparent text-muted-foreground border border-dashed",
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        ROLE_STYLE[role],
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
