import type { PostureFaultType } from "./mocap/analysis/types";
import type { SessionFaultInput } from "./mocap/postureTrendAggregation";

export interface PostureGoalProgress {
  faultType: PostureFaultType;
  targetRate: number;
  currentRate: number;
  totalFaults: number;
  totalStrokes: number;
  linkedMocapSessionCount: number;
  achieved: boolean;
}

export function computePostureGoalProgress(
  sessions: SessionFaultInput[],
  faultType: PostureFaultType,
  targetRate: number,
): PostureGoalProgress {
  let totalFaults = 0;
  let totalStrokes = 0;
  let linkedMocapSessionCount = 0;

  for (const session of sessions) {
    linkedMocapSessionCount++;
    totalStrokes += session.strokeCount;
    for (const fault of session.faults) {
      if (fault.faultType === faultType) {
        totalFaults++;
      }
    }
  }

  const currentRate = totalStrokes > 0 ? totalFaults / totalStrokes : 0;

  return {
    faultType,
    targetRate,
    currentRate,
    totalFaults,
    totalStrokes,
    linkedMocapSessionCount,
    achieved: linkedMocapSessionCount > 0 && currentRate <= targetRate,
  };
}
