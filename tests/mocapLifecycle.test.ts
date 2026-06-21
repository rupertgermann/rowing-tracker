import assert from "node:assert/strict";
import { test } from "node:test";

import {
  finalizeMocapSessionLifecycle,
  linkMocapSessionLifecycle,
  reanalyzeMocapSessionLifecycle,
  unlinkMocapSessionLifecycle,
  type MocapLifecycleSession,
} from "../src/lib/mocap/lifecycle";

test("reanalyzeMocapSessionLifecycle keeps linked sessions csv-aligned", async () => {
  const calls: string[] = [];
  const session = makeSession({ rowingSessionId: "rowing-1" });

  const result = await reanalyzeMocapSessionLifecycle(
    {
      storage: { exists: async () => true },
      findSession: async () => session,
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        return { strokeMetricCount: 0, faultCount: 0 };
      },
      analyzeCsvAligned: async (_storage, _session, rowingSessionId) => {
        calls.push(`csv-aligned:${rowingSessionId}`);
        return { strokeMetricCount: 2, faultCount: 1 };
      },
    },
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(result, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "csv-aligned",
    strokeMetricCount: 2,
    faultCount: 1,
  });
  assert.deepEqual(calls, [
    "status:analyzing",
    "csv-aligned:rowing-1",
    "status:ready",
  ]);
});

test("reanalyzeMocapSessionLifecycle keeps unlinked sessions pose-segmented", async () => {
  const calls: string[] = [];

  const result = await reanalyzeMocapSessionLifecycle(
    {
      storage: { exists: async () => true },
      findSession: async () => makeSession(),
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        return { strokeMetricCount: 3, faultCount: 2 };
      },
      analyzeCsvAligned: async () => {
        calls.push("csv-aligned");
        return { strokeMetricCount: 0, faultCount: 0 };
      },
    },
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(result, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "pose-segmented",
    strokeMetricCount: 3,
    faultCount: 2,
  });
  assert.deepEqual(calls, [
    "status:analyzing",
    "pose-segmented",
    "status:ready",
  ]);
});

test("reanalyzeMocapSessionLifecycle rolls status back when analysis fails", async () => {
  const calls: string[] = [];

  const result = await reanalyzeMocapSessionLifecycle(
    {
      storage: { exists: async () => true },
      findSession: async () => makeSession({ rowingSessionId: "rowing-1" }),
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
      analyzePoseSegmented: async () => {
        throw new Error("should not run");
      },
      analyzeCsvAligned: async () => {
        throw new Error("analysis failed");
      },
    },
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "analysis failed",
  });
  assert.deepEqual(calls, [
    "status:analyzing",
    "status:ready",
  ]);
});

test("reanalyzeMocapSessionLifecycle rejects stale ready-to-analyzing transitions", async () => {
  const calls: string[] = [];

  const result = await reanalyzeMocapSessionLifecycle(
    {
      ...makeDeps(),
      findSession: async () => makeSession(),
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return null;
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        return { strokeMetricCount: 1, faultCount: 0 };
      },
    },
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Session no longer ready",
  });
  assert.deepEqual(calls, ["status:analyzing"]);
});

