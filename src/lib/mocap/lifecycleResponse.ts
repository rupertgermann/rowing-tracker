import type { MocapAnalysisMode } from "@/lib/mocap/lifecycle";

export type MocapLifecycleFailureReason =
  | "analysis_failed"
  | "conflict"
  | "not_found"
  | "unauthorized"
  | "error";

export type MocapLifecycleActionResult =
  | {
      ok: true;
      id: string;
      status: string;
      analysisMode: MocapAnalysisMode;
      strokeMetricCount: number;
      faultCount: number;
      rowingSessionId?: string | null;
      durationSec?: number;
      frameCount?: number;
      poseStreamBytes?: number;
    }
  | {
      ok: false;
      reason: MocapLifecycleFailureReason;
      status: number;
      message: string;
    };

export interface MocapLifecycleResponseFallback {
  id: string;
  status?: string;
  analysisMode?: MocapAnalysisMode;
  rowingSessionId?: string | null;
}

export function failureReasonForStatus(
  status: number,
): MocapLifecycleFailureReason {
  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 500) return "analysis_failed";
  return "error";
}

export async function readMocapLifecycleActionResponse(
  response: Response,
  fallback: MocapLifecycleResponseFallback,
  errorFallback: string,
): Promise<MocapLifecycleActionResult> {
  const data = await readJson(response);

  if (!response.ok) {
    return {
      ok: false,
      reason: failureReasonForStatus(response.status),
      status: response.status,
      message: readErrorMessage(data, errorFallback),
    };
  }

  return projectMocapLifecycleActionPayload(data, fallback);
}

export function projectMocapLifecycleActionPayload(
  data: unknown,
  fallback: MocapLifecycleResponseFallback,
): Extract<MocapLifecycleActionResult, { ok: true }> {
  const record = isRecord(data) ? data : {};
  return {
    ok: true,
    id: optionalString(record.id) ?? fallback.id,
    status: optionalString(record.status) ?? fallback.status ?? "ready",
    analysisMode:
      parseAnalysisMode(record.analysisMode) ??
      fallback.analysisMode ??
      "pose-segmented",
    strokeMetricCount: optionalNumber(record.strokeMetricCount) ?? 0,
    faultCount: optionalNumber(record.faultCount) ?? 0,
    rowingSessionId:
      optionalString(record.rowingSessionId) ?? fallback.rowingSessionId,
    durationSec: optionalNumber(record.durationSec),
    frameCount: optionalNumber(record.frameCount),
    poseStreamBytes: optionalNumber(record.poseStreamBytes),
  };
}

function readErrorMessage(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;
  if (typeof data.error === "string") return data.error;
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseAnalysisMode(value: unknown): MocapAnalysisMode | undefined {
  return value === "pose-segmented" ||
    value === "csv-aligned" ||
    value === "record-only"
    ? value
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
