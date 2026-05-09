import { QUALITY_FLAG } from "./poseFrameStream";
import {
  POSE_LANDMARK_INDEX,
  landmarkSide,
  type CapturePerspective,
  type PoseLandmarkName,
  type PosePoint,
} from "./analysis/types";

const MIN_TRACKED_KEYPOINTS = 20;
const MIN_MEAN_CONFIDENCE = 0.5;
const MIN_GOOD_FRAME_RATIO = 0.7;
const MIN_READINESS_FRAMES = 5;
const READINESS_WINDOW_MS = 1200;
const DEGRADATION_WINDOW_MS = 2000;
const MIN_SIDE_LANDMARK_CONFIDENCE = 0.4;
const FRAME_EDGE_MARGIN = 0.03;
const MIN_SIDE_BODY_HEIGHT = 0.2;
const MIN_SIDE_BODY_WIDTH = 0.12;

const SIDE_LANDMARKS = {
  left: ["leftShoulder", "leftHip", "leftKnee", "leftAnkle"],
  right: ["rightShoulder", "rightHip", "rightKnee", "rightAnkle"],
} as const satisfies Record<"left" | "right", readonly PoseLandmarkName[]>;

export type CameraReadinessFrame = {
  timestampMs: number;
  trackedKeypointCount: number;
  meanConfidence: number;
  qualityFlags: number;
  keypoints?: readonly PosePoint[];
};

export type CameraReadinessResult = {
  ready: boolean;
  sustainedDegraded: boolean;
  effectiveFps: number;
  modelConfidence: number;
  trackedKeypointCount: number;
  qualityFlags: string[];
  message: string;
  goodFrameRatio: number;
  sideViewCoverage: {
    ok: boolean;
    visibleSideLandmarks: number;
    requiredSideLandmarks: number;
    bodyHeight: number;
    bodyWidth: number;
  };
};

export function evaluateCameraReadiness(
  frames: readonly CameraReadinessFrame[],
  opts: {
    capturePerspective: CapturePerspective;
    nowMs?: number;
    readinessWindowMs?: number;
    degradationWindowMs?: number;
  },
): CameraReadinessResult {
  const nowMs = opts.nowMs ?? frames.at(-1)?.timestampMs ?? 0;
  const readinessWindowMs = opts.readinessWindowMs ?? READINESS_WINDOW_MS;
  const degradationWindowMs = opts.degradationWindowMs ?? DEGRADATION_WINDOW_MS;
  const recent = frames.filter(
    (frame) => frame.timestampMs >= nowMs - readinessWindowMs,
  );
  const degradedWindow = frames.filter(
    (frame) => frame.timestampMs >= nowMs - degradationWindowMs,
  );
  const latest = recent.at(-1) ?? frames.at(-1);
  const sideViewCoverage = latest
    ? evaluateSideViewCoverage(latest.keypoints, opts.capturePerspective)
    : emptySideViewCoverage();

  if (!latest || recent.length === 0) {
    return {
      ready: false,
      sustainedDegraded: false,
      effectiveFps: 0,
      modelConfidence: 0,
      trackedKeypointCount: 0,
      qualityFlags: ["no-pose"],
      message: "Waiting for pose tracking.",
      goodFrameRatio: 0,
      sideViewCoverage,
    };
  }

  const goodFrames = recent.filter((frame) =>
    isGoodReadinessFrame(frame, opts.capturePerspective),
  );
  const degradedFrames = degradedWindow.filter(
    (frame) => !isGoodReadinessFrame(frame, opts.capturePerspective),
  );
  const goodFrameRatio = goodFrames.length / recent.length;
  const sustainedDegraded =
    degradedWindow.length >= MIN_READINESS_FRAMES &&
    degradedFrames.length / degradedWindow.length >= MIN_GOOD_FRAME_RATIO &&
    windowDurationMs(degradedWindow) >= degradationWindowMs * 0.75;

  const flags = new Set<string>();
  collectFrameFlags(latest, sideViewCoverage, flags);
  if (recent.length < MIN_READINESS_FRAMES) flags.add("warming-up");
  if (goodFrameRatio < MIN_GOOD_FRAME_RATIO) flags.add("unstable-pose-quality");
  if (sustainedDegraded) flags.add("sustained-degradation");

  const ready =
    recent.length >= MIN_READINESS_FRAMES &&
    goodFrameRatio >= MIN_GOOD_FRAME_RATIO &&
    isGoodReadinessFrame(latest, opts.capturePerspective);

  return {
    ready,
    sustainedDegraded,
    effectiveFps: effectiveFps(recent),
    modelConfidence: average(recent.map((frame) => frame.meanConfidence)),
    trackedKeypointCount: Math.round(
      average(recent.map((frame) => frame.trackedKeypointCount)),
    ),
    qualityFlags: flags.size > 0 ? [...flags] : ["ok"],
    message: ready
      ? "Camera ready."
      : "Keep the rower fully in the side view until tracking stabilizes.",
    goodFrameRatio,
    sideViewCoverage,
  };
}

