/**
 * Two marks lucide does not carry, for the two analysis sites.
 *
 * Deliberately generic chess pieces on lucide's 24x24 grid rather than either
 * company's logo: reproducing somebody's trademark badly is worse than not
 * using it, and these sit beside a text label that says which site it is.
 * Check lucide before adding a third.
 */
type IconProps = { className?: string };

/** A knight, for Lichess. */
export function KnightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8.4 2.2a1 1 0 0 1 1.7.3l.5 1.4 2 -.7a6.6 6.6 0 0 1 8.4 6.3V19a1 1 0 0 1-1 1H8.6a1 1 0 0 1-1-1.2c.3-1.7 1.2-3 2.6-4.2 1-.9 1.7-1.5 2-2.1l-2.6 1.2a2.6 2.6 0 0 1-3.3-1L4.9 9.4a1 1 0 0 1 .2-1.3l3-2.3-.1-2.5a1 1 0 0 1 .4-1.1Z" />
      <path d="M5 21.5A1.5 1.5 0 0 1 6.5 20h13a1.5 1.5 0 0 1 0 3h-13A1.5 1.5 0 0 1 5 21.5Z" />
    </svg>
  );
}

/** A pawn, for Chess.com. */
export function PawnIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 1.5a4 4 0 0 0-2.5 7.1c-.4 1.9-1.4 3.4-2.7 4.7a1 1 0 0 0 .7 1.7h9a1 1 0 0 0 .7-1.7c-1.3-1.3-2.3-2.8-2.7-4.7A4 4 0 0 0 12 1.5Z" />
      <path d="M7.7 16.5h8.6l.9 3.5H6.8l.9-3.5Z" />
      <path d="M5 21.5A1.5 1.5 0 0 1 6.5 20h11a1.5 1.5 0 0 1 0 3h-11A1.5 1.5 0 0 1 5 21.5Z" />
    </svg>
  );
}
