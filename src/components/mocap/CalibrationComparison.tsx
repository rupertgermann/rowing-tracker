import type { MaybeMetric, PostureMetrics } from "@/lib/mocap/analysis/types";

type Comparisons = Partial<Pick<PostureMetrics, "catchReferenceDeltaDeg" | "finishReferenceDeltaDeg">>;

export function CalibrationComparison({ metrics }: { metrics: Comparisons }) {
  return (
    <div className="text-sm" data-testid="mocap-calibration-comparison">
      <p>Torso angle vs calibration (positive = more upright)</p>
      <p>Catch: {format(metrics.catchReferenceDeltaDeg)} · Finish: {format(metrics.finishReferenceDeltaDeg)}</p>
    </div>
  );
}

function format(metric: MaybeMetric<number> | undefined): string {
  if (!metric?.available) {
    return metric?.reason === "browser-calibration-only" ? "not applicable to multi-camera capture" : "unavailable — usable reference required";
  }
  return `${metric.value > 0 ? "+" : ""}${metric.value.toFixed(1)}°`;
}
