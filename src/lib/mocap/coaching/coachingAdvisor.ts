import type { FaultSeverity, PostureFault, PostureFaultType } from "../analysis/types";

export interface SessionContext {
  strokeCount: number;
}

export interface CoachingCue {
  faultType: PostureFaultType;
  severity: FaultSeverity;
  message: string;
  audioHint: string;
  drills: string[];
}

// ---------------------------------------------------------------------------
// Drill catalog (keyed by fault type)
// ---------------------------------------------------------------------------

const DRILL_CATALOG: Record<PostureFaultType, string[]> = {
  rounded_back_at_catch: [
    "Pause drill at the catch",
    "Body angle check with mirror",
  ],
  early_arm_bend: [
    "Arms-only rowing drill",
    "Pause drill at arms-away position",
  ],
  back_opens_before_legs_drive: [
    "Legs-only rowing drill",
    "Pick drill sequence",
  ],
  excessive_layback: [
    "Half-slide rowing",
    "Finish position hold drill",
  ],
  slow_recovery_ratio: [
    "Controlled recovery timing drill",
    "Pause at the finish drill",
  ],
  left_right_asymmetry: [
    "Eyes-closed sculling drill",
    "Single-arm rowing alternate sides",
  ],
  knee_track_deviation: [
    "Slow-motion drive with knee-track focus",
    "Legs-only rowing with band resistance",
  ],
  shin_not_vertical_at_catch: [
    "Pause drill at the catch — check shin angle",
    "Footstretcher adjustment check",
  ],
};

// ---------------------------------------------------------------------------
// Hand-written coaching copy (message + audioHint per fault type)
// ---------------------------------------------------------------------------

interface CueCopy {
  message: string;
  audioHint: string;
}

const CUE_COPY: Record<PostureFaultType, CueCopy> = {
  rounded_back_at_catch: {
    message:
      "Your back is rounding at the catch. Keep the chest tall and the back straight — reach forward with a flat back before taking the stroke.",
    audioHint: "Tall chest, flat back",
  },
  early_arm_bend: {
    message:
      "Your arms are bending before the legs have finished the drive. Lock the arms out and let the legs push first, then draw with the body and arms in sequence.",
    audioHint: "Legs, then arms",
  },
  back_opens_before_legs_drive: {
    message:
      "Your body is swinging open before the legs have engaged. Initiate the drive with the legs and keep the back angle constant until the legs are nearly straight.",
    audioHint: "Hold body angle",
  },
  excessive_layback: {
    message:
      "You are leaning too far back at the finish. Aim for a slight layback — around 10–20 degrees past vertical — rather than collapsing the trunk backward.",
    audioHint: "Slight layback only",
  },
  slow_recovery_ratio: {
    message:
      "Your recovery is very slow relative to the drive. Control the slide speed but aim to keep the recovery-to-drive ratio below 2.5 to maintain a good rhythm.",
    audioHint: "Control your slide",
  },
  left_right_asymmetry: {
    message:
      "Left-right asymmetry detected in your shoulder or hip position. Focus on applying equal pressure through both feet and keeping the handle level.",
    audioHint: "Even pressure both sides",
  },
  knee_track_deviation: {
    message:
      "Your knee is tracking away from the straight line during the drive. Keep the knees tracking over your feet throughout the stroke.",
    audioHint: "Knees over feet",
  },
  shin_not_vertical_at_catch: {
    message:
      "Your shin is not vertical at the catch. Check your foot stretcher position and ensure you reach the correct compression before taking the stroke.",
    audioHint: "Vertical shin at catch",
  },
};

// ---------------------------------------------------------------------------
// Severity ordering (for deduplication: keep highest severity per fault type)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<FaultSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  pending: -1, // pending faults are never surfaced as coaching cues
};

// ---------------------------------------------------------------------------
// getCoachingCues — pure function, no Prisma imports
// ---------------------------------------------------------------------------

/**
 * Derives CoachingCues from a list of PostureFaults.
 *
 * Rules:
 * - Returns an empty array for an empty faults list.
 * - Suppresses `info`-severity faults by default (controlled by caller via
 *   the `minSeverity` option, default `'warning'`).
 * - Emits at most one cue per unique fault type; when the same fault type
 *   appears at multiple severities, the highest severity wins.
 * - `message` and `audioHint` are hand-written per fault type.
 * - `drills` are drawn from DRILL_CATALOG.
 */
export function getCoachingCues(
  faults: PostureFault[],
  _sessionContext: SessionContext,
  opts: { minSeverity?: FaultSeverity } = {},
): CoachingCue[] {
  if (faults.length === 0) return [];

  const minRank = SEVERITY_RANK[opts.minSeverity ?? "warning"];

  // Deduplicate: one entry per fault type, highest severity wins.
  const best = new Map<PostureFaultType, PostureFault>();
  for (const fault of faults) {
    if (SEVERITY_RANK[fault.severity] < minRank) continue;
    const existing = best.get(fault.faultType);
    if (
      !existing ||
      SEVERITY_RANK[fault.severity] > SEVERITY_RANK[existing.severity]
    ) {
      best.set(fault.faultType, fault);
    }
  }

  const cues: CoachingCue[] = [];
  for (const fault of best.values()) {
    const copy = CUE_COPY[fault.faultType];
    cues.push({
      faultType: fault.faultType,
      severity: fault.severity,
      message: copy.message,
      audioHint: copy.audioHint,
      drills: DRILL_CATALOG[fault.faultType],
    });
  }

  return cues;
}
