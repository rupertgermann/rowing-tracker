export interface CsvStrokeTarget {
  id: string;
  strokeIndex: number;
  timeMs: number; // elapsed ms from CSV session start (StrokeData.time * 1000)
}

export interface StrokeMatch {
  csvStrokeDataId: string;
  csvStrokeIndex: number;
  offsetMs: number; // signed: (poseCatchTime + delta) - csvTime
}

export interface AlignmentResult {
  matches: Map<number, StrokeMatch>; // pose strokeIndex → match
  deltaMs: number;
  matchedCount: number;
  unmatchedPoseStrokes: number[];
  unmatchedCsvStrokes: number[];
}

export const ALIGNMENT_TOLERANCE_MS = 2500;

// Candidate delta rounding bucket (ms). Coarser = faster, finer = more accurate.
const DELTA_BUCKET_MS = 100;

export function alignStrokesToCsv(
  poseCatchTimesMs: number[],
  csvStrokes: CsvStrokeTarget[],
  toleranceMs = ALIGNMENT_TOLERANCE_MS,
): AlignmentResult {
  if (poseCatchTimesMs.length === 0 || csvStrokes.length === 0) {
    return {
      matches: new Map(),
      deltaMs: 0,
      matchedCount: 0,
      unmatchedPoseStrokes: poseCatchTimesMs.map((_, i) => i),
      unmatchedCsvStrokes: csvStrokes.map((s) => s.strokeIndex),
    };
  }

  const deltaMs = estimateDelta(poseCatchTimesMs, csvStrokes, toleranceMs);
  return applyDelta(poseCatchTimesMs, csvStrokes, deltaMs, toleranceMs);
}

function estimateDelta(
  poseTimes: number[],
  csvStrokes: CsvStrokeTarget[],
  tolerance: number,
): number {
  // Score each candidate delta (csv[j] - pose[i], rounded to nearest bucket).
  // Limit brute-force to at most 50 pose × all csv pairs.
  const csvTimes = csvStrokes.map((s) => s.timeMs);
  const candidates = new Set<number>();
  const poseLimit = Math.min(poseTimes.length, 50);

  for (let i = 0; i < poseLimit; i++) {
    for (const csvTime of csvTimes) {
      const raw = csvTime - poseTimes[i];
      candidates.add(Math.round(raw / DELTA_BUCKET_MS) * DELTA_BUCKET_MS);
    }
  }

  let bestDelta = 0;
  let bestScore = -1;
  for (const delta of candidates) {
    const score = scoreWithDelta(poseTimes, csvTimes, delta, tolerance);
    if (score > bestScore) {
      bestScore = score;
      bestDelta = delta;
    }
  }
  return bestDelta;
}

function scoreWithDelta(
  poseTimes: number[],
  csvTimes: number[],
  delta: number,
  tolerance: number,
): number {
  let matched = 0;
  const usedCsv = new Set<number>();
  for (const poseTime of poseTimes) {
    const adjusted = poseTime + delta;
    let bestDist = tolerance;
    let bestIdx = -1;
    for (let j = 0; j < csvTimes.length; j++) {
      if (usedCsv.has(j)) continue;
      const dist = Math.abs(adjusted - csvTimes[j]);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }
    if (bestIdx !== -1) {
      matched++;
      usedCsv.add(bestIdx);
    }
  }
  return matched;
}

function applyDelta(
  poseCatchTimesMs: number[],
  csvStrokes: CsvStrokeTarget[],
  deltaMs: number,
  toleranceMs: number,
): AlignmentResult {
  const matches = new Map<number, StrokeMatch>();
  const usedCsvIndices = new Set<number>();

  // Collect all pairs within tolerance and sort by proximity (greedy optimal for 1:1 matching).
  const pairs: Array<{ poseIdx: number; csvIdx: number; dist: number }> = [];
  for (let p = 0; p < poseCatchTimesMs.length; p++) {
    const adjusted = poseCatchTimesMs[p] + deltaMs;
    for (let c = 0; c < csvStrokes.length; c++) {
      const dist = Math.abs(adjusted - csvStrokes[c].timeMs);
      if (dist <= toleranceMs) {
        pairs.push({ poseIdx: p, csvIdx: c, dist });
      }
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  const matchedPoseIndices = new Set<number>();
  for (const { poseIdx, csvIdx, dist: _ } of pairs) {
    if (matchedPoseIndices.has(poseIdx) || usedCsvIndices.has(csvIdx)) continue;
    const csv = csvStrokes[csvIdx];
    matches.set(poseIdx, {
      csvStrokeDataId: csv.id,
      csvStrokeIndex: csv.strokeIndex,
      offsetMs: poseCatchTimesMs[poseIdx] + deltaMs - csv.timeMs,
    });
    matchedPoseIndices.add(poseIdx);
    usedCsvIndices.add(csvIdx);
  }

  return {
    matches,
    deltaMs,
    matchedCount: matchedPoseIndices.size,
    unmatchedPoseStrokes: poseCatchTimesMs.map((_, i) => i).filter((i) => !matchedPoseIndices.has(i)),
    unmatchedCsvStrokes: csvStrokes.map((s) => s.strokeIndex).filter((_, c) => !usedCsvIndices.has(c)),
  };
}
