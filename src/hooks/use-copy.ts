import * as React from "react";

/**
 * Copy text to the clipboard and report success for a moment afterwards, so a
 * button can confirm what it did without a toast.
 */
export function useCopy(resetAfterMs = 1600) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copy = React.useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetAfterMs);
      } catch {
        // A denied clipboard permission is not worth interrupting anyone over;
        // the button simply does not confirm.
        setCopied(false);
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
