import assert from "node:assert/strict";
import { test } from "node:test";

import { readMocapLifecycleActionResponse } from "../src/lib/mocap/lifecycleResponse";

test("lifecycle response projection reads reanalysis success payloads", async () => {
  const result = await readMocapLifecycleActionResponse(
    Response.json({
      ok: true,
      id: "mocap-1",
      status: "ready",
      analysisMode: "pose-segmented",
      strokeMetricCount: 3,
      faultCount: 1,
    }),
    { id: "fallback" },
    "Failed",
  );

  assert.deepEqual(result, {
    ok: true,
    id: "mocap-1",
    status: "ready",
    analysisMode: "pose-segmented",
    strokeMetricCount: 3,
    faultCount: 1,
    rowingSessionId: undefined,
    durationSec: undefined,
    frameCount: undefined,
    poseStreamBytes: undefined,
  });
});

test("lifecycle response projection reads link and unlink success payloads", async () => {
  const link = await readMocapLifecycleActionResponse(
    Response.json({
      ok: true,
      id: "mocap-1",
      rowingSessionId: "rowing-1",
      status: "ready",
      analysisMode: "csv-aligned",
      strokeMetricCount: 4,
      faultCount: 2,
    }),
    { id: "mocap-1", rowingSessionId: "rowing-fallback" },
    "Failed",
  );

  const unlink = await readMocapLifecycleActionResponse(
    Response.json({
      ok: true,
      id: "mocap-1",
      status: "ready",
      analysisMode: "pose-segmented",
      strokeMetricCount: 5,
      faultCount: 0,
    }),
    { id: "mocap-1" },
    "Failed",
  );

  assert.equal(link.ok, true);
  assert.equal(link.ok && link.rowingSessionId, "rowing-1");
  assert.equal(link.ok && link.analysisMode, "csv-aligned");
  assert.equal(unlink.ok, true);
  assert.equal(unlink.ok && unlink.analysisMode, "pose-segmented");
  assert.equal(unlink.ok && unlink.strokeMetricCount, 5);
});

test("lifecycle response projection reads finalize success payloads", async () => {
  const result = await readMocapLifecycleActionResponse(
    Response.json({
      ok: true,
      id: "mocap-1",
      status: "ready",
      analysisMode: "record-only",
      durationSec: 42,
      frameCount: 0,
      poseStreamBytes: 32,
      strokeMetricCount: 0,
      faultCount: 0,
    }),
    { id: "mocap-1" },
    "Failed",
  );

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.analysisMode, "record-only");
  assert.equal(result.ok && result.durationSec, 42);
  assert.equal(result.ok && result.frameCount, 0);
  assert.equal(result.ok && result.poseStreamBytes, 32);
});

test("lifecycle response projection maps failure status and message", async () => {
  const result = await readMocapLifecycleActionResponse(
    Response.json(
      { ok: false, error: "Session no longer ready" },
      { status: 409 },
    ),
    { id: "mocap-1" },
    "Failed",
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "conflict",
    status: 409,
    message: "Session no longer ready",
  });
});
