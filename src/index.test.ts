/**
 * Tests for Reciprocal Rank Fusion.
 */

import { describe, it, expect } from 'vitest';
import { rrfFuse, type RankedItem } from './index';

describe('rrfFuse', () => {
  it('returns empty for no rankers', () => {
    expect(rrfFuse({ rankers: [] })).toEqual([]);
  });

  it('single ranker preserves order', () => {
    const ranker: RankedItem[] = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ];
    const out = rrfFuse({ rankers: [ranker] });
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it('combines two rankers, rewarding agreement', () => {
    const r1: RankedItem[] = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const r2: RankedItem[] = [{ id: 'y' }, { id: 'x' }, { id: 'w' }];
    const out = rrfFuse({ rankers: [r1, r2] });
    // x and y appear in both → should rank above z and w
    const ids = out.map((r) => r.id);
    expect(ids.slice(0, 2).sort()).toEqual(['x', 'y']);
    expect(out.find((r) => r.id === 'x')!.rankerHits).toBe(2);
    expect(out.find((r) => r.id === 'z')!.rankerHits).toBe(1);
  });

  it('respects k damping', () => {
    const r1: RankedItem[] = [{ id: 'a' }, { id: 'b' }];
    const out1 = rrfFuse({ rankers: [r1], k: 1 });
    const out60 = rrfFuse({ rankers: [r1], k: 60 });
    // smaller k → larger gap between rank 1 and rank 2
    const gap1 = out1[0].score - out1[1].score;
    const gap60 = out60[0].score - out60[1].score;
    expect(gap1).toBeGreaterThan(gap60);
  });
});
