export type CapturePerspective = "side-left" | "side-right" | "sidecar-3d";

export type StrokeSegmentationSource = "pose-segmented" | "csv-aligned";

export type PostureFaultType =
  | "rounded_back_at_catch"
  | "early_arm_bend"
  | "back_opens_before_legs_drive"
  | "excessive_layback"
  | "slow_recovery_ratio";

export type FaultSeverity = "info" | "warning" | "critical";

export type PoseLandmarkName =
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftWrist"
  | "rightWrist"
  | "leftHip"
  | "rightHip"
  | "leftKnee"
  | "rightKnee"
  | "leftAnkle"
  | "rightAnkle";

export const POSE_LANDMARK_INDEX: Record<PoseLandmarkName, number> = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

export interface PosePoint {
  x: number;
  y: number;
  confidence: number;
}

export type PoseKeypoints =
  | readonly PosePoint[]
  | Partial<Record<PoseLandmarkName, PosePoint>>;

export interface PoseAnalysisFrame {
  timestampMs: number;
  keypoints: PoseKeypoints;
  qualityFlags?: number;
}

export interface PoseFrameStream {
  fps: number;
  capturePerspective: CapturePerspective;
  frames: readonly PoseAnalysisFrame[];
}

export interface Stroke {
  strokeIndex: number;
  segmentationSource: StrokeSegmentationSource;
  catchFrameIndex: number;
  driveStartFrameIndex: number;
  finishFrameIndex: number;
  recoveryStartFrameIndex: number;
  nextCatchFrameIndex: number;
  confidence: number;
}

export interface Calibration {
  capturePerspective: CapturePerspective;
  catchFrame?: PoseAnalysisFrame;
  finishFrame?: PoseAnalysisFrame;
}

export interface UnavailableMetric {
  available: false;
  reason: "requires-sidecar-3d" | "insufficient-tracking";
}

export interface AvailableMetric<T> {
  available: true;
  value: T;
}

export type MaybeMetric<T> = AvailableMetric<T> | UnavailableMetric;

export interface PostureMetrics {
  strokeIndex: number;
  segmentationSource: StrokeSegmentationSource;
  backAngleAtCatchDeg: number;
  backAngleAtFinishDeg: number;
  laybackAngleDeg: number;
  hipKneeOpeningOffsetFrames: number | null;
  armBendOnsetFrameIndex: number | null;
  legExtensionCompleteFrameIndex: number | null;
  armBendBeforeLegsCompleteFrames: number | null;
  recoveryDriveRatio: number;
  leftRightAsymmetry: MaybeMetric<number>;
  shinVerticalAtCatchDeg: MaybeMetric<number>;
  kneeTrackDeviation: MaybeMetric<number>;
}

export interface PostureFault {
  strokeIndex: number;
  faultType: PostureFaultType;
  severity: FaultSeverity;
  phase: "catch" | "drive" | "finish" | "recovery";
  evidence: {
    metric: keyof PostureMetrics | "armBendBeforeLegsCompleteFrames";
    value: number;
    threshold: number;
    frameIndex?: number;
  };
}

export function getPosePoint(
  frame: PoseAnalysisFrame,
  name: PoseLandmarkName,
): PosePoint | null {
  const keypoints = frame.keypoints;
  if (isPosePointArray(keypoints)) {
    const point = keypoints[POSE_LANDMARK_INDEX[name]];
    return point?.confidence > 0 ? point : null;
  }
  const point = keypoints[name];
  return point?.confidence && point.confidence > 0 ? point : null;
}

function isPosePointArray(keypoints: PoseKeypoints): keypoints is readonly PosePoint[] {
  return Array.isArray(keypoints);
}

export function landmarkSide(
  perspective: CapturePerspective,
): "left" | "right" {
  return perspective === "side-left" ? "left" : "right";
}
