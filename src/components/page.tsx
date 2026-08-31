import * as React from "react";
import { cn } from "@/lib/utils";

const SITE = "Bristol & Clifton G";

/**
 * Keep the tab title in step with the route.
 *
 * The site is one HTML file served for every path, so without this every page
 * shares the index's title, which is what a bookmark and a pasted link both
 * show.
 */
export function useDocumentTitle(title?: string) {
  React.useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}

/**
 * One width for every page, and it is the header's.
 *
 * Two widths meant the content edge moved as you navigated and stopped lining
 * up with the site header on the narrower pages, which reads as a rendering
 * fault rather than as typography. A single measure is what makes the site feel
 * like one thing. Anything that needs a narrower line, such as running prose,
 * constrains itself inside this column rather than shrinking the column.
 */
export function Page({
  title,
  lede,
  actions,
  children,
  className,
}: {
  title?: string;
  lede?: React.ReactNode;
  /** Buttons that belong to the page rather than to anything on it. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  useDocumentTitle(title);

  return (
    <main className={cn("mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-16 sm:px-6 sm:pt-10", className)}>
      {title && (
        <header className="mb-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {lede && <p className="text-muted-foreground mt-2 text-[0.95rem]/7">{lede}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </main>
  );
}

/** A titled block within a page, with an optional line of explanation. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-10 first:mt-0", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-1 text-sm/6">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** What a page shows when there is nothing yet, which is most of a new season. */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed px-5 py-8 text-center text-sm/6">
      {children}
    </div>
  );
}
