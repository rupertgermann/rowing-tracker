import type { SessionFaultInput } from './mocap/postureTrendAggregation';
import { isLowQuality } from './mocap/postureTrendAggregation';

export const CLEAN_CATCH_AWARD_ID = 'posture-clean-catch' as const;
export const CLEAN_CATCH_MIN_STROKES = 20;
export const CLEAN_CATCH_MAX_FAULT_RATE = 0.10;

export function cleanCatchQualifies(session: SessionFaultInput): boolean {
  if (isLowQuality(session)) return false;
  if (session.strokeCount < CLEAN_CATCH_MIN_STROKES) return false;
  const faultCount = session.faults.filter((f) => f.faultType === 'rounded_back_at_catch').length;
  return faultCount / session.strokeCount <= CLEAN_CATCH_MAX_FAULT_RATE;
}

export function firstCleanCatchDate(postureSessions: SessionFaultInput[]): Date | null {
  const sorted = [...postureSessions].sort(
    (a, b) => a.sessionDate.getTime() - b.sessionDate.getTime()
  );
  const first = sorted.find(cleanCatchQualifies);
  return first ? first.sessionDate : null;
}
