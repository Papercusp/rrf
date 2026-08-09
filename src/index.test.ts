import { describe, it, expect } from 'vitest';
import { rrfCombine, RRF_K_DEFAULT } from './index';

const item = (key: string, score = 0) => ({ key, score, row: { key } });

describe('rrfCombine rankOffset — a list that CONTINUES another ranking', () => {
  it('offsets contributions instead of restarting the rank scale at 0', () => {
    const [noOffset] = rrfCombine([{ name: 'fresh', list: [item('x')] }]);
    const [offset] = rrfCombine([{ name: 'fresh', list: [item('x')], rankOffset: 10 }]);
    expect(noOffset!.score).toBeCloseTo(1 / (RRF_K_DEFAULT + 1), 12);
    expect(offset!.score).toBeCloseTo(1 / (RRF_K_DEFAULT + 11), 12);
  });

  it('stops a continuation list outranking the main list it was beaten by', () => {
    // `far` lost the main ranking outright; `mid` is the main list's last row.
    // Without the offset the continuation's rank-0 row beats every main row —
    // the exact defect measured in D-044.
    const main = [item('top'), item('mid')];
    const cont = [item('far')];
    const unfixed = rrfCombine([
      { name: 'lexical', list: main },
      { name: 'lexical-fresh', list: cont },
    ]);
    expect(unfixed.map((f) => f.row.key)).toEqual(['top', 'far', 'mid']);

    const fixed = rrfCombine([
      { name: 'lexical', list: main },
      { name: 'lexical-fresh', list: cont, rankOffset: main.length },
    ]);
    expect(fixed.map((f) => f.row.key)).toEqual(['top', 'mid', 'far']);
  });

  it('still lets a continuation row win on AGREEMENT — a seat, not a demotion', () => {
    // `both` is found by the main leg AND another ranker; the offset must not
    // stop the two contributions summing past a single-leg row.
    const out = rrfCombine([
      { name: 'lexical', list: [item('solo'), item('both')] },
      { name: 'embeddings', list: [item('both')] },
      { name: 'lexical-fresh', list: [item('late')], rankOffset: 2 },
    ]);
    expect(out[0]!.row.key).toBe('both');
    expect(out.at(-1)!.row.key).toBe('late');
  });

  it('treats omitted / zero / negative offsets as no offset', () => {
    const base = rrfCombine([{ name: 'r', list: [item('a')] }])[0]!.score;
    for (const rankOffset of [0, -5, undefined]) {
      expect(rrfCombine([{ name: 'r', list: [item('a')], rankOffset }])[0]!.score).toBeCloseTo(
        base,
        12,
      );
    }
  });
});

describe('rrfCombine', () => {
  it('returns empty for empty input', () => {
    expect(rrfCombine([])).toEqual([]);
  });

  it('handles a single ranker — preserves order, computes 1/(k+rank)', () => {
    const out = rrfCombine([
      { name: 'bm25', list: [item('a'), item('b'), item('c')] },
    ]);
    expect(out.map((x) => x.row.key)).toEqual(['a', 'b', 'c']);
    expect(out[0].score).toBeCloseTo(1 / (RRF_K_DEFAULT + 1));
    expect(out[1].score).toBeCloseTo(1 / (RRF_K_DEFAULT + 2));
    expect(out.every((x) => x.rankers.length === 1 && x.rankers[0] === 'bm25')).toBe(true);
  });

  it('sums contributions for items that appear in multiple rankers', () => {
    const out = rrfCombine([
      { name: 'bm25',       list: [item('a'), item('b'), item('c')] },
      { name: 'embeddings', list: [item('c'), item('a'), item('d')] },
    ]);
    const byKey = Object.fromEntries(out.map((x) => [x.row.key, x]));
    // 'a' is rank 1 in bm25 and rank 2 in embeddings
    expect(byKey.a.score).toBeCloseTo(
      1 / (RRF_K_DEFAULT + 1) + 1 / (RRF_K_DEFAULT + 2),
    );
    expect(byKey.a.rankers.sort()).toEqual(['bm25', 'embeddings']);
    // 'c' is rank 3 in bm25 and rank 1 in embeddings
    expect(byKey.c.score).toBeCloseTo(
      1 / (RRF_K_DEFAULT + 3) + 1 / (RRF_K_DEFAULT + 1),
    );
  });

  it('items found in BOTH rankers outrank items found in only one', () => {
    const out = rrfCombine([
      { name: 'bm25',       list: [item('only-bm'), item('shared')] },
      { name: 'embeddings', list: [item('only-emb'), item('shared')] },
    ]);
    expect(out[0].row.key).toBe('shared');
    expect(out[0].rankers.sort()).toEqual(['bm25', 'embeddings']);
  });

  it('k controls the dampening — larger k flattens the curve', () => {
    const flat = rrfCombine([{ name: 'a', list: [item('x'), item('y')] }], 1000);
    const sharp = rrfCombine([{ name: 'a', list: [item('x'), item('y')] }], 1);
    const ratioFlat = flat[0].score / flat[1].score;
    const ratioSharp = sharp[0].score / sharp[1].score;
    expect(ratioSharp).toBeGreaterThan(ratioFlat);
  });

  it('dedupes a ranker name when the same ranker contributes twice', () => {
    const out = rrfCombine([
      { name: 'bm25', list: [item('a')] },
      { name: 'bm25', list: [item('a')] }, // shouldn't double-count the *name*
    ]);
    expect(out[0].rankers).toEqual(['bm25']);
    // Score IS summed even if name is not duplicated
    expect(out[0].score).toBeCloseTo(2 / (RRF_K_DEFAULT + 1));
  });

  it('preserves the row payload from the first occurrence', () => {
    const a1 = { key: 'a', score: 99, row: { which: 'first' } };
    const a2 = { key: 'a', score: 1,  row: { which: 'second' } };
    const out = rrfCombine([
      { name: 'bm25',       list: [a1] },
      { name: 'embeddings', list: [a2] },
    ]);
    expect(out[0].row).toEqual({ which: 'first' });
  });
});