export function cameraQualityFlagLabel(flags: readonly string[]): string {
  const readable: Record<string, string> = {
    ok: "OK",
    "no-pose": "No pose",
    "low-keypoint-coverage": "Low keypoint coverage",
    "low-confidence": "Low confidence",
    "out-of-frame": "Out of frame",
    "poor-side-view": "Poor side view",
    "warming-up": "Warming up",
    "unstable-pose-quality": "Unstable pose quality",
    "sustained-degradation": "Sustained degradation",
  };
  return flags.map((flag) => readable[flag] ?? flag).join(", ");
}

function isGoodReadinessFrame(
  frame: CameraReadinessFrame,
  capturePerspective: CapturePerspective,
): boolean {
  return (
    frame.trackedKeypointCount >= MIN_TRACKED_KEYPOINTS &&
    frame.meanConfidence >= MIN_MEAN_CONFIDENCE &&
    (frame.qualityFlags &
      (QUALITY_FLAG.OUT_OF_FRAME | QUALITY_FLAG.LOW_CONFIDENCE)) ===
      0 &&
    evaluateSideViewCoverage(frame.keypoints, capturePerspective).ok
  );
}

function collectFrameFlags(
  frame: CameraReadinessFrame,
  sideViewCoverage: CameraReadinessResult["sideViewCoverage"],
  flags: Set<string>,
): void {
  if (frame.trackedKeypointCount === 0 && frame.meanConfidence === 0) {
    flags.add("no-pose");
  }
  if (frame.trackedKeypointCount < MIN_TRACKED_KEYPOINTS) {
    flags.add("low-keypoint-coverage");
  }
  if (
    frame.meanConfidence < MIN_MEAN_CONFIDENCE ||
    (frame.qualityFlags & QUALITY_FLAG.LOW_CONFIDENCE) !== 0
  ) {
    flags.add("low-confidence");
  }
  if ((frame.qualityFlags & QUALITY_FLAG.OUT_OF_FRAME) !== 0) {
    flags.add("out-of-frame");
  }
  if (!sideViewCoverage.ok) {
    flags.add("poor-side-view");
  }
}

function evaluateSideViewCoverage(
  keypoints: readonly PosePoint[] | undefined,
  capturePerspective: CapturePerspective,
): CameraReadinessResult["sideViewCoverage"] {
  if (!keypoints) return emptySideViewCoverage();

  const side = landmarkSide(capturePerspective);
  const points = SIDE_LANDMARKS[side]
    .map((name) => keypoints[POSE_LANDMARK_INDEX[name]])
    .filter(isVisibleSidePoint);
  if (points.length === 0) return emptySideViewCoverage();

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const bodyHeight = Math.max(...ys) - Math.min(...ys);
  const bodyWidth = Math.max(...xs) - Math.min(...xs);
  return {
    ok:
      points.length === SIDE_LANDMARKS[side].length &&
      bodyHeight >= MIN_SIDE_BODY_HEIGHT &&
      bodyWidth >= MIN_SIDE_BODY_WIDTH,
    visibleSideLandmarks: points.length,
    requiredSideLandmarks: SIDE_LANDMARKS[side].length,
    bodyHeight,
    bodyWidth,
  };
}

function isVisibleSidePoint(point: PosePoint | undefined): point is PosePoint {
  return (
    Boolean(point) &&
    point!.confidence >= MIN_SIDE_LANDMARK_CONFIDENCE &&
    point!.x >= FRAME_EDGE_MARGIN &&
    point!.x <= 1 - FRAME_EDGE_MARGIN &&
    point!.y >= FRAME_EDGE_MARGIN &&
    point!.y <= 1 - FRAME_EDGE_MARGIN
  );
}

function emptySideViewCoverage(): CameraReadinessResult["sideViewCoverage"] {
  return {
    ok: false,
    visibleSideLandmarks: 0,
    requiredSideLandmarks: 4,
    bodyHeight: 0,
    bodyWidth: 0,
  };
}

function effectiveFps(frames: readonly CameraReadinessFrame[]): number {
  if (frames.length < 2) return 0;
  const durationSec = windowDurationMs(frames) / 1000;
  return durationSec > 0 ? (frames.length - 1) / durationSec : 0;
}

function windowDurationMs(frames: readonly CameraReadinessFrame[]): number {
  if (frames.length < 2) return 0;
  return frames[frames.length - 1].timestampMs - frames[0].timestampMs;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
