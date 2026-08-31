import { Check, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";

/**
 * The PGN, in a box you can select from.
 *
 * The analysis links live at the top of the page, next to the board, because
 * that is where somebody decides they want a real engine. This is the thing
 * that always works: a long game does not fit in a URL, some tools want a paste
 * rather than a link, and the captain typing up a scoresheet wants to see the
 * text.
 */
export function PgnPanel({ pgn, label = "PGN" }: { pgn: string; label?: string }) {
  const { copied, copy } = useCopy();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <Button variant="outline" size="sm" onClick={() => copy(pgn)}>
          {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <textarea
        readOnly
        value={pgn}
        rows={8}
        spellCheck={false}
        onFocus={(event) => event.currentTarget.select()}
        className="bg-muted/40 focus-visible:ring-ring w-full resize-y rounded-lg border p-3 font-mono text-xs/6 focus-visible:ring-2 focus-visible:outline-none"
        aria-label={label}
      />
    </div>
  );
}
