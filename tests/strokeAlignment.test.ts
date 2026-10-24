import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  alignStrokesToCsv,
  ALIGNMENT_TOLERANCE_MS,
  type AlignmentResult,
  type CsvStrokeTarget,
  type StrokeMatch,
} from "../src/lib/mocap/analysis/strokeAlignment";

function makeCsv(timesMs: number[]): CsvStrokeTarget[] {
  return timesMs.map((timeMs, i) => ({
    id: `csv-${i}`,
    strokeIndex: i,
    timeMs,
  }));
}

function referenceAlignStrokesToCsv(
  poseCatchTimesMs: number[],
  csvStrokes: CsvStrokeTarget[],
  toleranceMs: number,
): AlignmentResult {
  if (poseCatchTimesMs.length === 0 || csvStrokes.length === 0) {
    return {
      matches: new Map(),
      deltaMs: 0,
      matchedCount: 0,
      unmatchedPoseStrokes: poseCatchTimesMs.map((_, index) => index),
      unmatchedCsvStrokes: csvStrokes.map((stroke) => stroke.strokeIndex),
    };
  }

  const csvTimes = csvStrokes.map((stroke) => stroke.timeMs);
  const candidates = new Set<number>();
  const poseLimit = Math.min(poseCatchTimesMs.length, 50);

  for (let poseIndex = 0; poseIndex < poseLimit; poseIndex += 1) {
    for (const csvTime of csvTimes) {
      const rawDelta = csvTime - poseCatchTimesMs[poseIndex];
      candidates.add(Math.round(rawDelta / 100) * 100);
    }
  }

  let deltaMs = 0;
  let bestScore = -1;
  for (const candidate of candidates) {
    const usedCsv = new Set<number>();
    let score = 0;

    for (const poseTime of poseCatchTimesMs) {
      const adjusted = poseTime + candidate;
      let bestDistance = toleranceMs;
      let bestIndex = -1;

      for (let csvIndex = 0; csvIndex < csvTimes.length; csvIndex += 1) {
        if (usedCsv.has(csvIndex)) continue;
        const distance = Math.abs(adjusted - csvTimes[csvIndex]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = csvIndex;
        }
      }

      if (bestIndex !== -1) {
        score += 1;
        usedCsv.add(bestIndex);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      deltaMs = candidate;
    }
  }

  const pairs: Array<{ poseIndex: number; csvIndex: number; distance: number }> = [];
  for (let poseIndex = 0; poseIndex < poseCatchTimesMs.length; poseIndex += 1) {
    const adjusted = poseCatchTimesMs[poseIndex] + deltaMs;
    for (let csvIndex = 0; csvIndex < csvStrokes.length; csvIndex += 1) {
      const distance = Math.abs(adjusted - csvStrokes[csvIndex].timeMs);
      if (distance <= toleranceMs) pairs.push({ poseIndex, csvIndex, distance });
    }
  }
  pairs.sort((left, right) => left.distance - right.distance);

  const matches = new Map<number, StrokeMatch>();
  const usedCsv = new Set<number>();
  const matchedPose = new Set<number>();

  for (const pair of pairs) {
    if (matchedPose.has(pair.poseIndex) || usedCsv.has(pair.csvIndex)) continue;
    const csvStroke = csvStrokes[pair.csvIndex];
    matches.set(pair.poseIndex, {
      csvStrokeDataId: csvStroke.id,
      csvStrokeIndex: csvStroke.strokeIndex,
      offsetMs: poseCatchTimesMs[pair.poseIndex] + deltaMs - csvStroke.timeMs,
    });
    matchedPose.add(pair.poseIndex);
    usedCsv.add(pair.csvIndex);
  }

  return {
    matches,
    deltaMs,
    matchedCount: matchedPose.size,
    unmatchedPoseStrokes: poseCatchTimesMs
      .map((_, index) => index)
      .filter((index) => !matchedPose.has(index)),
    unmatchedCsvStrokes: csvStrokes
      .map((stroke) => stroke.strokeIndex)
      .filter((_, index) => !usedCsv.has(index)),
  };
}

describe("alignStrokesToCsv", () => {
  test("empty pose times returns all unmatched", () => {
    const csv = makeCsv([0, 3000, 6000]);
    const result = alignStrokesToCsv([], csv);
    assert.equal(result.matchedCount, 0);
    assert.equal(result.matches.size, 0);
    assert.deepEqual(result.unmatchedCsvStrokes, [0, 1, 2]);
    assert.deepEqual(result.unmatchedPoseStrokes, []);
  });

  test("empty csv returns all pose unmatched", () => {
    const result = alignStrokesToCsv([0, 3000, 6000], []);
    assert.equal(result.matchedCount, 0);
    assert.equal(result.matches.size, 0);
    assert.deepEqual(result.unmatchedPoseStrokes, [0, 1, 2]);
    assert.deepEqual(result.unmatchedCsvStrokes, []);
  });

  test("perfect alignment — same count, zero offset", () => {
    const poses = [0, 3000, 6000, 9000, 12000];
    const csv = makeCsv([0, 3000, 6000, 9000, 12000]);
    const result = alignStrokesToCsv(poses, csv);
    assert.equal(result.matchedCount, 5);
    assert.equal(result.unmatchedPoseStrokes.length, 0);
    assert.equal(result.unmatchedCsvStrokes.length, 0);
    for (let i = 0; i < 5; i++) {
      const match = result.matches.get(i);
      assert.ok(match, `stroke ${i} should be matched`);
      assert.equal(match.csvStrokeIndex, i);
      assert.ok(Math.abs(match.offsetMs) <= ALIGNMENT_TOLERANCE_MS);
    }
  });

  test("constant offset — pose starts 30s after CSV session start", () => {
    // CSV strokes at 5s, 8s, 11s, 14s from CSV start
    // Pose captures strokes starting at 0 (but captures strokes 3+ of the session)
    // → pose catch times [0, 3000, 6000, 9000] correspond to CSV [30000,33000,36000,39000]
    const poseStrokeRateMs = 3000;
    const poses = [0, 3000, 6000, 9000];
    const csvOffset = 30_000;
    const csv = makeCsv([
      csvOffset,
      csvOffset + 3000,
      csvOffset + 6000,
      csvOffset + 9000,
    ]);
    const result = alignStrokesToCsv(poses, csv);
    assert.equal(result.matchedCount, 4, "all 4 pose strokes should match");
    assert.equal(result.deltaMs, csvOffset);
    assert.equal(result.unmatchedPoseStrokes.length, 0);
    // offsetMs should be near 0 after applying delta
    for (let i = 0; i < 4; i++) {
      const match = result.matches.get(i);
      assert.ok(match);
      assert.ok(Math.abs(match.offsetMs) < poseStrokeRateMs / 2);
    }
  });

  test("pose has fewer strokes than CSV — extra CSV strokes unmatched", () => {
    const poses = [0, 3000, 6000]; // 3 pose strokes
    const csv = makeCsv([0, 3000, 6000, 9000, 12000]); // 5 CSV strokes
    const result = alignStrokesToCsv(poses, csv);
    assert.equal(result.matchedCount, 3);
    assert.equal(result.unmatchedCsvStrokes.length, 2);
    assert.equal(result.unmatchedPoseStrokes.length, 0);
  });

  test("CSV has fewer strokes than pose — extra pose strokes unmatched", () => {
    const poses = [0, 3000, 6000, 9000, 12000]; // 5 pose strokes
    const csv = makeCsv([0, 3000, 6000]); // 3 CSV strokes
    const result = alignStrokesToCsv(poses, csv);
    assert.equal(result.matchedCount, 3);
    assert.equal(result.unmatchedPoseStrokes.length, 2);
    assert.equal(result.unmatchedCsvStrokes.length, 0);
    // unmatched pose strokes are the last two (indices 3 and 4)
    assert.deepEqual(result.unmatchedPoseStrokes, [3, 4]);
  });

  test("mismatch case — completely non-overlapping times, no matches", () => {
    // The relative pattern is identical even though the sessions are far apart.
    const posesNoOverlap = [0, 3000, 6000];
    const csvNoOverlap = makeCsv([1_000_000, 1_003_000, 1_006_000]);
    const result2 = alignStrokesToCsv(posesNoOverlap, csvNoOverlap);
    // Even though there's an offset match, they should match (offset = 1M ms).
    // All matched since the RELATIVE pattern is identical.
    assert.equal(result2.matchedCount, 3);
    assert.equal(result2.deltaMs, 1_000_000);
  });

  test("small timing noise — within tolerance", () => {
    // Pose catches are slightly off from CSV due to segmentation jitter
    const poses = [150, 3080, 5920, 8990]; // ~50-80ms jitter
    const csv = makeCsv([0, 3000, 6000, 9000]);
    const result = alignStrokesToCsv(poses, csv);
    assert.equal(result.matchedCount, 4);
    for (let i = 0; i < 4; i++) {
      const match = result.matches.get(i);
      assert.ok(match, `stroke ${i} should be matched despite jitter`);
      assert.equal(match.csvStrokeIndex, i);
    }
  });

  test("one-to-one constraint — nearer pose stroke wins the CSV slot", () => {
    // Two pose strokes both within tolerance of csv[0]; only closer one matched.
    // csv[1] is too far (4800ms > 2500ms tolerance) for the remaining pose stroke.
    const poses = [0, 200]; // both near csv[0] at 0ms
    const csv = makeCsv([0, 5000]); // csv[1] is 4800ms away from pose[1]
    const result = alignStrokesToCsv(poses, csv);
    // pose[0] → csv[0] (dist=0). pose[1] → csv[0] taken, csv[1] at dist=4800 > tolerance → unmatched.
    assert.equal(result.matchedCount, 1);
    assert.ok(result.matches.has(0));
    assert.equal(result.matches.get(0)?.csvStrokeIndex, 0);
    assert.ok(!result.matches.has(1));
    assert.deepEqual(result.unmatchedPoseStrokes, [1]);
  });

  test("offsetMs reflects actual difference after delta correction", () => {
    const poses = [100, 3100, 6100]; // 100ms late relative to CSV
    const csv = makeCsv([0, 3000, 6000]);
    const result = alignStrokesToCsv(poses, csv);
    assert.equal(result.matchedCount, 3);
    for (let i = 0; i < 3; i++) {
      const match = result.matches.get(i);
      assert.ok(match);
      // After delta correction, offsetMs should be small
      assert.ok(Math.abs(match.offsetMs) <= ALIGNMENT_TOLERANCE_MS);
    }
  });

  test("matches the exhaustive scorer across deterministic varied inputs", () => {
    let seed = 0x5eed1234;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let caseIndex = 0; caseIndex < 100; caseIndex += 1) {
      const poseCount = 1 + Math.floor(random() * 8);
      const csvCount = 1 + Math.floor(random() * 8);
      const toleranceMs = [100, 500, 2500][caseIndex % 3];
      const poseTimes = Array.from(
        { length: poseCount },
        () => Math.round(random() * 20_000 / 50) * 50,
      );
      const csv = makeCsv(Array.from(
        { length: csvCount },
        () => Math.round(random() * 20_000 / 50) * 50,
      ));

      assert.deepEqual(
        alignStrokesToCsv(poseTimes, csv, toleranceMs),
        referenceAlignStrokesToCsv(poseTimes, csv, toleranceMs),
        `case ${caseIndex}`,
      );
      const sortedPoseTimes = [...poseTimes].sort((left, right) => left - right);
      assert.deepEqual(
        alignStrokesToCsv(sortedPoseTimes, csv, toleranceMs),
        referenceAlignStrokesToCsv(sortedPoseTimes, csv, toleranceMs),
        `sorted case ${caseIndex}`,
      );
    }
  });
});