test("reanalyzeMocapSessionLifecycle documents invalid and record-only states", async () => {
  for (const status of ["capturing", "analyzing", "failed"]) {
    const result = await reanalyzeMocapSessionLifecycle(
      makeDeps({
        findSession: async () => makeSession({ status }),
      }),
      { userId: "user-1", mocapSessionId: "mocap-1" },
    );

    assert.deepEqual(result, {
      ok: false,
      status: 409,
      error: `Session not ready (status=${status})`,
    });
  }

  const recordOnly = await reanalyzeMocapSessionLifecycle(
    makeDeps({
      storage: { exists: async () => false },
      findSession: async () => makeSession({ status: "ready" }),
    }),
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(recordOnly, {
    ok: false,
    status: 409,
    error: "Cannot re-analyze a record-only session without a pose stream",
  });
});

test("finalizeMocapSessionLifecycle finalizes and analyzes before returning ready", async () => {
  const calls: string[] = [];

  const result = await finalizeMocapSessionLifecycle(
    makeFinalizeDeps({
      findSession: async () => makeSession({ status: "capturing" }),
      setCaptureFinalizationState: async (_id, state) => {
        calls.push(
          `capture:${state.status}:${state.durationSec}:${state.qualityScore}:${state.qualityFlags.join(",")}`,
        );
        return { status: state.status, durationSec: state.durationSec };
      },
      finalizePoseStream: async (_storage, poseStreamPath) => {
        calls.push(`finalize:${poseStreamPath}`);
        return { frameCount: 12, poseStreamBytes: 4096 };
      },
      analyzePoseSegmented: async (_storage, analysisSession) => {
        calls.push(`pose-segmented:${analysisSession.status}`);
        return { strokeMetricCount: 5, faultCount: 2 };
      },
      analyzeCsvAligned: async () => {
        calls.push("csv-aligned");
        return { strokeMetricCount: 0, faultCount: 0 };
      },
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      durationSec: 48,
      qualityScore: 0.8,
      qualityFlags: ["low-light"],
    },
  );

  assert.deepEqual(result, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "pose-segmented",
    durationSec: 48,
    frameCount: 12,
    poseStreamBytes: 4096,
    strokeMetricCount: 5,
    faultCount: 2,
  });
  assert.deepEqual(calls, [
    "capture:analyzing:48:0.8:low-light",
    "finalize:mocap/user-1/mocap-1/pose-stream.bin",
    "pose-segmented:analyzing",
    "status:ready",
  ]);
});

test("finalizeMocapSessionLifecycle rejects stale capturing-to-analyzing transitions", async () => {
  const calls: string[] = [];

  const result = await finalizeMocapSessionLifecycle(
    makeFinalizeDeps({
      findSession: async () => makeSession({ status: "capturing" }),
      setCaptureFinalizationState: async (_id, state) => {
        calls.push(`capture:${state.status}`);
        return null;
      },
      finalizePoseStream: async () => {
        calls.push("finalize");
        return { frameCount: 1, poseStreamBytes: 128 };
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        return { strokeMetricCount: 1, faultCount: 0 };
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      durationSec: 20,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Session no longer capturing",
  });
  assert.deepEqual(calls, ["capture:analyzing"]);
});

test("finalizeMocapSessionLifecycle refuses pose analysis for missing pose streams", async () => {
  const calls: string[] = [];

  const result = await finalizeMocapSessionLifecycle(
    makeFinalizeDeps({
      storage: { exists: async () => false },
      findSession: async () => makeSession({ status: "capturing" }),
      setCaptureFinalizationState: async (_id, state) => {
        calls.push(`capture:${state.status}`);
        return { status: state.status, durationSec: state.durationSec };
      },
      finalizePoseStream: async () => {
        calls.push("finalize");
        return { frameCount: 1, poseStreamBytes: 128 };
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        return { strokeMetricCount: 1, faultCount: 0 };
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      durationSec: 20,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Cannot analyze a record-only session without a pose stream",
  });
  assert.deepEqual(calls, []);
});

test("finalizeMocapSessionLifecycle completes record-only captures without analysis", async () => {
  const calls: string[] = [];

  const result = await finalizeMocapSessionLifecycle(
    makeFinalizeDeps({
      storage: { exists: async () => false },
      findSession: async () => makeSession({ status: "capturing" }),
      setCaptureFinalizationState: async (_id, state) => {
        calls.push(
          `capture:${state.status}:${state.durationSec}:${state.qualityFlags.join(",")}`,
        );
        return { status: state.status, durationSec: state.durationSec };
      },
      finalizePoseStream: async () => {
        calls.push("finalize");
        throw new Error("record-only should not finalize a missing pose stream");
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        throw new Error("record-only should not run pose analysis");
      },
      analyzeCsvAligned: async () => {
        calls.push("csv-aligned");
        throw new Error("record-only should not run csv-aligned analysis");
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      durationSec: 30,
      qualityFlags: ["record-only"],
      skipAnalysis: true,
    },
  );

  assert.deepEqual(result, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "record-only",
    durationSec: 30,
    frameCount: 0,
    poseStreamBytes: 0,
    strokeMetricCount: 0,
    faultCount: 0,
  });
  assert.deepEqual(calls, [
    "capture:ready:30:record-only",
  ]);
});

test("finalizeMocapSessionLifecycle restores capturing when pose-stream finalization fails", async () => {
  const calls: string[] = [];

  const result = await finalizeMocapSessionLifecycle(
    makeFinalizeDeps({
      findSession: async () => makeSession({ status: "capturing" }),
      setCaptureFinalizationState: async (_id, state) => {
        calls.push(`capture:${state.status}`);
        return { status: state.status, durationSec: state.durationSec };
      },
      finalizePoseStream: async () => {
        calls.push("finalize");
        throw new Error("Pose stream has 17 trailing bytes (corrupt)");
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        throw new Error("analysis should not run after finalize failure");
      },
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      durationSec: 42,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "Pose stream has 17 trailing bytes (corrupt)",
  });
  assert.deepEqual(calls, [
    "capture:analyzing",
    "finalize",
    "status:capturing",
  ]);
});

test("finalizeMocapSessionLifecycle restores ready when analysis fails after finalization", async () => {
  const calls: string[] = [];

  const result = await finalizeMocapSessionLifecycle(
    makeFinalizeDeps({
      findSession: async () => makeSession({ status: "capturing" }),
      setCaptureFinalizationState: async (_id, state) => {
        calls.push(`capture:${state.status}`);
        return { status: state.status, durationSec: state.durationSec };
      },
      finalizePoseStream: async () => {
        calls.push("finalize");
        return { frameCount: 8, poseStreamBytes: 2048 };
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        throw new Error("analysis failed");
      },
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      durationSec: 42,
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "analysis failed",
  });
  assert.deepEqual(calls, [
    "capture:analyzing",
    "finalize",
    "pose-segmented",
    "status:ready",
  ]);
});

test("linkMocapSessionLifecycle assigns then analyzes csv-aligned", async () => {
  const calls: string[] = [];
  const session = makeSession();

  const result = await linkMocapSessionLifecycle(
    makeDeps({
      findSession: async () => session,
      findRowingSession: async () => ({ id: "rowing-1", mocapSession: null }),
      assignMocapSession: async (_id, _userId, rowingSessionId) => {
        calls.push(`assign:${rowingSessionId}`);
        return true;
      },
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
      analyzeCsvAligned: async (_storage, analysisSession, rowingSessionId) => {
        calls.push(
          `csv-aligned:${analysisSession.rowingSessionId}:${rowingSessionId}`,
        );
        return { strokeMetricCount: 4, faultCount: 2 };
      },
      bumpSessionsRevision: async () => {
        calls.push("revision");
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      rowingSessionId: "rowing-1",
    },
  );

  assert.deepEqual(result, {
    ok: true,
    id: "mocap-1",
    rowingSessionId: "rowing-1",
    status: "ready",
    analysisMode: "csv-aligned",
    strokeMetricCount: 4,
    faultCount: 2,
  });
  assert.deepEqual(calls, [
    "assign:rowing-1",
    "csv-aligned:rowing-1:rowing-1",
    "status:ready",
    "revision",
  ]);
});

test("linkMocapSessionLifecycle rejects linked rowing session conflicts", async () => {
  const calls: string[] = [];

  const result = await linkMocapSessionLifecycle(
    makeDeps({
      findSession: async () => makeSession(),
      findRowingSession: async () => ({
        id: "rowing-1",
        mocapSession: { id: "other-mocap" },
      }),
      assignMocapSession: async () => {
        calls.push("assign");
        return true;
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      rowingSessionId: "rowing-1",
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Rowing session is already linked to another mocap session.",
  });
  assert.deepEqual(calls, []);
});

test("linkMocapSessionLifecycle rejects record-only sessions before assignment", async () => {
  const calls: string[] = [];

  const result = await linkMocapSessionLifecycle(
    makeDeps({
      storage: { exists: async () => false },
      findSession: async () => makeSession(),
      assignMocapSession: async () => {
        calls.push("assign");
        return true;
      },
      analyzeCsvAligned: async () => {
        calls.push("csv-aligned");
        return { strokeMetricCount: 1, faultCount: 0 };
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      rowingSessionId: "rowing-1",
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Cannot re-analyze a record-only session without a pose stream",
  });
  assert.deepEqual(calls, []);
});

test("linkMocapSessionLifecycle rolls assignment back when analysis fails", async () => {
  const calls: string[] = [];

  const result = await linkMocapSessionLifecycle(
    makeDeps({
      findSession: async () => makeSession(),
      findRowingSession: async () => ({ id: "rowing-1", mocapSession: null }),
      assignMocapSession: async () => {
        calls.push("assign");
        return true;
      },
      analyzeCsvAligned: async () => {
        calls.push("csv-aligned");
        throw new Error("analysis failed");
      },
      restoreMocapSessionAssignment: async (_id, rowingSessionId, status) => {
        calls.push(`restore:${rowingSessionId}:${status}`);
      },
    }),
    {
      userId: "user-1",
      mocapSessionId: "mocap-1",
      rowingSessionId: "rowing-1",
    },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "analysis failed",
  });
  assert.deepEqual(calls, [
    "assign",
    "csv-aligned",
    "restore:null:ready",
  ]);
});

test("unlinkMocapSessionLifecycle clears assignment then analyzes pose-segmented", async () => {
  const calls: string[] = [];

  const result = await unlinkMocapSessionLifecycle(
    makeDeps({
      findSession: async () => makeSession({ rowingSessionId: "rowing-1" }),
      unassignMocapSession: async (_id, _userId, rowingSessionId) => {
        calls.push(`unassign:${rowingSessionId}`);
        return true;
      },
      setStatus: async (_id, status) => {
        calls.push(`status:${status}`);
        return { status };
      },
      analyzePoseSegmented: async (_storage, analysisSession) => {
        calls.push(`pose-segmented:${analysisSession.rowingSessionId}`);
        return { strokeMetricCount: 3, faultCount: 1 };
      },
      bumpSessionsRevision: async () => {
        calls.push("revision");
      },
    }),
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(result, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "pose-segmented",
    strokeMetricCount: 3,
    faultCount: 1,
  });
  assert.deepEqual(calls, [
    "unassign:rowing-1",
    "pose-segmented:null",
    "status:ready",
    "revision",
  ]);
});

test("unlinkMocapSessionLifecycle rejects unlinked sessions", async () => {
  const calls: string[] = [];

  const result = await unlinkMocapSessionLifecycle(
    makeDeps({
      findSession: async () => makeSession(),
      unassignMocapSession: async () => {
        calls.push("unassign");
        return true;
      },
    }),
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Mocap session is not linked to a rowing session.",
  });
  assert.deepEqual(calls, []);
});

test("unlinkMocapSessionLifecycle restores assignment when analysis fails", async () => {
  const calls: string[] = [];

  const result = await unlinkMocapSessionLifecycle(
    makeDeps({
      findSession: async () => makeSession({ rowingSessionId: "rowing-1" }),
      unassignMocapSession: async () => {
        calls.push("unassign");
        return true;
      },
      analyzePoseSegmented: async () => {
        calls.push("pose-segmented");
        throw new Error("analysis failed");
      },
      restoreMocapSessionAssignment: async (_id, rowingSessionId, status) => {
        calls.push(`restore:${rowingSessionId}:${status}`);
      },
    }),
    { userId: "user-1", mocapSessionId: "mocap-1" },
  );

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "analysis failed",
  });
  assert.deepEqual(calls, [
    "unassign",
    "pose-segmented",
    "restore:rowing-1:ready",
  ]);
});

function makeSession(
  overrides: Partial<MocapLifecycleSession> = {},
): MocapLifecycleSession {
  return {
    id: "mocap-1",
    userId: "user-1",
    status: "ready",
    rowingSessionId: null,
    poseStreamPath: "mocap/user-1/mocap-1/pose-stream.bin",
    capturePerspective: "side-right",
    calibrationCatchFrame: null,
    calibrationFinishFrame: null,
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<Parameters<typeof reanalyzeMocapSessionLifecycle>[0]> = {},
): Parameters<typeof reanalyzeMocapSessionLifecycle>[0] {
  return {
    storage: { exists: async () => true },
    findSession: async () => makeSession(),
    findRowingSession: async () => ({ id: "rowing-1", mocapSession: null }),
    setStatus: async (_id, status) => ({ status }),
    assignMocapSession: async () => true,
    unassignMocapSession: async () => true,
    restoreMocapSessionAssignment: async () => {},
    bumpSessionsRevision: async () => {},
    analyzePoseSegmented: async () => ({ strokeMetricCount: 0, faultCount: 0 }),
    analyzeCsvAligned: async () => ({ strokeMetricCount: 0, faultCount: 0 }),
    ...overrides,
  };
}

function makeFinalizeDeps(
  overrides: Partial<Parameters<typeof finalizeMocapSessionLifecycle>[0]> = {},
): Parameters<typeof finalizeMocapSessionLifecycle>[0] {
  return {
    ...makeDeps(),
    findSession: async () => makeSession({ status: "capturing" }),
    finalizePoseStream: async () => ({ frameCount: 0, poseStreamBytes: 0 }),
    setCaptureFinalizationState: async (_id, state) => ({
      status: state.status,
      durationSec: state.durationSec,
    }),
    ...overrides,
  };
}
