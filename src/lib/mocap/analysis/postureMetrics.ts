import {
  getPosePoint,
  landmarkSide,
  type Calibration,
  type PoseAnalysisFrame,
  type PoseFrameStream,
  type PoseLandmarkName,
  type PosePoint,
  type PostureMetrics,
  type Sidecar3DMetrics,
  type Stroke,
} from "./types";
import { toProjectedStream } from "./projection";

const MIN_CONFIDENCE = 0.25;

export function PostureMetricsCalculator(
  stream: PoseFrameStream,
  stroke: Stroke,
  calibration?: Calibration,
): PostureMetrics {
  void calibration;
  const projectedStream = toProjectedStream(stream);
  const catchFrame = frameAt(projectedStream, stroke.catchFrameIndex);
  const finishFrame = frameAt(projectedStream, stroke.finishFrameIndex);
  const backAngleAtCatchDeg = torsoBackAngleDeg(projectedStream, catchFrame);
  const backAngleAtFinishDeg = torsoBackAngleDeg(projectedStream, finishFrame);
  const laybackAngleDeg = Math.max(0, 90 - backAngleAtFinishDeg);

  const legSignal = legExtensionSignal(projectedStream, stroke);
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
    projectedStream,
    stroke,
    backAngleAtCatchDeg,
  );
  const armBendOnsetFrameIndex = firstArmBendFrame(projectedStream, stroke);

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
    sidecar3D:
      stream.capturePerspective === "sidecar-3d"
        ? computeSidecar3DMetrics(stream, stroke)
        : undefined,
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

// --- Sidecar-3D specific metrics ---

function computeSidecar3DMetrics(
  stream: PoseFrameStream,
  stroke: Stroke,
): Sidecar3DMetrics {
  const metrics: Sidecar3DMetrics = {};
  const frames = stream.frames.slice(stroke.catchFrameIndex, stroke.finishFrameIndex + 1);
  if (frames.length === 0) return metrics;

  // lateralShoulderSymmetryMm: mean absolute x-displacement left vs right shoulder
  const shoulderDeltas: number[] = [];
  const hipDeltas: number[] = [];
  for (const frame of frames) {
    const ls = getPosePoint(frame, "leftShoulder");
    const rs = getPosePoint(frame, "rightShoulder");
    const lh = getPosePoint(frame, "leftHip");
    const rh = getPosePoint(frame, "rightHip");
    if (ls && rs && ls.confidence >= MIN_CONFIDENCE && rs.confidence >= MIN_CONFIDENCE) {
      shoulderDeltas.push(Math.abs(ls.x - rs.x));
    }
    if (lh && rh && lh.confidence >= MIN_CONFIDENCE && rh.confidence >= MIN_CONFIDENCE) {
      hipDeltas.push(Math.abs(lh.x - rh.x));
    }
  }
  if (shoulderDeltas.length > 0) {
    metrics.lateralShoulderSymmetryMm =
      shoulderDeltas.reduce((a, b) => a + b, 0) / shoulderDeltas.length;
  }
  if (hipDeltas.length > 0) {
    metrics.lateralHipSymmetryMm =
      hipDeltas.reduce((a, b) => a + b, 0) / hipDeltas.length;
  }

  // knee track deviation: peak |knee.x - ankle.x| during drive
  let leftKneePeak = 0;
  let rightKneePeak = 0;
  for (const frame of frames) {
    const lk = getPosePoint(frame, "leftKnee");
    const la = getPosePoint(frame, "leftAnkle");
    const rk = getPosePoint(frame, "rightKnee");
    const ra = getPosePoint(frame, "rightAnkle");
    if (lk && la && lk.confidence >= MIN_CONFIDENCE && la.confidence >= MIN_CONFIDENCE) {
      leftKneePeak = Math.max(leftKneePeak, Math.abs(lk.x - la.x));
    }
    if (rk && ra && rk.confidence >= MIN_CONFIDENCE && ra.confidence >= MIN_CONFIDENCE) {
      rightKneePeak = Math.max(rightKneePeak, Math.abs(rk.x - ra.x));
    }
  }
  if (leftKneePeak > 0) metrics.leftKneeTrackDeviationMm = leftKneePeak;
  if (rightKneePeak > 0) metrics.rightKneeTrackDeviationMm = rightKneePeak;

  // nearShinAngleDeg: shin angle from nearer (lower |z|) ankle/knee pair at catch
  const catchFrame = stream.frames[stroke.catchFrameIndex];
  if (catchFrame) {
    const lk = getPosePoint(catchFrame, "leftKnee");
    const la = getPosePoint(catchFrame, "leftAnkle");
    const rk = getPosePoint(catchFrame, "rightKnee");
    const ra = getPosePoint(catchFrame, "rightAnkle");
    const leftZ = lk?.z ?? Infinity;
    const rightZ = rk?.z ?? Infinity;
    const [knee, ankle] = Math.abs(leftZ) <= Math.abs(rightZ)
      ? [lk, la]
      : [rk, ra];
    if (
      knee && ankle &&
      knee.confidence >= MIN_CONFIDENCE && ankle.confidence >= MIN_CONFIDENCE
    ) {
      const dx = knee.x - ankle.x;
      const dy = knee.y - ankle.y;
      metrics.nearShinAngleDeg = radiansToDegrees(Math.atan2(Math.abs(dx), Math.abs(dy)));
    }
  }

  return metrics;
}
