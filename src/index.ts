/**
 * Reciprocal Rank Fusion — combines multiple ranked lists without
 * requiring score normalization between rankers. score(d) = Σ 1/(k+rank).
 * Pure function; unit-testable without DB.
 */

export interface RankedItem<T> {
  /** Stable identity across rankers — used to merge across lists. */
  key: string;
  /** Ranker-native score; not used by RRF, kept for inspection. */
  score: number;
  /** Whatever payload callers want to carry through. */
  row: T;
}

export interface FusedItem<T> {
  row: T;
  /** Sum of RRF contributions across all rankers that found the item. */
  score: number;
  /** Names of rankers that returned this item, in insertion order. */
  rankers: string[];
}

export const RRF_K_DEFAULT = 60;

export function rrfCombine<T>(
  inputs: Array<{ name: string; list: Array<RankedItem<T>> }>,
  k = RRF_K_DEFAULT,
): Array<FusedItem<T>> {
  const acc = new Map<string, { row: T; score: number; rankers: string[] }>();
  for (const { name, list } of inputs) {
    list.forEach((entry, idx) => {
      const rrf = 1 / (k + idx + 1);
      const existing = acc.get(entry.key);
      if (existing) {
        existing.score += rrf;
        if (!existing.rankers.includes(name)) existing.rankers.push(name);
      } else {
        acc.set(entry.key, { row: entry.row, score: rrf, rankers: [name] });
      }
    });
  }
  return Array.from(acc.values()).sort((a, b) => b.score - a.score);
}
