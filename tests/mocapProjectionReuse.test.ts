import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzePoseFrameStream,
  PostureMetricsCalculator,
  PostureFaultDetector,
  StrokePhaseSegmenter,
  type PoseFrameStream,
  type PosePoint,
} from "../src/lib/mocap/analysis";

function recording(cycles: number) {
  let projectionReads = 0;
  const frames = Array.from({ length: cycles * 90 + 1 }, (_, index) => {
    const depth = 100 + 400 * (1 - Math.cos(2 * Math.PI * (index % 90) / 90));
    const keypoints: PosePoint[] = Array.from({ length: 33 }, () => ({
      x: 0, y: 0, z: 0, confidence: 0,
    }));
    // Untracked, unused landmark: only projection reads its depth, twice per pass.
    keypoints[0] = { x: 0, y: 0, get z() { projectionReads++; return 0; }, confidence: 0 };
    keypoints[12] = { x: 100, y: 300, z: 200, confidence: 1 };
    keypoints[14] = { x: 100, y: 300, z: 400, confidence: 1 };
    keypoints[16] = { x: 100, y: 300, z: 600, confidence: 1 };
    keypoints[24] = { x: 100, y: 500, z: 0, confidence: 1 };
    keypoints[26] = { x: 100, y: 500, z: depth, confidence: 1 };
    keypoints[28] = { x: 80, y: 700, z: depth, confidence: 1 };
    keypoints[11] = { x: -100, y: 300, z: 200, confidence: 1 };
    keypoints[23] = { x: -100, y: 500, z: 0, confidence: 1 };
    for (const point of keypoints) Object.freeze(point);
    return Object.freeze({ timestampMs: index * 1000 / 30, keypoints: Object.freeze(keypoints) });
  });
  const stream: PoseFrameStream = Object.freeze({
    fps: 30, capturePerspective: "sidecar-3d", coordinateSpace: "world-mm-3d", frames: Object.freeze(frames),
  });
  return { stream, reads: () => projectionReads };
}

test("post-session metrics and faults equal independent per-stroke analysis with world units intact", () => {
  const { stream } = recording(2);
  const result = analyzePoseFrameStream(stream);
  const strokes = StrokePhaseSegmenter(stream);
  assert.equal(strokes.length, 2);
  const expectedMetrics = strokes.map((stroke) => PostureMetricsCalculator(stream, stroke));
  assert.deepEqual(result.metrics.map((row) => ({ ...row.metricsJson, strokeIndex: row.strokeIndex, segmentationSource: row.segmentationSource })), expectedMetrics);
  assert.deepEqual(result.faults, expectedMetrics.flatMap((metrics) => PostureFaultDetector(metrics)).map((fault) => ({
    strokeIndex: fault.strokeIndex, faultType: fault.faultType, severity: fault.severity,
    phase: fault.phase, evidenceJson: fault.evidence,
  })));
  for (const row of result.metrics) {
    assert.equal(row.metricsJson.sidecar3D?.lateralShoulderSymmetryMm, 200);
    assert.equal(row.metricsJson.sidecar3D?.lateralHipSymmetryMm, 200);
    assert.equal(row.metricsJson.sidecar3D?.rightKneeTrackDeviationMm, 20);
    assert.ok(Math.abs(row.metricsJson.backAngleAtCatchDeg - 45) < 1e-9);
  }
});

test("post-session projection work stays linear in recording frames across strokes", () => {
  const { stream, reads } = recording(600);
  const result = analyzePoseFrameStream(stream);
  assert.equal(result.metrics.length, 600);
  assert.equal(reads(), stream.frames.length * 2);

  const reference = analyzePoseFrameStream(recording(1).stream);
  const referenceMetric = reference.metrics[0].metricsJson;
  const referenceLegComplete = referenceMetric.legExtensionCompleteFrameIndex;
  assert.ok(referenceLegComplete !== null);
  for (const row of result.metrics) {
    const offset = row.strokeIndex * 90;
    assert.deepEqual(row.metricsJson, {
      ...referenceMetric,
      legExtensionCompleteFrameIndex: referenceLegComplete + offset,
    });
  }
  assert.ok(reference.faults.length > 0);
  assert.deepEqual(result.faults, result.metrics.flatMap(({ strokeIndex }) =>
    reference.faults.map((fault) => ({ ...fault, strokeIndex })),
  ));
});
