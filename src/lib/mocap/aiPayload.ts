/**
 * Posture AI payload builder — 3-tier cloud data policy.
 *
 * Tier 1 (raw PoseFrameStream): HARD WALL — never sent to cloud AI.
 * Tier 3 (fault summary):       Default when cloudAIEnabled = true.
 * Tier 2 (per-stroke metrics):  Opt-in; requires mocapDetailedAIShare = true.
 *
 * This module has NO Prisma imports: it is a pure data-transformation layer.
 */

export interface PostureFaultSummary {
  totalFaults: number;
  faultCounts: Partial<Record<string, number>>;
  severityCounts: { info: number; warning: number; critical: number };
  qualityFlags: string[];
  sessionQualityScore: number | null;
}

export interface PostureMetricSummary {
  strokeIndex: number;
  segmentationSource: string;
  backAngleAtCatchDeg: number;
  laybackAngleDeg: number;
  recoveryDriveRatio: number;
}

export interface PostureAIPayload {
  tier: 2 | 3;
  faultSummary: PostureFaultSummary;
  strokeMetrics?: PostureMetricSummary[]; // only present on tier 2
}

/**
 * Build a cloud-safe posture AI payload respecting the 3-tier policy.
 *
 * Returns null when cloudAIEnabled is false (Tier 1 hard-wall).
 * Returns a Tier 3 payload (fault summary only) by default.
 * Returns a Tier 2 payload (fault summary + per-stroke metrics) when
 * mocapDetailedAIShare is also true.
 */
export function buildPostureAIPayload(
  faults: Array<{ faultType: string; severity: string }>,
  metrics: Array<{
    strokeIndex: number;
    segmentationSource: string;
    metricsJson: unknown;
  }>,
  qualityFlags: string[],
  qualityScore: number | null,
  opts: { cloudAIEnabled: boolean; mocapDetailedAIShare: boolean },
): PostureAIPayload | null {
  // Tier 1 hard-wall: no posture data leaves the device.
  if (!opts.cloudAIEnabled) return null;

  const faultCounts: Partial<Record<string, number>> = {};
  const severityCounts = { info: 0, warning: 0, critical: 0 };

  for (const f of faults) {
    faultCounts[f.faultType] = (faultCounts[f.faultType] ?? 0) + 1;
    if (f.severity === "info") severityCounts.info++;
    else if (f.severity === "warning") severityCounts.warning++;
    else if (f.severity === "critical") severityCounts.critical++;
  }

  const faultSummary: PostureFaultSummary = {
    totalFaults: faults.length,
    faultCounts,
    severityCounts,
    qualityFlags,
    sessionQualityScore: qualityScore,
  };

  // Tier 3 (default): fault summary only — no body geometry, no keypoints.
  if (!opts.mocapDetailedAIShare) {
    return { tier: 3, faultSummary };
  }

  // Tier 2 (opt-in): fault summary + per-stroke scalar metrics — NO keypoints.
  const strokeMetrics: PostureMetricSummary[] = metrics.map((m) => {
    const mj = m.metricsJson as Record<string, unknown>;
    return {
      strokeIndex: m.strokeIndex,
      segmentationSource: m.segmentationSource,
      backAngleAtCatchDeg:
        typeof mj.backAngleAtCatchDeg === "number" ? mj.backAngleAtCatchDeg : 0,
      laybackAngleDeg:
        typeof mj.laybackAngleDeg === "number" ? mj.laybackAngleDeg : 0,
      recoveryDriveRatio:
        typeof mj.recoveryDriveRatio === "number" ? mj.recoveryDriveRatio : 0,
    };
  });

  return { tier: 2, faultSummary, strokeMetrics };
}

/**
 * Hard guard: throws if the serialised payload contains keypoint arrays.
 * Call this before appending any posture payload to a cloud-bound prompt.
 */
export function assertNoKeypointsInPayload(payload: unknown): void {
  const str = JSON.stringify(payload);
  if (str.includes('"keypoints"') || str.includes('"landmarks"')) {
    throw new Error(
      "HARD GUARD VIOLATION: cloud-bound payload contains keypoint data",
    );
  }
}
