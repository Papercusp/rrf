/**
 * Reciprocal Rank Fusion (RRF) — combine multiple ranked result lists
 * into one. score(d) = Σ 1/(k + rank_i(d)) over each ranker i that
 * returned d. Higher = better. Classic k = 60 (Cormack et al. 2009).
 *
 * Pure module: no DB, no embeddings, no I/O. Unit-testable in isolation.
 */

export interface RankedItem {
  /** Stable identifier for the document/row across rankers. */
  id: string;
  /** Optional payload carried through to the fused result. */
  payload?: unknown;
}

export interface RrfInput {
  /** One entry per ranker: an ordered list (best first). */
  rankers: RankedItem[][];
  /** Damping constant; classic value 60. */
  k?: number;
}

export interface RrfResult {
  id: string;
  score: number;
  payload?: unknown;
  /** How many rankers returned this id. */
  rankerHits: number;
}

/**
 * Fuse N ranked lists via Reciprocal Rank Fusion. Deterministic:
 * ties broken by id (lexicographic ascending) for stable output.
 */
export function rrfFuse(input: RrfInput): RrfResult[] {
  const k = input.k ?? 60;
  const acc = new Map<string, { score: number; payload?: unknown; hits: number }>();
  for (const ranker of input.rankers) {
    for (let i = 0; i < ranker.length; i++) {
      const item = ranker[i];
      const rank = i + 1; // 1-based
      const prev = acc.get(item.id);
      const contribution = 1 / (k + rank);
      if (prev) {
        prev.score += contribution;
        if (prev.payload === undefined && item.payload !== undefined) {
          prev.payload = item.payload;
        }
        prev.hits += 1;
      } else {
        acc.set(item.id, {
          score: contribution,
          payload: item.payload,
          hits: 1,
        });
      }
    }
  }
  const out: RrfResult[] = [];
  for (const [id, v] of acc) {
    out.push({ id, score: v.score, payload: v.payload, rankerHits: v.hits });
  }
  out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return out;
}
