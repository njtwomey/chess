import { Search } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

/**
 * The way into a game: this site's own board, as against the two outside it.
 *
 * A magnifier rather than a word, because the column heading already says what
 * it does and the row beside it is icons the whole way along. No tooltip: the
 * heading has said it, and a tooltip repeating a heading is something to dismiss
 * rather than something to read. The length of the game is next door on the copy
 * button, which is the thing it describes.
 */
export function ViewGame({ to }: { to: string }) {
  return (
    <Button variant="ghost" size="icon" className="size-8" asChild>
      <Link to={to} aria-label="Play through the game">
        <Search className="size-4" />
      </Link>
    </Button>
  );
}
