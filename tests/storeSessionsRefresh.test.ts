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

function stroke(overrides: Partial<NonNullable<Session["strokeData"]>[number]> = {}) {
  return {
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
    ...overrides,
  };
}

afterEach(() => {
  useRowingStore.setState({
    sessions: [],
    personalRecords: [],
    earnedAwards: [],
    aiAwardSuggestions: [],
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

test("updateSessionsInStore keeps linked mocap markers visible when saved ZIP rows omit them", () => {
  useRowingStore.setState({
    sessions: [
      session({
        id: "linked-session",
        mocapSession: { id: "mocap-1" },
      }),
    ],
    personalRecords: [],
  });

  useRowingStore.getState().updateSessionsInStore([
    session({
      id: "linked-session",
      avgPower: 140,
      mocapSession: undefined,
    }),
  ]);

  const [updated] = useRowingStore.getState().getSessions();
  assert.equal(updated.avgPower, 140);
  assert.deepEqual(updated.mocapSession, { id: "mocap-1" });
});

test("updateSessionInStore projects added stroke data and refreshes derived PR state", () => {
  const targetSession = session({
    id: "target-session",
    distance: 1000,
    duration: 220,
    avgSplit: 110,
  });
  const slowerSession = session({
    id: "slower-session",
    distance: 1000,
    duration: 250,
    avgSplit: 125,
  });
  const strokes = [stroke(), stroke({ strokeIndex: 1, distance: 10 })];

  useRowingStore.setState({
    sessions: [targetSession, slowerSession],
    personalRecords: [],
  });

  useRowingStore.getState().updateSessionInStore({
    ...targetSession,
    timestamp: targetSession.timestamp.toISOString() as unknown as Date,
    strokeData: strokes,
    strokeDataCount: strokes.length,
    consistencyScore: 90,
  });

  const state = useRowingStore.getState();
  const updated = state.getSessionById("target-session");

  assert.equal(updated?.strokeData, strokes);
  assert.equal(updated?.strokeDataCount, 2);
  assert.equal(updated?.consistencyScore, 90);
  assert.ok(updated?.timestamp instanceof Date);
  assert.equal(state.getPersonalRecords().length, 1);
  assert.equal(state.getPersonalRecords()[0].sessionId, "target-session");
});

test("updateSessionInStore projects cleared stroke data without changing summary fields", () => {
  const original = session({
    id: "session-to-clear",
    distance: 2000,
    duration: 480,
    avgPower: 210,
    strokeData: [stroke()],
    strokeDataCount: 1,
    consistencyScore: 85,
  });

  useRowingStore.setState({
    sessions: [original],
    personalRecords: [],
  });

  useRowingStore.getState().updateSessionInStore({
    ...original,
    strokeData: undefined,
    strokeDataCount: 0,
    consistencyScore: null,
  });

  const updated = useRowingStore.getState().getSessionById("session-to-clear");

  assert.equal(updated?.distance, 2000);
  assert.equal(updated?.duration, 480);
  assert.equal(updated?.avgPower, 210);
  assert.equal(updated?.strokeData, undefined);
  assert.equal(updated?.strokeDataCount, 0);
  assert.equal(updated?.consistencyScore, null);
  assert.equal(useRowingStore.getState().getPersonalRecords()[0].sessionId, "session-to-clear");
});

test("removeSessionFromStore projects deletion and refreshes derived PR state", () => {
  const deletedBestSession = session({
    id: "deleted-best-session",
    distance: 1000,
    duration: 220,
    avgSplit: 110,
  });
  const remainingSession = session({
    id: "remaining-session",
    distance: 1000,
    duration: 250,
    avgSplit: 125,
  });

  useRowingStore.setState({
    sessions: [deletedBestSession, remainingSession],
    personalRecords: [
      {
        distance: 1000,
        bestTime: 220,
        bestPace: 110,
        date: deletedBestSession.timestamp,
        avgPower: deletedBestSession.avgPower,
        sessionId: deletedBestSession.id,
      },
    ],
  });

  useRowingStore.getState().removeSessionFromStore("deleted-best-session");

  const state = useRowingStore.getState();

  assert.equal(state.getSessions().length, 1);
  assert.equal(state.getSessions()[0].id, "remaining-session");
  assert.equal(state.getSessionById("deleted-best-session"), undefined);
  assert.equal(state.getPersonalRecords().length, 1);
  assert.equal(state.getPersonalRecords()[0].sessionId, "remaining-session");
  assert.equal(state.getPersonalRecords()[0].bestTime, 250);
});
