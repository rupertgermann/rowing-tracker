import type { PostureFaultType, FaultSeverity } from "./analysis/types";

export const LOW_QUALITY_SCORE_THRESHOLD = 0.5;

export interface SessionFaultInput {
  sessionId: string;
  sessionDate: Date;
  qualityScore: number | null;
  qualityFlags: string[];
  faults: { faultType: string; severity: string }[];
  strokeCount: number;
}

export interface FaultTrendPoint {
  date: string;
  sessionId: string;
  count: number;
  rate: number;
  severityCounts: { info: number; warning: number; critical: number };
  lowQuality: boolean;
  qualityFlags: string[];
}

export interface PostureFaultTrend {
  faultType: PostureFaultType;
  points: FaultTrendPoint[];
}

export interface PostureTrendResult {
  trends: PostureFaultTrend[];
  totalSessions: number;
  linkedSessionsWithFaults: number;
}

export function isLowQuality(session: Pick<SessionFaultInput, "qualityScore" | "qualityFlags">): boolean {
  if (session.qualityScore !== null && session.qualityScore < LOW_QUALITY_SCORE_THRESHOLD) {
    return true;
  }
  return session.qualityFlags.length > 0;
}

export function aggregatePostureTrend(sessions: SessionFaultInput[]): PostureTrendResult {
  const sorted = [...sessions].sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());

  const faultTypeMap = new Map<PostureFaultType, FaultTrendPoint[]>();

  let linkedSessionsWithFaults = 0;

  for (const session of sorted) {
    if (session.faults.length > 0) linkedSessionsWithFaults++;

    const byType = new Map<PostureFaultType, { info: number; warning: number; critical: number }>();

    for (const fault of session.faults) {
      const ft = fault.faultType as PostureFaultType;
      if (!byType.has(ft)) byType.set(ft, { info: 0, warning: 0, critical: 0 });
      const counts = byType.get(ft)!;
      const sev = fault.severity as FaultSeverity;
      if (sev === "info") counts.info++;
      else if (sev === "warning") counts.warning++;
      else if (sev === "critical") counts.critical++;
    }

    const lowQuality = isLowQuality(session);
    const dateStr = session.sessionDate.toISOString().split("T")[0];

    for (const [ft, severityCounts] of byType) {
      if (!faultTypeMap.has(ft)) faultTypeMap.set(ft, []);
      const count = severityCounts.info + severityCounts.warning + severityCounts.critical;
      faultTypeMap.get(ft)!.push({
        date: dateStr,
        sessionId: session.sessionId,
        count,
        rate: session.strokeCount > 0 ? count / session.strokeCount : 0,
        severityCounts,
        lowQuality,
        qualityFlags: session.qualityFlags,
      });
    }
  }

  const trends: PostureFaultTrend[] = [];
  for (const [faultType, points] of faultTypeMap) {
    trends.push({ faultType, points });
  }

  trends.sort((a, b) => a.faultType.localeCompare(b.faultType));

  return {
    trends,
    totalSessions: sessions.length,
    linkedSessionsWithFaults,
  };
}
