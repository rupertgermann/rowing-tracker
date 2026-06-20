import assert from "node:assert/strict";
import { test } from "node:test";

import {
  reanalyzeMocapSessionLifecycle,
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
