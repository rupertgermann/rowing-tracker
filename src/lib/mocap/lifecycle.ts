import type { Prisma } from "@prisma/client";
import type { MocapStorage } from "@/lib/mocap/storage";
import type { PersistedMocapAnalysisSummary } from "@/lib/mocap/sessionAnalysis";

export type MocapAnalysisMode = "pose-segmented" | "csv-aligned";

export interface MocapLifecycleSession {
  id: string;
  userId: string;
  status: string;
  rowingSessionId: string | null;
  poseStreamPath: string;
  capturePerspective: string;
  calibrationCatchFrame?: Prisma.JsonValue | null;
  calibrationFinishFrame?: Prisma.JsonValue | null;
}

export interface ReanalyzeMocapSessionInput {
  userId: string;
  mocapSessionId: string;
}

export type ReanalyzeMocapSessionResult =
  | {
      ok: true;
      id: string;
      status: string;
      analysisMode: MocapAnalysisMode;
      strokeMetricCount: number;
      faultCount: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export interface MocapLifecycleDependencies {
  storage: Pick<MocapStorage, "exists">;
  findSession(
    userId: string,
    mocapSessionId: string,
  ): Promise<MocapLifecycleSession | null>;
  setStatus(
    mocapSessionId: string,
    status: "analyzing" | "ready",
  ): Promise<{ status: string }>;
  analyzePoseSegmented(
    storage: MocapStorage,
    session: MocapLifecycleSession,
  ): Promise<PersistedMocapAnalysisSummary>;
  analyzeCsvAligned(
    storage: MocapStorage,
    session: MocapLifecycleSession,
    rowingSessionId: string,
  ): Promise<PersistedMocapAnalysisSummary>;
}

export async function reanalyzeMocapSessionLifecycle(
  deps: MocapLifecycleDependencies,
  input: ReanalyzeMocapSessionInput,
): Promise<ReanalyzeMocapSessionResult> {
  const session = await deps.findSession(input.userId, input.mocapSessionId);
  if (!session) {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (session.status !== "ready") {
    return {
      ok: false,
      status: 409,
      error: `Session not ready (status=${session.status})`,
    };
  }
  if (!(await deps.storage.exists(session.poseStreamPath))) {
    return {
      ok: false,
      status: 409,
      error: "Cannot re-analyze a record-only session without a pose stream",
    };
  }

  await deps.setStatus(session.id, "analyzing");

  const rowingSessionId = session.rowingSessionId;
  const analysisMode: MocapAnalysisMode = rowingSessionId
    ? "csv-aligned"
    : "pose-segmented";
  let analysis: PersistedMocapAnalysisSummary;
  try {
    if (rowingSessionId) {
      analysis = await deps.analyzeCsvAligned(
        deps.storage as MocapStorage,
        session,
        rowingSessionId,
      );
    } else {
      analysis = await deps.analyzePoseSegmented(
        deps.storage as MocapStorage,
        session,
      );
    }
  } catch (err) {
    await deps.setStatus(session.id, "ready");
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const updated = await deps.setStatus(session.id, "ready");
  return {
    ok: true,
    id: session.id,
    status: updated.status,
    analysisMode,
    strokeMetricCount: analysis.strokeMetricCount,
    faultCount: analysis.faultCount,
  };
}
