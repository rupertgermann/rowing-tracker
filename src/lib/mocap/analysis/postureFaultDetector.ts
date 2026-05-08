import { postureThresholdsV1, type PostureThresholdBands } from "./postureThresholds";
import type { PostureFault, PostureMetrics } from "./types";

export function PostureFaultDetector(
  metrics: PostureMetrics,
  thresholds: PostureThresholdBands = postureThresholdsV1.thresholds,
): PostureFault[] {
  const faults: PostureFault[] = [];

  if (
    metrics.backAngleAtCatchDeg <
    thresholds.rounded_back_at_catch.criticalBelowDeg
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "rounded_back_at_catch",
      severity: "critical",
      phase: "catch",
      evidence: {
        metric: "backAngleAtCatchDeg",
        value: metrics.backAngleAtCatchDeg,
        threshold: thresholds.rounded_back_at_catch.criticalBelowDeg,
      },
    });
  } else if (
    metrics.backAngleAtCatchDeg <
    thresholds.rounded_back_at_catch.warningBelowDeg
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "rounded_back_at_catch",
      severity: "warning",
      phase: "catch",
      evidence: {
        metric: "backAngleAtCatchDeg",
        value: metrics.backAngleAtCatchDeg,
        threshold: thresholds.rounded_back_at_catch.warningBelowDeg,
      },
    });
  }

  const armLead = metrics.armBendBeforeLegsCompleteFrames;
  if (
    armLead !== null &&
    armLead >= thresholds.early_arm_bend.warningBeforeLegsCompleteFrames
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "early_arm_bend",
      severity: "warning",
      phase: "drive",
      evidence: {
        metric: "armBendBeforeLegsCompleteFrames",
        value: armLead,
        threshold: thresholds.early_arm_bend.warningBeforeLegsCompleteFrames,
        frameIndex: metrics.armBendOnsetFrameIndex ?? undefined,
      },
    });
  } else if (
    armLead !== null &&
    armLead >= thresholds.early_arm_bend.infoBeforeLegsCompleteFrames
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "early_arm_bend",
      severity: "info",
      phase: "drive",
      evidence: {
        metric: "armBendBeforeLegsCompleteFrames",
        value: armLead,
        threshold: thresholds.early_arm_bend.infoBeforeLegsCompleteFrames,
        frameIndex: metrics.armBendOnsetFrameIndex ?? undefined,
      },
    });
  }

  const openingOffset = metrics.hipKneeOpeningOffsetFrames;
  if (
    openingOffset !== null &&
    openingOffset <=
      -thresholds.back_opens_before_legs_drive
        .warningTorsoOpensBeforeLegsFrames
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "back_opens_before_legs_drive",
      severity: "warning",
      phase: "drive",
      evidence: {
        metric: "hipKneeOpeningOffsetFrames",
        value: openingOffset,
        threshold:
          -thresholds.back_opens_before_legs_drive
            .warningTorsoOpensBeforeLegsFrames,
      },
    });
  }

  if (metrics.laybackAngleDeg > thresholds.excessive_layback.warningAboveDeg) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "excessive_layback",
      severity: "warning",
      phase: "finish",
      evidence: {
        metric: "laybackAngleDeg",
        value: metrics.laybackAngleDeg,
        threshold: thresholds.excessive_layback.warningAboveDeg,
      },
    });
  } else if (
    metrics.laybackAngleDeg > thresholds.excessive_layback.infoAboveDeg
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "excessive_layback",
      severity: "info",
      phase: "finish",
      evidence: {
        metric: "laybackAngleDeg",
        value: metrics.laybackAngleDeg,
        threshold: thresholds.excessive_layback.infoAboveDeg,
      },
    });
  }

  if (
    metrics.recoveryDriveRatio >
    thresholds.slow_recovery_ratio.criticalAboveRatio
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "slow_recovery_ratio",
      severity: "critical",
      phase: "recovery",
      evidence: {
        metric: "recoveryDriveRatio",
        value: metrics.recoveryDriveRatio,
        threshold: thresholds.slow_recovery_ratio.criticalAboveRatio,
      },
    });
  } else if (
    metrics.recoveryDriveRatio >
    thresholds.slow_recovery_ratio.warningAboveRatio
  ) {
    faults.push({
      strokeIndex: metrics.strokeIndex,
      faultType: "slow_recovery_ratio",
      severity: "warning",
      phase: "recovery",
      evidence: {
        metric: "recoveryDriveRatio",
        value: metrics.recoveryDriveRatio,
        threshold: thresholds.slow_recovery_ratio.warningAboveRatio,
      },
    });
  }

  return faults;
}
