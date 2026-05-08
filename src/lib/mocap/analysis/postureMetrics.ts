import {
  getPosePoint,
  landmarkSide,
  type Calibration,
  type PoseAnalysisFrame,
  type PoseFrameStream,
  type PoseLandmarkName,
  type PosePoint,
  type PostureMetrics,
  type Stroke,
} from "./types";

const MIN_CONFIDENCE = 0.25;

export function PostureMetricsCalculator(
  stream: PoseFrameStream,
  stroke: Stroke,
  calibration?: Calibration,
): PostureMetrics {
  void calibration;
  const catchFrame = frameAt(stream, stroke.catchFrameIndex);
  const finishFrame = frameAt(stream, stroke.finishFrameIndex);
  const backAngleAtCatchDeg = torsoBackAngleDeg(stream, catchFrame);
  const backAngleAtFinishDeg = torsoBackAngleDeg(stream, finishFrame);
  const laybackAngleDeg = Math.max(0, 90 - backAngleAtFinishDeg);

  const legSignal = legExtensionSignal(stream, stroke);
  const catchLeg = legSignal[0]?.value ?? 0;
  const finishLeg = legSignal[stroke.finishFrameIndex - stroke.catchFrameIndex]
    ?.value ?? catchLeg;
  const legRange = Math.max(0.0001, finishLeg - catchLeg);

  const legExtensionStartFrameIndex = firstSignalFrameAtLeast(
    legSignal,
    catchLeg + legRange * 0.2,
  );
  const legExtensionCompleteFrameIndex = firstSignalFrameAtLeast(
    legSignal,
    catchLeg + legRange * 0.8,
  );
  const torsoOpenFrameIndex = firstTorsoChangeFrame(
    stream,
    stroke,
    backAngleAtCatchDeg,
  );
  const armBendOnsetFrameIndex = firstArmBendFrame(stream, stroke);

  return {
    strokeIndex: stroke.strokeIndex,
    segmentationSource: stroke.segmentationSource,
    backAngleAtCatchDeg,
    backAngleAtFinishDeg,
    laybackAngleDeg,
    hipKneeOpeningOffsetFrames:
      legExtensionStartFrameIndex === null || torsoOpenFrameIndex === null
        ? null
        : torsoOpenFrameIndex - legExtensionStartFrameIndex,
    armBendOnsetFrameIndex,
    legExtensionCompleteFrameIndex,
    armBendBeforeLegsCompleteFrames:
      armBendOnsetFrameIndex === null || legExtensionCompleteFrameIndex === null
        ? null
        : legExtensionCompleteFrameIndex - armBendOnsetFrameIndex,
    recoveryDriveRatio: recoveryDriveRatio(stroke),
    leftRightAsymmetry:
      stream.capturePerspective === "sidecar-3d"
        ? { available: false, reason: "insufficient-tracking" }
        : { available: false, reason: "requires-sidecar-3d" },
    shinVerticalAtCatchDeg:
      stream.capturePerspective === "sidecar-3d"
        ? { available: false, reason: "insufficient-tracking" }
        : { available: false, reason: "requires-sidecar-3d" },
    kneeTrackDeviation:
      stream.capturePerspective === "sidecar-3d"
        ? { available: false, reason: "insufficient-tracking" }
        : { available: false, reason: "requires-sidecar-3d" },
  };
}

function frameAt(stream: PoseFrameStream, frameIndex: number): PoseAnalysisFrame {
  const frame = stream.frames[frameIndex];
  if (!frame) {
    throw new Error(`Frame ${frameIndex} is outside the PoseFrameStream`);
  }
  return frame;
}

function sideNames(stream: PoseFrameStream): {
  shoulder: PoseLandmarkName;
  elbow: PoseLandmarkName;
  wrist: PoseLandmarkName;
  hip: PoseLandmarkName;
  knee: PoseLandmarkName;
} {
  const side = landmarkSide(stream.capturePerspective);
  return {
    shoulder: `${side}Shoulder` as PoseLandmarkName,
    elbow: `${side}Elbow` as PoseLandmarkName,
    wrist: `${side}Wrist` as PoseLandmarkName,
    hip: `${side}Hip` as PoseLandmarkName,
    knee: `${side}Knee` as PoseLandmarkName,
  };
}

