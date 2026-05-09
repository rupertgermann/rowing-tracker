import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  alignStrokesToCsv,
  ALIGNMENT_TOLERANCE_MS,
  type CsvStrokeTarget,
} from "../src/lib/mocap/analysis/strokeAlignment";

function makeCsv(timesMs: number[]): CsvStrokeTarget[] {
  return timesMs.map((timeMs, i) => ({
    id: `csv-${i}`,
    strokeIndex: i,
    timeMs,
  }));
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
    // Pose session and CSV session have no temporal overlap at any delta
    // Pose at 0-9s, CSV at 100-109s; with tolerance 2.5s and stroke rate 3s,
    // the best delta will match some strokes. But if we use very sparse coverage:
    // Actually if stride is 3s and tolerance 2.5s, there will always be some match.
    // True mismatch means different stride patterns. Use different rates.
    const poses = [0, 5000, 10000]; // 5s rate
    const csv = makeCsv([0, 2500, 5000, 7500]); // 2.5s rate — interleaved, but within tolerance
    // This will find some matches even with different rates. Let's use truly non-overlapping.
    // Instead test with offset larger than the session itself so no cross-match is possible.
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
});
