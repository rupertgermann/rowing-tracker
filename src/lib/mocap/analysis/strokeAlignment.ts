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
  // Limit candidate generation to at most 50 pose × all csv pairs.
  const csvTimes = csvStrokes.map((s) => s.timeMs);
  const scorer = new DeltaMatchScorer(csvTimes);
  const poseTimesAreSorted = poseTimes.every(
    (time, index) => index === 0 || time >= poseTimes[index - 1],
  );
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
    const score = scorer.score(poseTimes, delta, tolerance, poseTimesAreSorted);
    if (score > bestScore) {
      bestScore = score;
      bestDelta = delta;
    }
  }
  return bestDelta;
}

interface IndexedTime {
  timeMs: number;
  originalIndex: number;
}

class DeltaMatchScorer {
  private readonly entries: IndexedTime[];

  constructor(csvTimes: number[]) {
    this.entries = csvTimes
      .map((timeMs, originalIndex) => ({ timeMs, originalIndex }))
      .sort((left, right) =>
        left.timeMs - right.timeMs || left.originalIndex - right.originalIndex,
      );
  }

  score(
    poseTimes: number[],
    delta: number,
    tolerance: number,
    poseTimesAreSorted: boolean,
  ): number {
    const available = new AvailableTimeIndex(this.entries);
    let matched = 0;
    let insertionIndex = 0;

    for (const poseTime of poseTimes) {
      const targetTime = poseTime + delta;
      if (poseTimesAreSorted) {
        while (
          insertionIndex < this.entries.length &&
          this.entries[insertionIndex].timeMs < targetTime
        ) {
          insertionIndex += 1;
        }
      }

      if (
        available.takeNearest(
          targetTime,
          tolerance,
          poseTimesAreSorted ? insertionIndex : undefined,
        ) !== -1
      ) {
        matched += 1;
      }
    }

    return matched;
  }
}

class AvailableTimeIndex {
  private readonly nextAvailable: Int32Array;
  private readonly previousAvailable: Int32Array;

  constructor(private readonly entries: IndexedTime[]) {
    this.nextAvailable = new Int32Array(entries.length + 1);
    this.previousAvailable = new Int32Array(entries.length + 1);

    for (let index = 0; index <= entries.length; index += 1) {
      this.nextAvailable[index] = index;
      this.previousAvailable[index] = index;
    }
  }

  // Successor/predecessor disjoint sets keep nearest-unused lookup cheap while
  // retaining the original scorer's distance and CSV-index tie breaking.
  takeNearest(
    targetTimeMs: number,
    toleranceMs: number,
    knownInsertionIndex?: number,
  ): number {
    const insertionIndex = knownInsertionIndex ?? this.lowerBound(targetTimeMs);
    const previousPosition = this.findPrevious(insertionIndex);
    const leftIndex = previousPosition > 0
      ? this.firstAvailableAtTime(previousPosition - 1)
      : -1;
    const nextPosition = this.findNext(insertionIndex);
    const rightIndex = nextPosition < this.entries.length ? nextPosition : -1;

    const chosenIndex = this.nearerIndex(leftIndex, rightIndex, targetTimeMs);
    if (
      chosenIndex === -1 ||
      Math.abs(targetTimeMs - this.entries[chosenIndex].timeMs) >= toleranceMs
    ) {
      return -1;
    }

    this.remove(chosenIndex);
    return this.entries[chosenIndex].originalIndex;
  }

  private nearerIndex(leftIndex: number, rightIndex: number, targetTimeMs: number): number {
    if (leftIndex === -1) return rightIndex;
    if (rightIndex === -1) return leftIndex;

    const left = this.entries[leftIndex];
    const right = this.entries[rightIndex];
    const leftDistance = Math.abs(targetTimeMs - left.timeMs);
    const rightDistance = Math.abs(targetTimeMs - right.timeMs);

    if (leftDistance !== rightDistance) {
      return leftDistance < rightDistance ? leftIndex : rightIndex;
    }

    return left.originalIndex < right.originalIndex ? leftIndex : rightIndex;
  }

  private firstAvailableAtTime(index: number): number {
    const timeMs = this.entries[index].timeMs;
    const firstAtTime = this.lowerBound(timeMs);
    const firstAvailable = this.findNext(firstAtTime);

    return this.entries[firstAvailable].timeMs === timeMs ? firstAvailable : index;
  }

  private lowerBound(targetTimeMs: number): number {
    let low = 0;
    let high = this.entries.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.entries[middle].timeMs < targetTimeMs) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return low;
  }

  private findNext(index: number): number {
    let root = index;
    while (this.nextAvailable[root] !== root) {
      root = this.nextAvailable[root];
    }

    while (this.nextAvailable[index] !== index) {
      const next = this.nextAvailable[index];
      this.nextAvailable[index] = root;
      index = next;
    }

    return root;
  }

  private findPrevious(position: number): number {
    let root = position;
    while (this.previousAvailable[root] !== root) {
      root = this.previousAvailable[root];
    }

    while (this.previousAvailable[position] !== position) {
      const previous = this.previousAvailable[position];
      this.previousAvailable[position] = root;
      position = previous;
    }

    return root;
  }

  private remove(index: number): void {
    this.nextAvailable[index] = this.findNext(index + 1);
    this.previousAvailable[index + 1] = this.findPrevious(index);
  }
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
  for (const { poseIdx, csvIdx } of pairs) {
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
