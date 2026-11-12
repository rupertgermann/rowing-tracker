import { alignStrokesToCsv, type CsvStrokeTarget } from "./strokeAlignment";
import { PostureFaultDetector } from "./postureFaultDetector";
import { PostureMetricsCalculator } from "./postureMetrics";
import { toProjectedStream } from "./projection";
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
  strokeDataId?: string;
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
  csvMatchOffsetMs?: number;
  csvTimeOffsetMs?: number;
  finishSource?: "pose-hip-knee-maximum";
}

export type PostureMetricsJson = Omit<
  PostureMetrics,
  "strokeIndex" | "segmentationSource"
>;

export function analyzePoseFrameStream(
  stream: PoseFrameStream,
  opts: {
    csvStrokes?: CsvStrokeTarget[];
    calibration?: Calibration;
    thresholds?: PostureThresholdBands;
  } = {},
): PostSessionAnalysisResult {
  const thresholds = opts.thresholds ?? postureThresholdsV1.thresholds;
  const projectedStream = toProjectedStream(stream);
  let strokes = StrokePhaseSegmenter(projectedStream);
  const csvByStroke = new Map<number, { id: string; offsetMs: number; deltaMs: number }>();
  if (opts.csvStrokes) {
    const csv = opts.csvStrokes;
    const alignment = alignStrokesToCsv(strokes.map(s => stream.frames[s.catchFrameIndex].timestampMs), csv);
    const windows: Array<[number, number]> = [];
    const matches = new Map<number, { strokeIndex: number; id: string; offsetMs: number; deltaMs: number }>();
    for (const match of alignment.matches.values()) {
      const index = csv.findIndex(c => c.id === match.csvStrokeDataId);
      const next = csv[index + 1];
      if (!next || next.strokeIndex !== csv[index].strokeIndex + 1) continue;
      const startMs = csv[index].timeMs - alignment.deltaMs;
      const endMs = next.timeMs - alignment.deltaMs;
      if (startMs < stream.frames[0].timestampMs || endMs > stream.frames[stream.frames.length - 1].timestampMs || endMs <= startMs) continue;
      const nearest = (time: number) => stream.frames.reduce((best, f, i) => Math.abs(f.timestampMs - time) < Math.abs(stream.frames[best].timestampMs - time) ? i : best, 0);
      const startFrame = nearest(startMs);
      windows.push([startFrame, nearest(endMs)]);
      matches.set(startFrame, { strokeIndex: match.csvStrokeIndex, id: match.csvStrokeDataId, offsetMs: match.offsetMs, deltaMs: alignment.deltaMs });
    }
    strokes = StrokePhaseSegmenter(projectedStream, windows).map(stroke => {
      const match = matches.get(stroke.catchFrameIndex)!;
      stroke.strokeIndex = match.strokeIndex;
      csvByStroke.set(stroke.strokeIndex, match);
      return stroke;
    }).sort((a, b) => a.catchFrameIndex - b.catchFrameIndex);
  }
  const metrics: DerivedStrokePostureMetric[] = [];
  const faults: DerivedPostureFault[] = [];

  for (const stroke of strokes) {
    const postureMetrics = PostureMetricsCalculator(
      stream,
      stroke,
      opts.calibration,
      projectedStream,
    );
    const row = metricToDerivedRow(stroke, postureMetrics);
    const csv = csvByStroke.get(stroke.strokeIndex);
    if (csv) {
      row.strokeDataId = csv.id;
      Object.assign(row.phaseBoundariesJson, { csvMatchOffsetMs: csv.offsetMs, csvTimeOffsetMs: csv.deltaMs, finishSource: "pose-hip-knee-maximum" });
    }
    metrics.push(row);
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
