export const MOCAP_RECORD_ONLY_FLAG = "record-only";

export type MocapLinkabilityReason =
  | "linked"
  | "not_ready"
  | "record_only";

export interface AssignmentMocapSession {
  id: string;
  status: string;
  rowingSessionId: string | null;
  createdAt: Date | string;
  durationSec: number;
  qualityFlags: string[];
}

export interface AssignmentRowingSession {
  id: string;
  timestamp: Date | string;
  distance: number;
  duration: number;
  avgPower: number;
  strokeCount: number;
  sourceFile?: string | null;
  mocapSession?: { id: string } | null;
}

export interface AssignmentWindow {
  startsAt: string;
  endsAt: string;
}

export interface AssignmentOverlap {
  overlaps: boolean;
  timeGapMs: number;
  timestampGapMs: number;
}

export interface ManualAssignmentCandidate {
  id: string;
  timestamp: string;
  distance: number;
  duration: number;
  avgPower: number;
  strokeCount: number;
  sourceFile: string | null;
  rowingWindow: AssignmentWindow;
  mocapWindow: AssignmentWindow;
  overlap: AssignmentOverlap;
}

export type MocapListAssignmentState =
  | {
      kind: "linked";
      label: "Linked";
      rowingSessionId: string;
      rowingSessionTimestamp: string | null;
    }
  | {
      kind: "assignable";
      label: "Ready to assign";
    }
  | {
      kind: "record-only";
      label: "No pose stream";
    }
  | {
      kind: "not-ready";
      label: "Not ready";
      status: string;
    };

export interface MocapAssignmentActionState {
  linkingRowingSessionId?: string | null;
  unlinking?: boolean;
  reanalyzing?: boolean;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: Date | string): string {
  return toDate(value).toISOString();
}

function windowGapMs(
  leftStartMs: number,
  leftEndMs: number,
  rightStartMs: number,
  rightEndMs: number,
): number {
  if (leftEndMs >= rightStartMs && rightEndMs >= leftStartMs) return 0;
  if (leftEndMs < rightStartMs) return rightStartMs - leftEndMs;
  return leftStartMs - rightEndMs;
}

export function isRecordOnlyMocapSession(
  session: Pick<AssignmentMocapSession, "qualityFlags">,
): boolean {
  return session.qualityFlags.includes(MOCAP_RECORD_ONLY_FLAG);
}

export function getMocapLinkability(
  session: AssignmentMocapSession,
):
  | { linkable: true }
  | { linkable: false; reason: MocapLinkabilityReason; message: string } {
  if (session.rowingSessionId) {
    return {
      linkable: false,
      reason: "linked",
      message: "Mocap session is already linked. Unlink it before assigning another rowing session.",
    };
  }
  if (session.status !== "ready") {
    return {
      linkable: false,
      reason: "not_ready",
      message: `Mocap session is not ready for assignment (status=${session.status}).`,
    };
  }
  if (isRecordOnlyMocapSession(session)) {
    return {
      linkable: false,
      reason: "record_only",
      message: "Record-only sessions have no pose stream and cannot be assigned.",
    };
  }
  return { linkable: true };
}

export function buildManualAssignmentCandidate(
  mocapSession: Pick<AssignmentMocapSession, "createdAt" | "durationSec">,
  rowingSession: AssignmentRowingSession,
): ManualAssignmentCandidate {
  const mocapStart = toDate(mocapSession.createdAt);
  const mocapStartMs = mocapStart.getTime();
  const mocapEndMs = mocapStartMs + mocapSession.durationSec * 1000;
  const rowingStart = toDate(rowingSession.timestamp);
  const rowingStartMs = rowingStart.getTime();
  const rowingEndMs = rowingStartMs + rowingSession.duration * 1000;

  return {
    id: rowingSession.id,
    timestamp: rowingStart.toISOString(),
    distance: rowingSession.distance,
    duration: rowingSession.duration,
    avgPower: rowingSession.avgPower,
    strokeCount: rowingSession.strokeCount,
    sourceFile: rowingSession.sourceFile ?? null,
    rowingWindow: {
      startsAt: rowingStart.toISOString(),
      endsAt: new Date(rowingEndMs).toISOString(),
    },
    mocapWindow: {
      startsAt: mocapStart.toISOString(),
      endsAt: new Date(mocapEndMs).toISOString(),
    },
    overlap: {
      overlaps: windowGapMs(mocapStartMs, mocapEndMs, rowingStartMs, rowingEndMs) === 0,
      timeGapMs: windowGapMs(mocapStartMs, mocapEndMs, rowingStartMs, rowingEndMs),
      timestampGapMs: Math.abs(rowingStartMs - mocapStartMs),
    },
  };
}

export function buildManualAssignmentCandidates(
  mocapSession: Pick<AssignmentMocapSession, "createdAt" | "durationSec">,
  rowingSessions: AssignmentRowingSession[],
): ManualAssignmentCandidate[] {
  return rowingSessions
    .filter((session) => !session.mocapSession)
    .map((session) => buildManualAssignmentCandidate(mocapSession, session))
    .sort((a, b) => a.overlap.timestampGapMs - b.overlap.timestampGapMs);
}

export function getMocapListAssignmentState(session: {
  status: string;
  rowingSessionId: string | null;
  qualityFlags: string[];
  rowingSession?: { id: string; timestamp: Date | string } | null;
}): MocapListAssignmentState {
  if (session.rowingSessionId) {
    return {
      kind: "linked",
      label: "Linked",
      rowingSessionId: session.rowingSessionId,
      rowingSessionTimestamp: session.rowingSession
        ? toIso(session.rowingSession.timestamp)
        : null,
    };
  }
  if (isRecordOnlyMocapSession(session)) {
    return { kind: "record-only", label: "No pose stream" };
  }
  if (session.status === "ready") {
    return { kind: "assignable", label: "Ready to assign" };
  }
  return { kind: "not-ready", label: "Not ready", status: session.status };
}

export function buildNonOverlapConfirmationMessage(
  candidate: ManualAssignmentCandidate,
): string {
  return [
    "This rowing session does not overlap the mocap capture window.",
    `Mocap: ${new Date(candidate.mocapWindow.startsAt).toLocaleString()} - ${new Date(candidate.mocapWindow.endsAt).toLocaleString()}.`,
    `Rowing: ${new Date(candidate.rowingWindow.startsAt).toLocaleString()} - ${new Date(candidate.rowingWindow.endsAt).toLocaleString()}.`,
    `Gap: ${formatGap(candidate.overlap.timeGapMs)}.`,
    "Assign anyway?",
  ].join("\n");
}

export function buildUnlinkConfirmationMessage(): string {
  return [
    "Unlink this rowing session from the mocap recording?",
    "The mocap analysis will revert to pose-segmented analysis and be re-analyzed before the page refreshes.",
  ].join("\n\n");
}

export function isMocapAssignmentActionBusy(
  state: MocapAssignmentActionState,
): boolean {
  return Boolean(
    state.linkingRowingSessionId ||
      state.unlinking ||
      state.reanalyzing,
  );
}

export function formatGap(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
