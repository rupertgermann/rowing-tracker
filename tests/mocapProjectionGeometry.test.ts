import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PostureMetricsCalculator,
  type PoseFrameStream,
  type Stroke,
} from "../src/lib/mocap/analysis";

const stroke: Stroke = {
  strokeIndex: 0,
  segmentationSource: "pose-segmented",
  catchFrameIndex: 0,
  driveStartFrameIndex: 0,
  finishFrameIndex: 1,
  recoveryStartFrameIndex: 1,
  nextCatchFrameIndex: 2,
  confidence: 1,
};

function knownAngleStream(): PoseFrameStream {
  return {
    fps: 30,
    capturePerspective: "sidecar-3d",
    coordinateSpace: "world-mm-3d",
    frames: [
      {
        timestampMs: 0,
        keypoints: {
          rightHip: { x: 0, y: 500, z: 0, confidence: 1 },
          rightShoulder: { x: 0, y: 300, z: 200, confidence: 1 },
          rightElbow: { x: 0, y: 300, z: 400, confidence: 1 },
          rightWrist: { x: 0, y: 300, z: 600, confidence: 1 },
          rightKnee: { x: 0, y: 500, z: 100, confidence: 1 },
        },
      },
      {
        timestampMs: 1000 / 30,
        keypoints: {
          rightHip: { x: 0, y: 500, z: 0, confidence: 1 },
          rightShoulder: { x: 0, y: 200, z: 0, confidence: 1 },
          rightElbow: { x: 0, y: 200, z: 200, confidence: 1 },
          rightWrist: { x: 0, y: 400, z: 200, confidence: 1 },
          rightKnee: { x: 0, y: 500, z: 300, confidence: 1 },
        },
      },
    ],
  };
}

test("sidecar posture preserves known angles with unequal bounds and unrelated extreme frames", () => {
  const stream = knownAngleStream();
  for (const frames of [stream.frames, [...stream.frames, {
    timestampMs: 2000 / 30,
    keypoints: { rightHip: { x: 0, y: -10000, z: 50000, confidence: 1 } },
  }]]) {
    const metrics = PostureMetricsCalculator({ ...stream, frames }, stroke);
    assert.ok(Math.abs(metrics.backAngleAtCatchDeg - 45) < 1e-9);
    assert.ok(Math.abs(metrics.backAngleAtFinishDeg - 90) < 1e-9);
    assert.ok(Math.abs(metrics.laybackAngleDeg) < 1e-9);
    assert.equal(metrics.armBendOnsetFrameIndex, 1);
  }
});

test("projection retains low-confidence rejection and unavailable metric states", () => {
  const stream = knownAngleStream();
  const metrics = PostureMetricsCalculator(stream, stroke);
  for (const metric of [metrics.leftRightAsymmetry, metrics.shinVerticalAtCatchDeg, metrics.kneeTrackDeviation]) {
    assert.deepEqual(metric, { available: false, reason: "insufficient-tracking" });
  }
  assert.equal(metrics.sidecar3D?.lateralShoulderSymmetryMm, undefined);

  const browserMetrics = PostureMetricsCalculator({
    ...stream,
    capturePerspective: "side-right",
    coordinateSpace: "normalized-2d",
  }, stroke);
  assert.deepEqual(browserMetrics.leftRightAsymmetry, {
    available: false, reason: "requires-sidecar-3d",
  });
  assert.equal(browserMetrics.sidecar3D, undefined);

  const untracked: PoseFrameStream = {
    ...stream,
    frames: stream.frames.map((frame) => ({
      ...frame,
      keypoints: {
        ...frame.keypoints,
        rightShoulder: { x: 0, y: 300, z: 200, confidence: 0.1 },
      },
    })),
  };
  assert.throws(() => PostureMetricsCalculator(untracked, stroke), /Missing tracked landmark rightShoulder/);
});
