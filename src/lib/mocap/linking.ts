export interface MocapLinkTarget {
  rowingSessionId: string;
  mocapSessionId: string;
}

export type MocapLinkFailureReason =
  | "analysis_failed"
  | "conflict"
  | "not_found"
  | "unauthorized"
  | "error";

export type MocapLinkResult =
  | {
      ok: true;
      mocapSessionId: string;
      rowingSessionId: string;
      status: string;
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
    }
  | {
      ok: false;
      reason: MocapLinkFailureReason;
      status: number;
      message: string;
    };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

function failureReasonForStatus(status: number): MocapLinkFailureReason {
  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 500) return "analysis_failed";
  return "error";
}

export async function confirmMocapSessionLink(
  target: MocapLinkTarget,
  fetchImpl: FetchLike = fetch,
): Promise<MocapLinkResult> {
  const response = await fetchImpl(
    `/api/mocap/sessions/${encodeURIComponent(target.mocapSessionId)}/link/${encodeURIComponent(target.rowingSessionId)}`,
    { method: "POST" },
  );

  if (!response.ok) {
    return {
      ok: false,
      reason: failureReasonForStatus(response.status),
      status: response.status,
      message: await readErrorMessage(response, "Failed to link mocap session"),
    };
  }

  const data = await response.json();
  return {
    ok: true,
    mocapSessionId: typeof data?.id === "string" ? data.id : target.mocapSessionId,
    rowingSessionId:
      typeof data?.rowingSessionId === "string" ? data.rowingSessionId : target.rowingSessionId,
    status: typeof data?.status === "string" ? data.status : "ready",
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

  if (!response.ok) {
    return {
      ok: false,
      reason: failureReasonForStatus(response.status),
      status: response.status,
      message: await readErrorMessage(response, "Failed to unlink mocap session"),
    };
  }

  const data = await response.json();
  return {
    ok: true,
    mocapSessionId: typeof data?.id === "string" ? data.id : mocapSessionId,
    status: typeof data?.status === "string" ? data.status : "ready",
  };
}
