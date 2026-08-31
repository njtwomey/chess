import * as React from "react";

/**
 * Show what went wrong instead of a blank page.
 *
 * This matters more here than in most apps because `data.ts` throws on purpose
 * when the season files disagree with each other, and that message names the
 * exact file and the exact contradiction. Losing it to a white screen would
 * turn a five-second fix into an afternoon.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Something is wrong with the data</h1>
        <p className="text-muted-foreground mt-2 text-sm/7">
          The site refused to start rather than show you something that might be untrue. The message below says which
          file and which record.
        </p>
        <pre className="bg-muted/50 mt-5 overflow-x-auto rounded-lg border p-4 font-mono text-xs/6 whitespace-pre-wrap">
          {error.message}
        </pre>
      </main>
    );
  }
}
