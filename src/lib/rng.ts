/**
 * Deterministic tiebreaking.
 *
 * Selection has to break ties between equally-rested players, and it has to
 * break them the same way every time it is asked. A shuffle seeded once per
 * process would give a different team on a page reload, which is indefensible
 * when the whole promise of the system is that it can be re-run and audited.
 *
 * So there is no generator and no state here. Each player gets a number derived
 * from the season seed, the match and their own id, and the sort uses it. That
 * makes the result a pure function of the data, independent of array order,
 * insertion order and wall-clock time.
 */

/** FNV-1a, 32-bit. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * murmur3's finaliser.
 *
 * FNV-1a alone is not enough here. The inputs are near-identical strings that
 * differ only in a few trailing characters, and its avalanche on those is poor
 * enough that ids sharing a prefix land close together in the range. Mixing
 * fixes the distribution, which is what makes a tie a genuine coin toss rather
 * than a slow alphabetical bias nobody would notice until someone plotted it.
 */
function mix(value: number): number {
  let hash = value;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * A stable number in [0, 2^32) for one player in one match.
 *
 * The match id is in the hash as well as the seed. Without it a given pair of
 * tied players would break the same way in every match of the season, so
 * whoever lost the toss in September would lose it again in October and again
 * in December, which is the exact opposite of spreading games around.
 *
 * The parts are joined with a space, which cannot occur in an id, so
 * ("ab", "c") and ("a", "bc") cannot collide.
 */
export function tiebreakValue(seed: string, matchId: string, playerId: string): number {
  return mix(fnv1a([seed, matchId, playerId].join(" ")));
}
