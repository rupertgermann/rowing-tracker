import {
  readMocapLifecycleActionResponse,
  type MocapLifecycleActionResult,
  type MocapLifecycleFailureReason,
} from "@/lib/mocap/lifecycleResponse";

export interface MocapLinkTarget {
  rowingSessionId: string;
  mocapSessionId: string;
}

export interface MocapLinkableSession {
  id: string;
  mocapSession?: { id: string } | null;
}

export type MocapLinkFailureReason = MocapLifecycleFailureReason;

export type MocapLinkResult =
  | {
      ok: true;
      mocapSessionId: string;
      rowingSessionId: string;
      status: string;
      lifecycle: Extract<MocapLifecycleActionResult, { ok: true }>;
    }
  | {
      ok: false;
      reason: MocapLinkFailureReason;
      status: number;
      message: string;
    };

export type MocapUnlinkResult =
  | {
      ok: true;
      mocapSessionId: string;
      status: string;
      lifecycle: Extract<MocapLifecycleActionResult, { ok: true }>;
    }
  | {
      ok: false;
      reason: MocapLinkFailureReason;
      status: number;
      message: string;
    };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function applyMocapLinkToSessions<T extends MocapLinkableSession>(
  sessions: T[],
  target: MocapLinkTarget,
): T[] {
  return sessions.map((session) => {
    if (session.id === target.rowingSessionId) {
      return {
        ...session,
        mocapSession: { id: target.mocapSessionId },
      };
    }

    if (session.mocapSession?.id === target.mocapSessionId) {
      return {
        ...session,
        mocapSession: null,
      };
    }

    return session;
  });
}

export function applyMocapUnlinkToSessions<T extends MocapLinkableSession>(
  sessions: T[],
  mocapSessionId: string,
): T[] {
  return sessions.map((session) =>
    session.mocapSession?.id === mocapSessionId
      ? {
          ...session,
          mocapSession: null,
        }
      : session,
  );
}

export async function confirmMocapSessionLink(
  target: MocapLinkTarget,
  fetchImpl: FetchLike = fetch,
): Promise<MocapLinkResult> {
  const response = await fetchImpl(
    `/api/mocap/sessions/${encodeURIComponent(target.mocapSessionId)}/link/${encodeURIComponent(target.rowingSessionId)}`,
    { method: "POST" },
  );

  const result = await readMocapLifecycleActionResponse(
    response,
    {
      id: target.mocapSessionId,
      rowingSessionId: target.rowingSessionId,
      analysisMode: "csv-aligned",
    },
    "Failed to link mocap session",
  );

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      message: result.message,
    };
  }

  return {
    ok: true,
    mocapSessionId: result.id,
    rowingSessionId: result.rowingSessionId ?? target.rowingSessionId,
    status: result.status,
    lifecycle: result,
  };
}

export async function confirmMocapSessionUnlink(
  mocapSessionId: string,
  fetchImpl: FetchLike = fetch,
): Promise<MocapUnlinkResult> {
  const response = await fetchImpl(
    `/api/mocap/sessions/${encodeURIComponent(mocapSessionId)}/unlink`,
    { method: "POST" },
  );

  const result = await readMocapLifecycleActionResponse(
    response,
    { id: mocapSessionId, analysisMode: "pose-segmented" },
    "Failed to unlink mocap session",
  );

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      message: result.message,
    };
  }

  return {
    ok: true,
    mocapSessionId: result.id,
    status: result.status,
    lifecycle: result,
  };
}
