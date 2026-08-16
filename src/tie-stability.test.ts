import { describe, it, expect } from 'vitest';
import { rrfCombine, RRF_K_DEFAULT } from './index';

// Coverage gap: index.test.ts pins scoring, name-dedup, and first-payload
// preservation, but NOT the tie-breaking order, empty-list rankers, or the
// k boundary. Search result ordering must be DETERMINISTIC — two items with
// equal fused score have to resolve in a defined, stable way or the same query
// renders results in a different order on re-run. rrfCombine relies on (a) Map
// insertion order and (b) a STABLE Array.sort (guaranteed since ES2019) to make
// ties resolve to first-seen-first. These tests pin that contract.

const item = (key: string, score = 0) => ({ key, score, row: { key } });

describe('rrfCombine — tie order, determinism, and edges', () => {
  it('breaks score ties by INSERTION order, not by key name', () => {
    // 'alpha' and 'beta' are each rank-1 in their own single-item ranker, so
    // their fused scores are identical (1/(k+1)). The tie must resolve to
    // whichever was inserted first — i.e. swapping the input order swaps the
    // output order. (A key-sorted or score-only impl would return the same
    // order both times and fail the second assertion — this is non-vacuous.)
    const out1 = rrfCombine([
      { name: 'r1', list: [item('alpha')] },
      { name: 'r2', list: [item('beta')] },
    ]);
    const out2 = rrfCombine([
      { name: 'r1', list: [item('beta')] },
      { name: 'r2', list: [item('alpha')] },
    ]);
    expect(out1[0].score).toBeCloseTo(out1[1].score); // genuinely tied
    expect(out1.map((x) => x.row.key)).toEqual(['alpha', 'beta']);
    expect(out2.map((x) => x.row.key)).toEqual(['beta', 'alpha']);
  });

  it('is deterministic — identical input yields identical key order across runs', () => {
    const build = () =>
      rrfCombine([
        { name: 'bm25', list: [item('a'), item('b'), item('c'), item('d')] },
        { name: 'emb', list: [item('d'), item('c'), item('b'), item('a')] },
      ]);
    // Every position is a perfect tie (a&d each 1/(k+1)+1/(k+4); b&c each
    // 1/(k+2)+1/(k+3)), so only stable tie-breaking keeps the order fixed.
    const first = build().map((x) => x.row.key);
    const second = build().map((x) => x.row.key);
    expect(second).toEqual(first);
    expect(first).toEqual(['a', 'd', 'b', 'c']); // insertion order within each tie pair
  });

  it('an empty-list ranker contributes nothing and never appears in rankers[]', () => {
    const out = rrfCombine([
      { name: 'empty', list: [] },
      { name: 'bm25', list: [item('a'), item('b')] },
    ]);
    expect(out.map((x) => x.row.key)).toEqual(['a', 'b']);
    expect(out.every((x) => !x.rankers.includes('empty'))).toBe(true);
    expect(out[0].score).toBeCloseTo(1 / (RRF_K_DEFAULT + 1));
  });

  it('all rankers empty → empty output (no crash)', () => {
    expect(
      rrfCombine([
        { name: 'a', list: [] },
        { name: 'b', list: [] },
      ]),
    ).toEqual([]);
  });

  it('k=0 yields the unshifted harmonic series 1/(rank) (boundary of the k contract)', () => {
    const out = rrfCombine([{ name: 'a', list: [item('x'), item('y'), item('z')] }], 0);
    expect(out[0].score).toBeCloseTo(1 / 1); // 1/(0+0+1)
    expect(out[1].score).toBeCloseTo(1 / 2); // 1/(0+1+1)
    expect(out[2].score).toBeCloseTo(1 / 3); // 1/(0+2+1)
  });
});
