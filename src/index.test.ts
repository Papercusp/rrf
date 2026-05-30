import { describe, it, expect } from 'vitest';
import { rrfCombine, RRF_K_DEFAULT } from './index';

const item = (key: string, score = 0) => ({ key, score, row: { key } });

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
