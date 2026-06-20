import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReplayComparisonOptions,
  countFaultsForStroke,
} from "../src/lib/mocap/replayComparison.js";

const strokes = [0, 1, 2, 3].map((strokeIndex) => ({ strokeIndex }));

test("replay comparison defaults to the heaviest fault stroke and a clean comparison stroke", () => {
  const result = buildReplayComparisonOptions(strokes, [
    { strokeIndex: 0, severity: "warning" },
    { strokeIndex: 2, severity: "info" },
    { strokeIndex: 2, severity: "critical" },
  ]);

  assert.equal(result.defaultFaultStrokeIndex, 2);
  assert.equal(result.defaultComparisonStrokeIndex, 1);
  assert.deepEqual(
    result.faultStrokeOptions.map((option) => option.strokeIndex),
    [2, 0],
  );
  assert.deepEqual(result.cleanStrokeOptions, [1, 3]);
});

test("replay comparison excludes the selected fault stroke from clean candidates", () => {
  const result = buildReplayComparisonOptions(strokes, [
    { strokeIndex: 1, severity: "critical" },
  ], 0);

  assert.equal(result.defaultFaultStrokeIndex, 1);
  assert.equal(result.defaultComparisonStrokeIndex, 2);
});

test("replay comparison reports no clean comparison when every stroke has a fault", () => {
  const result = buildReplayComparisonOptions(strokes, [
    { strokeIndex: 0, severity: "info" },
    { strokeIndex: 1, severity: "warning" },
    { strokeIndex: 2, severity: "critical" },
    { strokeIndex: 3, severity: "info" },
  ]);

  assert.deepEqual(result.cleanStrokeOptions, []);
  assert.equal(result.defaultComparisonStrokeIndex, null);
});

test("replay comparison ignores faults for strokes outside the session", () => {
  const result = buildReplayComparisonOptions(strokes, [
    { strokeIndex: 99, severity: "critical" },
  ]);

  assert.deepEqual(result.faultStrokeOptions, []);
  assert.deepEqual(result.cleanStrokeOptions, [0, 1, 2, 3]);
  assert.equal(countFaultsForStroke([{ strokeIndex: 2, severity: "warning" }], 2), 1);
});
