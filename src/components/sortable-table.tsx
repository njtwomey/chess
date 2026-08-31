import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Sorting for a shadcn `Table`.
 *
 * shadcn has no sortable table. Its "data table" is a documented recipe around
 * TanStack Table, which brings a column model, a row model and a few hundred
 * lines of adapter, and this site has one table of fourteen rows. So the sorting
 * lives here instead: a comparator per column and a header that toggles it.
 * Swapping in TanStack later means replacing this file and nothing else.
 */
export interface SortState<K extends string> {
  key: K;
  direction: "asc" | "desc";
}

export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = React.useState<SortState<K>>(initial);

  /**
   * Clicking a new column starts it in its own natural direction rather than
   * inheriting the last one. A rating column wants highest first; a name column
   * wants A to Z, and carrying the previous direction over produces a first
   * click that looks broken.
   */
  const toggle = React.useCallback((key: K, natural: "asc" | "desc") => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: natural },
    );
  }, []);

  return { sort, toggle };
}

export function SortableHead<K extends string>({
  column,
  sort,
  toggle,
  natural = "asc",
  align = "left",
  className,
  children,
}: {
  column: K;
  sort: SortState<K>;
  toggle: (key: K, natural: "asc" | "desc") => void;
  /** Which way this column runs on the first click. */
  natural?: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => toggle(column, natural)}
        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "hover:text-foreground -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        {children}
        <Icon className={cn("size-3", active ? "opacity-100" : "opacity-40")} />
      </button>
    </TableHead>
  );
}

/**
 * Compare two values, putting nulls last whichever way the column is sorted.
 *
 * An unrated player has no rating, and sorting them to the bottom of "highest
 * first" and then to the top of "lowest first" would read as a claim that they
 * are the weakest in the squad. Absent is not a small number, so it sits at the
 * end either way.
 */
export function compareValues(a: string | number | null, b: string | number | null, direction: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const order = typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : Number(a) - Number(b);
  return direction === "asc" ? order : -order;
}
