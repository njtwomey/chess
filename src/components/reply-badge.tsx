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

/**
 * What somebody said, and once a team is settled, quietly.
 *
 * `quiet` drops the colour and keeps the icon and the words. Before the team is
 * settled a reply is the only thing the page knows, so it is the loudest thing
 * on the row. Afterwards the answer is what the player is doing, and two
 * columns in the same four colours means neither of them owns the colour: a
 * green "can play" beside a blue "reserve" invites the reader to work out which
 * one is the verdict, when only one of them is.
 */
export function ReplyBadge({ reply, quiet, className }: { reply: Reply | null; quiet?: boolean; className?: string }) {
  const Icon = reply === null ? Minus : REPLY_STYLE[reply].Icon;
  const label = reply === null ? "No reply" : REPLY_LABEL[reply];

  if (quiet) {
    return (
      <span className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs", className)}>
        <Icon className="size-3" />
        {label}
      </span>
    );
  }

  const tone =
    reply === null ? "text-muted-foreground border border-dashed" : `${REPLY_STYLE[reply].className} font-medium`;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs", tone, className)}>
      <Icon className="size-3" />
      {label}
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
