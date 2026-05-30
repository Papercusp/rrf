# @papercusp/rrf

Reciprocal Rank Fusion — combine multiple ranked result lists into one.

```ts
import { rrfFuse } from '@papercusp/rrf';

const fused = rrfFuse({
  rankers: [
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }], // ranker 1 (best first)
    [{ id: 'b' }, { id: 'a' }, { id: 'd' }], // ranker 2
  ],
  k: 60, // damping constant; classic value (Cormack et al. 2009)
});
// → [{ id, score, payload?, rankerHits }, …] sorted best-first,
//   ties broken by id ascending for determinism.
```

`score(d) = Σ 1/(k + rank_i(d))` over each ranker `i` that returned `d`.

Pure: no DB, no embeddings, no I/O. Zero runtime dependencies. The
canonical use is fusing a BM25 ranking with a vector-similarity ranking
into one hybrid result, but it is domain-agnostic — any set of ranked
lists with stable ids works.
