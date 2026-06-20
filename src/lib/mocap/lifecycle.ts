import type { Prisma } from "@prisma/client";
import { MOCAP_RECORD_ONLY_FLAG } from "@/lib/mocap/assignment";
import type { FinalizedPoseStream } from "@/lib/mocap/capturePersistence";
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

export interface LinkMocapSessionInput {
  userId: string;
  mocapSessionId: string;
  rowingSessionId: string;
}

export interface FinalizeMocapSessionInput {
  userId: string;
  mocapSessionId: string;
  durationSec: number;
  qualityScore?: number;
  qualityFlags?: string[];
  skipAnalysis?: boolean;
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

export type FinalizeMocapSessionResult =
  | {
      ok: true;
      id: string;
      status: string;
      durationSec: number;
      frameCount: number;
      poseStreamBytes: number;
      strokeMetricCount: number;
      faultCount: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type LinkMocapSessionResult =
  | {
      ok: true;
      id: string;
      rowingSessionId: string;
      status: string;
      analysisMode: "csv-aligned";
      strokeMetricCount: number;
      faultCount: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type UnlinkMocapSessionResult =
  | {
      ok: true;
      id: string;
      status: string;
      analysisMode: "pose-segmented";
      strokeMetricCount: number;
      faultCount: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export interface MocapLifecycleRowingSession {
  id: string;
  mocapSession: { id: string } | null;
}

export type MocapAssignmentResult =
  | true
  | false
  | "assigned"
  | "mocap-conflict"
  | "rowing-conflict";

export interface MocapCaptureFinalizationState {
  status: "analyzing" | "ready";
  durationSec: number;
  qualityScore: number | null;
  qualityFlags: string[];
}

export interface MocapLifecycleDependencies {
  storage: Pick<MocapStorage, "exists">;
  findSession(
    userId: string,
    mocapSessionId: string,
  ): Promise<MocapLifecycleSession | null>;
  findRowingSession?(
    userId: string,
    rowingSessionId: string,
  ): Promise<MocapLifecycleRowingSession | null>;
  setStatus(
    mocapSessionId: string,
    status: "capturing" | "analyzing" | "ready",
  ): Promise<{ status: string }>;
  assignMocapSession?(
    mocapSessionId: string,
    userId: string,
    rowingSessionId: string,
  ): Promise<MocapAssignmentResult>;
  unassignMocapSession?(
    mocapSessionId: string,
    userId: string,
    rowingSessionId: string,
  ): Promise<boolean>;
  restoreMocapSessionAssignment?(
    mocapSessionId: string,
    rowingSessionId: string | null,
    status: "ready",
  ): Promise<void>;
  bumpSessionsRevision?(userId: string): Promise<void>;
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

export interface FinalizeMocapSessionDependencies
  extends MocapLifecycleDependencies {
  finalizePoseStream(
    storage: MocapStorage,
    poseStreamPath: string,
  ): Promise<FinalizedPoseStream>;
  setCaptureFinalizationState(
    mocapSessionId: string,
    state: MocapCaptureFinalizationState,
  ): Promise<{ status: string; durationSec: number }>;
}

export async function finalizeMocapSessionLifecycle(
  deps: FinalizeMocapSessionDependencies,
  input: FinalizeMocapSessionInput,
): Promise<FinalizeMocapSessionResult> {
  const session = await deps.findSession(input.userId, input.mocapSessionId);
  if (!session) {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (session.status !== "capturing") {
    return {
      ok: false,
      status: 409,
      error: `Session not capturing (status=${session.status})`,
    };
  }

  const captureState = {
    durationSec: input.durationSec,
    qualityScore: input.qualityScore ?? null,
    qualityFlags: input.qualityFlags ?? [],
  };

  if (input.skipAnalysis) {
    let finalized = { frameCount: 0, poseStreamBytes: 0 };
    if (await deps.storage.exists(session.poseStreamPath)) {
      try {
        finalized = await deps.finalizePoseStream(
          deps.storage as MocapStorage,
          session.poseStreamPath,
        );
      } catch (err) {
        return finalizeFailure(err);
      }
    }
    const updated = await deps.setCaptureFinalizationState(session.id, {
      status: "ready",
      ...captureState,
      qualityFlags: uniqueFlags([
        ...captureState.qualityFlags,
        MOCAP_RECORD_ONLY_FLAG,
      ]),
    });
    return {
      ok: true,
      id: session.id,
      status: updated.status,
      durationSec: updated.durationSec,
      frameCount: finalized.frameCount,
      poseStreamBytes: finalized.poseStreamBytes,
      strokeMetricCount: 0,
      faultCount: 0,
    };
  }

  const analyzing = await deps.setCaptureFinalizationState(session.id, {
    status: "analyzing",
    ...captureState,
  });

  let finalized: FinalizedPoseStream;
  try {
    finalized = await deps.finalizePoseStream(
      deps.storage as MocapStorage,
      session.poseStreamPath,
    );
  } catch (err) {
    await deps.setStatus(session.id, "capturing");
    return finalizeFailure(err);
  }

  let analysis: PersistedMocapAnalysisSummary;
  try {
    analysis = await deps.analyzePoseSegmented(deps.storage as MocapStorage, {
      ...session,
      status: "analyzing",
    });
  } catch (err) {
    await deps.setStatus(session.id, "ready");
    return analysisFailure(err);
  }

  const updated = await deps.setStatus(session.id, "ready");
  return {
    ok: true,
    id: session.id,
    status: updated.status,
    durationSec: analyzing.durationSec,
    frameCount: finalized.frameCount,
    poseStreamBytes: finalized.poseStreamBytes,
    strokeMetricCount: analysis.strokeMetricCount,
    faultCount: analysis.faultCount,
  };
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

export async function linkMocapSessionLifecycle(
  deps: MocapLifecycleDependencies,
  input: LinkMocapSessionInput,
): Promise<LinkMocapSessionResult> {
  const session = await deps.findSession(input.userId, input.mocapSessionId);
  if (!session) {
    return { ok: false, status: 404, error: "Mocap session not found" };
  }
  const readyResult = await validateReadyAnalyzableSession(deps, session);
  if (!readyResult.ok) {
    return readyResult;
  }
  if (session.rowingSessionId !== null) {
    return {
      ok: false,
      status: 409,
      error: "Mocap session is already linked to a rowing session. Unlink first.",
    };
  }
  if (!deps.findRowingSession) {
    throw new Error("findRowingSession dependency is required for linking");
  }
  const rowingSession = await deps.findRowingSession(
    input.userId,
    input.rowingSessionId,
  );
  if (!rowingSession) {
    return { ok: false, status: 404, error: "Rowing session not found" };
  }
  if (rowingSession.mocapSession !== null) {
    return {
      ok: false,
      status: 409,
      error: "Rowing session is already linked to another mocap session.",
    };
  }
  if (!deps.assignMocapSession) {
    throw new Error("assignMocapSession dependency is required for linking");
  }
  const assigned = await deps.assignMocapSession(
    session.id,
    input.userId,
    input.rowingSessionId,
  );
  if (assigned === "rowing-conflict") {
    return {
      ok: false,
      status: 409,
      error: "Rowing session is already linked to another mocap session.",
    };
  }
  if (assigned === false || assigned === "mocap-conflict") {
    return {
      ok: false,
      status: 409,
      error: "Mocap session is already linked to a rowing session. Unlink first.",
    };
  }

  const linkedSession = {
    ...session,
    rowingSessionId: input.rowingSessionId,
    status: "analyzing",
  };

  let analysis: PersistedMocapAnalysisSummary;
  try {
    analysis = await deps.analyzeCsvAligned(
      deps.storage as MocapStorage,
      linkedSession,
      input.rowingSessionId,
    );
  } catch (err) {
    await restoreAssignment(deps, session.id, null);
    return analysisFailure(err);
  }

  const updated = await deps.setStatus(session.id, "ready");
  await deps.bumpSessionsRevision?.(input.userId);
  return {
    ok: true,
    id: session.id,
    rowingSessionId: input.rowingSessionId,
    status: updated.status,
    analysisMode: "csv-aligned",
    strokeMetricCount: analysis.strokeMetricCount,
    faultCount: analysis.faultCount,
  };
}

export async function unlinkMocapSessionLifecycle(
  deps: MocapLifecycleDependencies,
  input: ReanalyzeMocapSessionInput,
): Promise<UnlinkMocapSessionResult> {
  const session = await deps.findSession(input.userId, input.mocapSessionId);
  if (!session) {
    return { ok: false, status: 404, error: "Mocap session not found" };
  }
  const readyResult = await validateReadyAnalyzableSession(deps, session);
  if (!readyResult.ok) {
    return readyResult;
  }
  const previousRowingSessionId = session.rowingSessionId;
  if (previousRowingSessionId === null) {
    return {
      ok: false,
      status: 409,
      error: "Mocap session is not linked to a rowing session.",
    };
  }
  if (!deps.unassignMocapSession) {
    throw new Error("unassignMocapSession dependency is required for unlinking");
  }
  const unassigned = await deps.unassignMocapSession(
    session.id,
    input.userId,
    previousRowingSessionId,
  );
  if (!unassigned) {
    return {
      ok: false,
      status: 409,
      error: "Mocap session is not linked to a rowing session.",
    };
  }

  const unlinkedSession = {
    ...session,
    rowingSessionId: null,
    status: "analyzing",
  };

  let analysis: PersistedMocapAnalysisSummary;
  try {
    analysis = await deps.analyzePoseSegmented(
      deps.storage as MocapStorage,
      unlinkedSession,
    );
  } catch (err) {
    await restoreAssignment(deps, session.id, previousRowingSessionId);
    return analysisFailure(err);
  }

  const updated = await deps.setStatus(session.id, "ready");
  await deps.bumpSessionsRevision?.(input.userId);
  return {
    ok: true,
    id: session.id,
    status: updated.status,
    analysisMode: "pose-segmented",
    strokeMetricCount: analysis.strokeMetricCount,
    faultCount: analysis.faultCount,
  };
}

async function validateReadyAnalyzableSession(
  deps: MocapLifecycleDependencies,
  session: MocapLifecycleSession,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (session.status !== "ready") {
    return {
      ok: false,
      status: 409,
      error: `Mocap session not ready (status=${session.status})`,
    };
  }
  if (!(await deps.storage.exists(session.poseStreamPath))) {
    return {
      ok: false,
      status: 409,
      error: "Cannot re-analyze a record-only session without a pose stream",
    };
  }
  return { ok: true };
}

async function restoreAssignment(
  deps: MocapLifecycleDependencies,
  mocapSessionId: string,
  rowingSessionId: string | null,
): Promise<void> {
  if (!deps.restoreMocapSessionAssignment) {
    throw new Error("restoreMocapSessionAssignment dependency is required");
  }
  await deps.restoreMocapSessionAssignment(mocapSessionId, rowingSessionId, "ready");
}

function analysisFailure(err: unknown): { ok: false; status: 500; error: string } {
  return {
    ok: false,
    status: 500,
    error: err instanceof Error ? err.message : String(err),
  };
}

function finalizeFailure(err: unknown): { ok: false; status: 500; error: string } {
  return {
    ok: false,
    status: 500,
    error: err instanceof Error ? err.message : String(err),
  };
}

function uniqueFlags(flags: string[]): string[] {
  return [...new Set(flags)];
}