function requiredPoint(
  frame: PoseAnalysisFrame,
  name: PoseLandmarkName,
): PosePoint {
  const point = getPosePoint(frame, name);
  if (!point || point.confidence < MIN_CONFIDENCE) {
    throw new Error(`Missing tracked landmark ${name}`);
  }
  return point;
}

function torsoBackAngleDeg(
  stream: PoseFrameStream,
  frame: PoseAnalysisFrame,
): number {
  const names = sideNames(stream);
  const hip = requiredPoint(frame, names.hip);
  const shoulder = requiredPoint(frame, names.shoulder);
  const dx = shoulder.x - hip.x;
  const dyUp = hip.y - shoulder.y;
  const raw = radiansToDegrees(Math.atan2(dyUp, dx));
  const normalized = raw < 0 ? raw + 180 : raw;
  return normalized > 90 ? 180 - normalized : normalized;
}

function legExtensionSignal(
  stream: PoseFrameStream,
  stroke: Stroke,
): Array<{ frameIndex: number; value: number }> {
  const names = sideNames(stream);
  const signal: Array<{ frameIndex: number; value: number }> = [];
  for (
    let frameIndex = stroke.catchFrameIndex;
    frameIndex <= stroke.finishFrameIndex;
    frameIndex++
  ) {
    const frame = frameAt(stream, frameIndex);
    const hip = requiredPoint(frame, names.hip);
    const knee = requiredPoint(frame, names.knee);
    signal.push({
      frameIndex,
      value: Math.hypot(hip.x - knee.x, hip.y - knee.y),
    });
  }
  return signal;
}

function firstSignalFrameAtLeast(
  signal: Array<{ frameIndex: number; value: number }>,
  threshold: number,
): number | null {
  for (const point of signal) {
    if (point.value >= threshold) return point.frameIndex;
  }
  return null;
}

function firstTorsoChangeFrame(
  stream: PoseFrameStream,
  stroke: Stroke,
  catchAngleDeg: number,
): number | null {
  for (
    let frameIndex = stroke.catchFrameIndex + 1;
    frameIndex <= stroke.finishFrameIndex;
    frameIndex++
  ) {
    const frame = frameAt(stream, frameIndex);
    if (Math.abs(torsoBackAngleDeg(stream, frame) - catchAngleDeg) >= 5) {
      return frameIndex;
    }
  }
  return null;
}

function firstArmBendFrame(
  stream: PoseFrameStream,
  stroke: Stroke,
): number | null {
  const initialAngle = elbowAngleDeg(stream, frameAt(stream, stroke.catchFrameIndex));
  const threshold = Math.min(160, initialAngle - 15);
  for (
    let frameIndex = stroke.catchFrameIndex + 1;
    frameIndex <= stroke.finishFrameIndex;
    frameIndex++
  ) {
    const angle = elbowAngleDeg(stream, frameAt(stream, frameIndex));
    if (angle <= threshold) return frameIndex;
  }
  return null;
}

function elbowAngleDeg(
  stream: PoseFrameStream,
  frame: PoseAnalysisFrame,
): number {
  const names = sideNames(stream);
  const shoulder = requiredPoint(frame, names.shoulder);
  const elbow = requiredPoint(frame, names.elbow);
  const wrist = requiredPoint(frame, names.wrist);
  return angleAtPointDeg(shoulder, elbow, wrist);
}

function angleAtPointDeg(a: PosePoint, vertex: PosePoint, b: PosePoint): number {
  const ax = a.x - vertex.x;
  const ay = a.y - vertex.y;
  const bx = b.x - vertex.x;
  const by = b.y - vertex.y;
  const denom = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (denom === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / denom));
  return radiansToDegrees(Math.acos(cos));
}

function recoveryDriveRatio(stroke: Stroke): number {
  const driveFrames = Math.max(
    1,
    stroke.finishFrameIndex - stroke.driveStartFrameIndex,
  );
  const recoveryFrames = Math.max(
    1,
    stroke.nextCatchFrameIndex - stroke.recoveryStartFrameIndex,
  );
  return recoveryFrames / driveFrames;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
