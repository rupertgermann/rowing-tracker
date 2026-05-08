/**
 * LiveCoachingEngine - drives post-stroke coaching cues during a live mocap
 * session. Buffers incoming PoseAnalysisFrames, periodically re-runs the pure
 * StrokePhaseSegmenter / PostureMetricsCalculator / PostureFaultDetector
 * pipeline, and emits a single CoachingCue per newly-completed stroke via
 * `onCue`. No DOM, no I/O - fully testable with synthetic frame streams.
 *
 * Cues fire post-stroke (per resolved decision in the PRD), not intra-stroke.
 * Same-faultType throttling honors US 5 ("non-nagging").
 */
import { StrokePhaseSegmenter } from "../analysis/strokePhaseSegmenter";
import { PostureMetricsCalculator } from "../analysis/postureMetrics";
import { PostureFaultDetector } from "../analysis/postureFaultDetector";
import {
  postureThresholdsV1,
  type PostureThresholdBands,
} from "../analysis/postureThresholds";
import type {
  Calibration,
  CapturePerspective,
  FaultSeverity,
  PoseAnalysisFrame,
  PoseFrameStream,
  PostureFault,
  PostureFaultType,
  Stroke,
} from "../analysis/types";
import { getCoachingCues, type CoachingCue } from "./coachingAdvisor";

export interface LiveCoachingEngineOptions {
  fps: number;
  capturePerspective: CapturePerspective;
  calibration?: Calibration;
  thresholds?: PostureThresholdBands;
  /** Lowest severity that produces a cue. quiet -> 'warning', verbose -> 'info'. */
  minSeverity?: FaultSeverity;
  /**
   * Minimum wall-clock interval between segmenter passes, in ms. Caps O(N^2)
   * work over a long capture. Default 500 ms.
   */
  segmenterIntervalMs?: number;
  /**
   * Minimum wall-clock interval between cues for the same faultType, in ms.
   * Honors US 5 ("non-nagging"). Default 8000 ms.
   */
  perFaultThrottleMs?: number;
  /**
   * Trailing margin in frames to wait before considering a stroke "complete".
   * Avoids emitting against a stroke whose nextCatchFrameIndex was placed at
   * the very end of the buffer where the segmenter is least confident.
   */
  trailingFrameMargin?: number;
  onCue: (cue: CoachingCue, stroke: Stroke, faults: PostureFault[]) => void;
  /** Wall clock (ms). Injectable for tests. Defaults to Date.now. */
  now?: () => number;
}

const SEVERITY_RANK: Record<FaultSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export class LiveCoachingEngine {
  private readonly fps: number;
  private readonly capturePerspective: CapturePerspective;
  private readonly calibration: Calibration | undefined;
  private readonly thresholds: PostureThresholdBands;
  private readonly minSeverity: FaultSeverity;
  private readonly segmenterIntervalMs: number;
  private readonly perFaultThrottleMs: number;
  private readonly trailingFrameMargin: number;
  private readonly onCue: LiveCoachingEngineOptions["onCue"];
  private readonly now: () => number;

  private frames: PoseAnalysisFrame[] = [];
  private lastTickAtMs = 0;
  private lastEmittedStrokeIndex = -1;
  private lastCueAtByType = new Map<PostureFaultType, number>();
  private completedStrokeCount = 0;

  constructor(opts: LiveCoachingEngineOptions) {
    this.fps = opts.fps;
    this.capturePerspective = opts.capturePerspective;
    this.calibration = opts.calibration;
    this.thresholds = opts.thresholds ?? postureThresholdsV1.thresholds;
    this.minSeverity = opts.minSeverity ?? "warning";
    this.segmenterIntervalMs = opts.segmenterIntervalMs ?? 500;
    this.perFaultThrottleMs = opts.perFaultThrottleMs ?? 8000;
    this.trailingFrameMargin = opts.trailingFrameMargin ?? 3;
    this.onCue = opts.onCue;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Append a frame to the live buffer; may trigger a (throttled) tick. */
  pushFrame(frame: PoseAnalysisFrame): void {
    this.frames.push(frame);
    const now = this.now();
    if (now - this.lastTickAtMs >= this.segmenterIntervalMs) {
      this.lastTickAtMs = now;
      this.tick();
    }
  }

  /** Force a final analysis pass (e.g. on session stop). */
  flush(): void {
    this.lastTickAtMs = this.now();
    this.tick();
  }

  /** Re-run the full pipeline on the current buffer and emit any new cues. */
  tick(): void {
    if (this.frames.length < 3) return;

    const stream: PoseFrameStream = {
      fps: this.fps,
      capturePerspective: this.capturePerspective,
      frames: this.frames,
    };

    const strokes = StrokePhaseSegmenter(stream);
    if (strokes.length === 0) return;

    const lastFrameIndex = this.frames.length - 1;
    const completionBoundary = lastFrameIndex - this.trailingFrameMargin;

    for (const stroke of strokes) {
      if (stroke.strokeIndex <= this.lastEmittedStrokeIndex) continue;
      // Only emit once the stroke is fully closed and a small trailing margin
      // of frames has accumulated past nextCatchFrameIndex.
      if (stroke.nextCatchFrameIndex > completionBoundary) break;

      this.lastEmittedStrokeIndex = stroke.strokeIndex;
      this.completedStrokeCount += 1;

      const metrics = PostureMetricsCalculator(stream, stroke, this.calibration);
      const faults = PostureFaultDetector(metrics, this.thresholds);
      if (faults.length === 0) continue;

      const cues = getCoachingCues(
        faults,
        { strokeCount: this.completedStrokeCount },
        { minSeverity: this.minSeverity },
      );
      if (cues.length === 0) continue;

      // Pick the single highest-severity cue for this stroke (avoid stacking
      // multiple visual/audio cues at once).
      const cue = pickPrimaryCue(cues);
      const lastAt = this.lastCueAtByType.get(cue.faultType) ?? -Infinity;
      const now = this.now();
      if (now - lastAt < this.perFaultThrottleMs) continue;

      this.lastCueAtByType.set(cue.faultType, now);
      this.onCue(cue, stroke, faults);
    }
  }

  /** Reset all internal state. Used between sessions. */
  reset(): void {
    this.frames = [];
    this.lastTickAtMs = 0;
    this.lastEmittedStrokeIndex = -1;
    this.lastCueAtByType.clear();
    this.completedStrokeCount = 0;
  }

  /** Test/diagnostic accessor. */
  get bufferedFrameCount(): number {
    return this.frames.length;
  }
}

function pickPrimaryCue(cues: CoachingCue[]): CoachingCue {
  let best = cues[0];
  for (const cue of cues) {
    if (SEVERITY_RANK[cue.severity] > SEVERITY_RANK[best.severity]) {
      best = cue;
    }
  }
  return best;
}
