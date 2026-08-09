# Performance benchmarks — 2026-08-09

## Scope and method

Benchmarks ran on commit `169bdba` plus the working change, using Node 24.18.0
on arm64 macOS. Each reported result uses one warmup and three measured samples.
The benchmark harnesses validate stable result checksums as well as timings.

Reproduce the measured paths with:

```bash
npm run perf:projections -- --warmups=1 --samples=3 --max-median-ms=100
npm run perf:alignment -- --warmups=1 --samples=3 --max-median-ms=100
```

These are deterministic CPU benchmarks for real application seams. They do not
claim to measure network, database, rendering, or complete route latency.

## Results

### Award projection after session import

`computeEarnedAwards` is called when imported sessions are projected into earned
awards and by the awards UI. The benchmark uses 1,000 chronological sessions and
39 earned awards.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Median | 2,963.18 ms | 28.70 ms | 103.24x faster |
| p95 | 3,031.98 ms | 29.71 ms | 102.04x faster |

The previous implementation sorted the same history per award and exhaustively
rebuilt every chronological prefix with full statistics. Award conditions are
cumulative, so the implementation now sorts once, caches prefix projections,
and locates the first qualifying prefix with binary search. An exhaustive
differential test verifies the first-earned dates.

### CSV-to-mocap stroke alignment

This path runs during mandatory linked-session reanalysis. The result checksum
covers the selected delta, every stroke mapping and offset, and unmatched rows.

| Strokes | Before median | After median | Change |
| ---: | ---: | ---: | ---: |
| 25 | 0.72 ms | 0.51 ms | 1.40x faster |
| 50 | 6.20 ms | 1.39 ms | 4.46x faster |
| 100 | 42.18 ms | 4.18 ms | 10.10x faster |
| 200 | 278.52 ms | 15.69 ms | 17.75x faster |
| 400 | 1,876.93 ms | 63.64 ms | 29.49x faster |

The previous candidate scorer scanned every CSV stroke for every pose stroke.
The replacement uses an ordered time index with successor/predecessor disjoint
sets, plus a linear insertion scan for chronological pose data. It retains a
binary-search fallback for non-chronological inputs. A deterministic 100-case
differential test preserves the previous greedy matching and tie behavior.

## Measured next candidates

The following were diagnosed against the local 1,000-session account but were
not changed in this pass because they need separate route-level benchmarks or a
product decision about semantics:

- `/api/data-usage` materialized 57.8 MB and took about 916 ms across database
  loading, JSON serialization, and encoding. A database-side physical-size
  aggregate took 31.6 ms, but reports a different definition of "size."
- `/api/analytics` spent 77.5 ms transforming 1,000 rows, dominated by repeated
  locale date formatting. Reusing one formatter and one pass measured 1.4 ms
  with byte-identical output in a diagnostic harness.
- Session-list cache validation returned 522,679 bytes in 23.36 ms when callers
  needed only revision and count; the narrow query was 35 bytes in 1.14 ms.
- A 25-session import performs 50 serial duplicate lookups before its writes.
  One batched prefetch measured 1.59 ms versus 30.7 ms for those lookups.
- Insight cards appear to trigger per-card insight and chat reads, and mocap
  capture pushes frame-rate updates through React state. Both need browser-level
  request/commit benchmarks before changing behavior.
