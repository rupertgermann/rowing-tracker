import { PostureFaultDetector } from "./postureFaultDetector";
import { PostureMetricsCalculator } from "./postureMetrics";
import { StrokePhaseSegmenter } from "./strokePhaseSegmenter";
import type {
  Calibration,
  PoseFrameStream,
  PostureFault,
  PostureMetrics,
  Stroke,
} from "./types";
import { postureThresholdsV1, type PostureThresholdBands } from "./postureThresholds";

export interface DerivedStrokePostureMetric {
  strokeIndex: number;
  phaseBoundariesJson: StrokePhaseBoundariesJson;
  metricsJson: PostureMetricsJson;
  segmentationSource: string;
}

export interface DerivedPostureFault {
  strokeIndex: number;
  faultType: string;
  severity: string;
  phase: string;
  evidenceJson: PostureFault["evidence"];
}

export interface PostSessionAnalysisResult {
  metrics: DerivedStrokePostureMetric[];
  faults: DerivedPostureFault[];
}

export interface StrokePhaseBoundariesJson {
  catchFrameIndex: number;
  driveStartFrameIndex: number;
  finishFrameIndex: number;
  recoveryStartFrameIndex: number;
  nextCatchFrameIndex: number;
  confidence: number;
}

export type PostureMetricsJson = Omit<
  PostureMetrics,
  "strokeIndex" | "segmentationSource"
>;

export function analyzePoseFrameStream(
  stream: PoseFrameStream,
  opts: {
    calibration?: Calibration;
    thresholds?: PostureThresholdBands;
  } = {},
): PostSessionAnalysisResult {
  const thresholds = opts.thresholds ?? postureThresholdsV1.thresholds;
  const strokes = StrokePhaseSegmenter(stream);
  const metrics: DerivedStrokePostureMetric[] = [];
  const faults: DerivedPostureFault[] = [];

  for (const stroke of strokes) {
    const postureMetrics = PostureMetricsCalculator(
      stream,
      stroke,
      opts.calibration,
    );
    metrics.push(metricToDerivedRow(stroke, postureMetrics));
    for (const fault of PostureFaultDetector(postureMetrics, thresholds)) {
      faults.push(faultToDerivedRow(fault));
    }
  }

  return { metrics, faults };
}

function metricToDerivedRow(
  stroke: Stroke,
  metrics: PostureMetrics,
): DerivedStrokePostureMetric {
  const {
    strokeIndex,
    segmentationSource,
    ...metricsJson
  } = metrics;
  return {
    strokeIndex,
    segmentationSource,
    phaseBoundariesJson: {
      catchFrameIndex: stroke.catchFrameIndex,
      driveStartFrameIndex: stroke.driveStartFrameIndex,
      finishFrameIndex: stroke.finishFrameIndex,
      recoveryStartFrameIndex: stroke.recoveryStartFrameIndex,
      nextCatchFrameIndex: stroke.nextCatchFrameIndex,
      confidence: stroke.confidence,
    },
    metricsJson,
  };
}

function faultToDerivedRow(fault: PostureFault): DerivedPostureFault {
  return {
    strokeIndex: fault.strokeIndex,
    faultType: fault.faultType,
    severity: fault.severity,
    phase: fault.phase,
    evidenceJson: fault.evidence,
  };
}
