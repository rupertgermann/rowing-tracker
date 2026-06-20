import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildManualAssignmentCandidates,
  buildNonOverlapConfirmationMessage,
  getMocapLinkability,
  getMocapListAssignmentState,
  isMocapAssignmentActionBusy,
} from "../src/lib/mocap/assignment";

const mocapSession = {
  id: "mocap-1",
  status: "ready",
  rowingSessionId: null,
  createdAt: "2026-06-20T10:00:00.000Z",
  durationSec: 60,
  qualityFlags: [],
};

test("manual assignment candidates exclude linked rowing sessions and sort by closest timestamp", () => {
  const candidates = buildManualAssignmentCandidates(mocapSession, [
    {
      id: "rowing-far",
      timestamp: "2026-06-20T10:05:00.000Z",
      distance: 1000,
      duration: 240,
      avgPower: 180,
      strokeCount: 96,
      sourceFile: "far.csv",
      mocapSession: null,
    },
    {
      id: "rowing-linked",
      timestamp: "2026-06-20T10:00:05.000Z",
      distance: 1000,
      duration: 240,
      avgPower: 200,
      strokeCount: 98,
      sourceFile: "linked.csv",
      mocapSession: { id: "other-mocap" },
    },
    {
      id: "rowing-overlap",
      timestamp: "2026-06-20T10:00:20.000Z",
      distance: 500,
      duration: 120,
      avgPower: 210,
      strokeCount: 48,
      sourceFile: null,
      mocapSession: null,
    },
  ]);

  assert.deepEqual(
    candidates.map((candidate) => candidate.id),
    ["rowing-overlap", "rowing-far"],
  );
  assert.equal(candidates[0].overlap.overlaps, true);
  assert.equal(candidates[0].overlap.timeGapMs, 0);
  assert.equal(candidates[1].overlap.overlaps, false);
  assert.equal(candidates[1].overlap.timeGapMs, 240_000);
});

test("mocap linkability reports explicit non-linkable states", () => {
  assert.deepEqual(getMocapLinkability(mocapSession), { linkable: true });
  assert.deepEqual(
    getMocapLinkability({ ...mocapSession, rowingSessionId: "rowing-1" }),
    {
      linkable: false,
      reason: "linked",
      message:
        "Mocap session is already linked. Unlink it before assigning another rowing session.",
    },
  );
  assert.deepEqual(
    getMocapLinkability({ ...mocapSession, qualityFlags: ["record-only"] }),
    {
      linkable: false,
      reason: "record_only",
      message: "Record-only sessions have no pose stream and cannot be assigned.",
    },
  );
  assert.deepEqual(
    getMocapLinkability({ ...mocapSession, status: "analyzing" }),
    {
      linkable: false,
      reason: "not_ready",
      message: "Mocap session is not ready for assignment (status=analyzing).",
    },
  );
});

test("mocap list assignment state distinguishes linked, assignable, and record-only", () => {
  assert.deepEqual(
    getMocapListAssignmentState({
      status: "ready",
      rowingSessionId: "rowing-1",
      qualityFlags: [],
      rowingSession: {
        id: "rowing-1",
        timestamp: "2026-06-20T10:00:00.000Z",
      },
    }),
    {
      kind: "linked",
      label: "Linked",
      rowingSessionId: "rowing-1",
      rowingSessionTimestamp: "2026-06-20T10:00:00.000Z",
    },
  );
  assert.deepEqual(
    getMocapListAssignmentState({
      status: "ready",
      rowingSessionId: null,
      qualityFlags: [],
    }),
    { kind: "assignable", label: "Ready to assign" },
  );
  assert.deepEqual(
    getMocapListAssignmentState({
      status: "ready",
      rowingSessionId: null,
      qualityFlags: ["record-only"],
    }),
    { kind: "record-only", label: "No pose stream" },
  );
});

test("non-overlap confirmation explains the time gap before assignment", () => {
  const candidates = buildManualAssignmentCandidates(mocapSession, [
    {
      id: "rowing-far",
      timestamp: "2026-06-20T10:05:00.000Z",
      distance: 1000,
      duration: 240,
      avgPower: 180,
      strokeCount: 96,
      mocapSession: null,
    },
  ]);
  const candidate = candidates[0];
  assert.ok(candidate);

  const message = buildNonOverlapConfirmationMessage(candidate);

  assert.match(message, /does not overlap/);
  assert.match(message, /Gap: 4m 0s/);
  assert.match(message, /Assign anyway\?/);
});

test("assignment action busy state covers link, unlink, and reanalysis", () => {
  assert.equal(isMocapAssignmentActionBusy({}), false);
  assert.equal(
    isMocapAssignmentActionBusy({ linkingRowingSessionId: "rowing-1" }),
    true,
  );
  assert.equal(isMocapAssignmentActionBusy({ unlinking: true }), true);
  assert.equal(isMocapAssignmentActionBusy({ reanalyzing: true }), true);
});
