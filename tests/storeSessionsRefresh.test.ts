import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { useRowingStore } from "../src/lib/store";
import type { Session } from "../src/types/session";

function session(overrides: Partial<Session> & { id: string }): Session {
  return {
    timestamp: new Date("2026-05-08T14:30:00.000Z"),
    distance: 100,
    duration: 40,
    energy: 0,
    strokeCount: 10,
    avgPower: 100,
    maxPower: 120,
    wattPerKg: 0,
    avgSplit: 200,
    minSplit: 190,
    avgWork: 100,
    avgStrokeLength: 10,
    avgStrokeRate: 24,
    maxStrokeRate: 26,
    ...overrides,
    id: overrides.id,
  };
}

afterEach(() => {
  useRowingStore.setState({
    sessions: [],
    personalRecords: [],
  });
});

test("replaceSessionsInStore refreshes stale sessions and keeps linked mocap markers visible", () => {
  const existingStrokeData = [
    {
      strokeIndex: 0,
      time: 1,
      timestamp: "00:01",
      distance: 5,
      work: 10,
      power: 100,
      avgPower: 100,
      split: 200,
      avgSplit: 200,
      strokeRate: 24,
      heartRate: null,
    },
  ];

  useRowingStore.setState({
    sessions: [
      session({
        id: "stale-session",
        distance: 500,
        strokeData: existingStrokeData,
      }),
    ],
    personalRecords: [],
  });

  useRowingStore.getState().replaceSessionsInStore([
    session({
      id: "stale-session",
      distance: 500,
      strokeData: undefined,
    }),
    session({
      id: "linked-session",
      timestamp: "2026-05-08T14:30:00.000Z" as unknown as Date,
      mocapSession: { id: "mocap-1" },
    }),
  ]);

  const sessions = useRowingStore.getState().getSessions();
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].strokeData, existingStrokeData);
  assert.equal(sessions[1].id, "linked-session");
  assert.deepEqual(sessions[1].mocapSession, { id: "mocap-1" });
  assert.ok(sessions[1].timestamp instanceof Date);
});
