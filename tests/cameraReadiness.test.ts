import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCameraReadiness,
  type CameraReadinessFrame,
} from "../src/lib/mocap/cameraReadiness";
import { QUALITY_FLAG } from "../src/lib/mocap/poseFrameStream";
import {
  POSE_LANDMARK_INDEX,
  type PosePoint,
} from "../src/lib/mocap/analysis/types";

function makeFrame(
  timestampMs: number,
  overrides: Partial<CameraReadinessFrame> = {},
): CameraReadinessFrame {
  return {
    timestampMs,
    trackedKeypointCount: 28,
    meanConfidence: 0.82,
    qualityFlags: 0,
    keypoints: makeSideViewKeypoints("right"),
    ...overrides,
  };
}

function makeSideViewKeypoints(side: "left" | "right"): PosePoint[] {
  const keypoints = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    confidence: 0.85,
  }));
  const names =
    side === "left"
      ? ["leftShoulder", "leftHip", "leftKnee", "leftAnkle"]
      : ["rightShoulder", "rightHip", "rightKnee", "rightAnkle"];
  const positions = [
    { x: 0.42, y: 0.25 },
    { x: 0.5, y: 0.48 },
    { x: 0.62, y: 0.66 },
    { x: 0.72, y: 0.82 },
  ];
  for (const [i, name] of names.entries()) {
    keypoints[POSE_LANDMARK_INDEX[name as keyof typeof POSE_LANDMARK_INDEX]] =
      {
        ...positions[i],
        confidence: 0.9,
      };
  }
  return keypoints;
}

test("camera readiness accepts sustained good pose quality and side-view coverage", () => {
  const frames = Array.from({ length: 6 }, (_, i) => makeFrame(i * 200));
  const result = evaluateCameraReadiness(frames, {
    capturePerspective: "side-right",
    nowMs: 1000,
  });

  assert.equal(result.ready, true);
  assert.equal(result.sustainedDegraded, false);
  assert.deepEqual(result.qualityFlags, ["ok"]);
  assert.equal(result.sideViewCoverage.ok, true);
  assert.ok(result.effectiveFps > 0);
});

test("camera readiness rejects borderline unstable history without marking sustained degradation", () => {
  const frames = [
    makeFrame(0),
    makeFrame(200),
    makeFrame(400, {
      trackedKeypointCount: 16,
      meanConfidence: 0.45,
      qualityFlags: QUALITY_FLAG.LOW_CONFIDENCE,
    }),
    makeFrame(600),
    makeFrame(800, {
      trackedKeypointCount: 15,
      meanConfidence: 0.42,
      qualityFlags: QUALITY_FLAG.LOW_CONFIDENCE,
    }),
    makeFrame(1000),
  ];

  const result = evaluateCameraReadiness(frames, {
    capturePerspective: "side-right",
    nowMs: 1000,
  });

  assert.equal(result.ready, false);
  assert.equal(result.sustainedDegraded, false);
  assert.ok(result.qualityFlags.includes("unstable-pose-quality"));
});

test("camera readiness flags failed side-view framing and sustained degradation", () => {
  const poorSideView = makeSideViewKeypoints("right").map((point, index) =>
    index === POSE_LANDMARK_INDEX.rightAnkle
      ? { ...point, x: 0.99, confidence: 0.2 }
      : point,
  );
  const frames = Array.from({ length: 12 }, (_, i) =>
    makeFrame(i * 200, {
      trackedKeypointCount: 12,
      meanConfidence: 0.35,
      qualityFlags: QUALITY_FLAG.OUT_OF_FRAME | QUALITY_FLAG.LOW_CONFIDENCE,
      keypoints: poorSideView,
    }),
  );

  const result = evaluateCameraReadiness(frames, {
    capturePerspective: "side-right",
    nowMs: 2200,
  });

  assert.equal(result.ready, false);
  assert.equal(result.sustainedDegraded, true);
  assert.equal(result.sideViewCoverage.ok, false);
  assert.ok(result.qualityFlags.includes("low-keypoint-coverage"));
  assert.ok(result.qualityFlags.includes("poor-side-view"));
  assert.ok(result.qualityFlags.includes("sustained-degradation"));
});
