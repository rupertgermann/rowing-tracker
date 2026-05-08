import type { PostureFaultType } from "./types";

export type PostureThresholdVersion = "V1" | `V${number}`;

export interface PostureThresholdBands {
  rounded_back_at_catch: {
    warningBelowDeg: number;
    criticalBelowDeg: number;
  };
  early_arm_bend: {
    infoBeforeLegsCompleteFrames: number;
    warningBeforeLegsCompleteFrames: number;
  };
  back_opens_before_legs_drive: {
    warningTorsoOpensBeforeLegsFrames: number;
  };
  excessive_layback: {
    infoAboveDeg: number;
    warningAboveDeg: number;
  };
  slow_recovery_ratio: {
    warningAboveRatio: number;
    criticalAboveRatio: number;
  };
}

export interface VersionedPostureThresholds {
  version: PostureThresholdVersion;
  thresholds: PostureThresholdBands;
}

export interface UserPostureThresholdSettings extends VersionedPostureThresholds {
  userOverridden: boolean;
}

export const POSTURE_FAULT_CATALOG_V1: readonly PostureFaultType[] = [
  "rounded_back_at_catch",
  "early_arm_bend",
  "back_opens_before_legs_drive",
  "excessive_layback",
  "slow_recovery_ratio",
];

export const postureThresholdsV1: VersionedPostureThresholds = {
  version: "V1",
  thresholds: {
    // British Rowing Technique: catch/drive keeps the back straight and leaning
    // forward; CONTEXT.md fixes the v1 warning/critical bands at 30/20 deg.
    rounded_back_at_catch: {
      warningBelowDeg: 30,
      criticalBelowDeg: 20,
    },
    // Concept2 Indoor Rowing Technique: drive sequence is legs, body, then arms;
    // early elbow flexion before leg extension is therefore treated conservatively.
    early_arm_bend: {
      infoBeforeLegsCompleteFrames: 1,
      warningBeforeLegsCompleteFrames: 4,
    },
    // British Rowing and Concept2 both teach the drive as legs before body swing;
    // any torso opening before the leg signal starts is a v1 warning.
    back_opens_before_legs_drive: {
      warningTorsoOpensBeforeLegsFrames: 1,
    },
    // Concept2 finish guidance says the upper body leans back slightly; British
    // Rowing calls leaning too far back a recovery-delaying fault.
    excessive_layback: {
      infoAboveDeg: 30,
      warningAboveDeg: 45,
    },
    // Concept2 frames recovery as the rest/preparation phase; ratios beyond 2.5x
    // are deliberately conservative v1 flags for very slow recoveries.
    slow_recovery_ratio: {
      warningAboveRatio: 2.5,
      criticalAboveRatio: 3.5,
    },
  },
};

export function defaultPostureThresholdSettings(
  defaults: VersionedPostureThresholds = postureThresholdsV1,
): UserPostureThresholdSettings {
  return {
    version: defaults.version,
    thresholds: cloneThresholds(defaults.thresholds),
    userOverridden: false,
  };
}

export function migratePostureThresholdSettings(
  stored: unknown,
  defaults: VersionedPostureThresholds = postureThresholdsV1,
): UserPostureThresholdSettings {
  if (!isUserPostureThresholdSettings(stored)) {
    return defaultPostureThresholdSettings(defaults);
  }

  if (stored.version !== defaults.version && !stored.userOverridden) {
    return defaultPostureThresholdSettings(defaults);
  }

  return {
    version: stored.version,
    thresholds: cloneThresholds(stored.thresholds),
    userOverridden: stored.userOverridden,
  };
}

function isUserPostureThresholdSettings(
  value: unknown,
): value is UserPostureThresholdSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UserPostureThresholdSettings>;
  return (
    typeof candidate.version === "string" &&
    typeof candidate.userOverridden === "boolean" &&
    isPostureThresholdBands(candidate.thresholds)
  );
}

function isPostureThresholdBands(
  value: unknown,
): value is PostureThresholdBands {
  if (!value || typeof value !== "object") return false;
  const t = value as PostureThresholdBands;
  return (
    isFiniteNumber(t.rounded_back_at_catch?.warningBelowDeg) &&
    isFiniteNumber(t.rounded_back_at_catch?.criticalBelowDeg) &&
    isFiniteNumber(t.early_arm_bend?.infoBeforeLegsCompleteFrames) &&
    isFiniteNumber(t.early_arm_bend?.warningBeforeLegsCompleteFrames) &&
    isFiniteNumber(
      t.back_opens_before_legs_drive?.warningTorsoOpensBeforeLegsFrames,
    ) &&
    isFiniteNumber(t.excessive_layback?.infoAboveDeg) &&
    isFiniteNumber(t.excessive_layback?.warningAboveDeg) &&
    isFiniteNumber(t.slow_recovery_ratio?.warningAboveRatio) &&
    isFiniteNumber(t.slow_recovery_ratio?.criticalAboveRatio)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneThresholds(thresholds: PostureThresholdBands): PostureThresholdBands {
  return {
    rounded_back_at_catch: { ...thresholds.rounded_back_at_catch },
    early_arm_bend: { ...thresholds.early_arm_bend },
    back_opens_before_legs_drive: {
      ...thresholds.back_opens_before_legs_drive,
    },
    excessive_layback: { ...thresholds.excessive_layback },
    slow_recovery_ratio: { ...thresholds.slow_recovery_ratio },
  };
}
