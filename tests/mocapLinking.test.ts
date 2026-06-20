import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyMocapLinkToSessions,
  applyMocapUnlinkToSessions,
  confirmMocapSessionLink,
  confirmMocapSessionUnlink,
} from "../src/lib/mocap/linking";

test("confirmMocapSessionLink links an overlapping mocap session", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    calls.push({ input, init });
    return Response.json({ id: "mocap-1", rowingSessionId: "rowing-1", status: "ready" });
  };

  const result = await confirmMocapSessionLink(
    { mocapSessionId: "mocap-1", rowingSessionId: "rowing-1" },
    fetchImpl,
  );

  assert.deepEqual(result, {
    ok: true,
    mocapSessionId: "mocap-1",
    rowingSessionId: "rowing-1",
    status: "ready",
  });
  assert.equal(calls[0].input, "/api/mocap/sessions/mocap-1/link/rowing-1");
  assert.equal(calls[0].init?.method, "POST");
});

test("confirmMocapSessionLink reports already-linked conflicts", async () => {
  const fetchImpl = async () =>
    Response.json(
      { error: "Rowing session is already linked to another mocap session." },
      { status: 409 },
    );

  const result = await confirmMocapSessionLink(
    { mocapSessionId: "mocap-1", rowingSessionId: "rowing-1" },
    fetchImpl,
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "conflict",
    status: 409,
    message: "Rowing session is already linked to another mocap session.",
  });
});

test("confirmMocapSessionUnlink unlinks a mocap session", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    calls.push({ input, init });
    return Response.json({ id: "mocap-1", status: "ready" });
  };

  const result = await confirmMocapSessionUnlink("mocap-1", fetchImpl);

  assert.deepEqual(result, {
    ok: true,
    mocapSessionId: "mocap-1",
    status: "ready",
  });
  assert.equal(calls[0].input, "/api/mocap/sessions/mocap-1/unlink");
  assert.equal(calls[0].init?.method, "POST");
});

test("confirmMocapSessionUnlink reports analysis failures", async () => {
  const fetchImpl = async () =>
    Response.json(
      { error: "Failed to rebuild pose-segmented analysis." },
      { status: 500 },
    );

  const result = await confirmMocapSessionUnlink("mocap-1", fetchImpl);

  assert.deepEqual(result, {
    ok: false,
    reason: "analysis_failed",
    status: 500,
    message: "Failed to rebuild pose-segmented analysis.",
  });
});

test("applyMocapLinkToSessions marks the linked rowing session for the sessions screen", () => {
  const sessions = [
    { id: "rowing-1", timestamp: new Date("2026-06-20T10:00:00Z"), distance: 1000 },
    { id: "rowing-2", timestamp: new Date("2026-06-20T11:00:00Z"), distance: 2000 },
  ];

  const updated = applyMocapLinkToSessions(sessions, {
    rowingSessionId: "rowing-2",
    mocapSessionId: "mocap-1",
  });

  assert.equal(updated[0], sessions[0]);
  assert.deepEqual(updated[1], {
    ...sessions[1],
    mocapSession: { id: "mocap-1" },
  });
});

test("applyMocapUnlinkToSessions clears only the unlinked mocap session marker", () => {
  const sessions = [
    {
      id: "rowing-1",
      timestamp: new Date("2026-06-20T10:00:00Z"),
      distance: 1000,
      mocapSession: { id: "mocap-1" },
    },
    {
      id: "rowing-2",
      timestamp: new Date("2026-06-20T11:00:00Z"),
      distance: 2000,
      mocapSession: { id: "mocap-2" },
    },
  ];

  const updated = applyMocapUnlinkToSessions(sessions, "mocap-1");

  assert.deepEqual(updated[0], {
    ...sessions[0],
    mocapSession: null,
  });
  assert.equal(updated[1], sessions[1]);
});
