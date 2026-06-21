import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculatePersonalRecords,
  calculateConsistencyRecords,
  calculateSessionStats,
  checkAIAwardSuggestions,
  computeEarnedAwards,
  filterAndSortSessions,
  filterAndSortSessionsForView,
  type AIAwardSuggestion,
} from "../src/lib/rowingSessionProjections";
import type { Session } from "../src/types/session";

function session(overrides: Partial<Session> & { id: string }): Session {
  return {
    timestamp: new Date("2026-06-18T12:00:00.000Z"),
    distance: 1000,
    duration: 240,
    energy: 30,
    strokeCount: 100,
    avgPower: 180,
    maxPower: 240,
    wattPerKg: 2.4,
    avgSplit: 120,
    minSplit: 110,
    avgWork: 110,
    avgStrokeLength: 10,
    avgStrokeRate: 26,
    maxStrokeRate: 30,
    ...overrides,
    id: overrides.id,
  };
}

test("calculateSessionStats projects aggregate stats and streaks from sessions", () => {
  const stats = calculateSessionStats(
    [
      session({ id: "old", timestamp: new Date("2026-06-10T12:00:00.000Z"), avgPower: 0 }),
      session({ id: "yesterday", timestamp: new Date("2026-06-19T12:00:00.000Z"), distance: 500, duration: 100 }),
      session({ id: "today", timestamp: new Date("2026-06-20T12:00:00.000Z"), distance: 2000, duration: 500 }),
    ],
    { now: new Date("2026-06-20T20:00:00.000Z") },
  );

  assert.equal(stats.totalDistance, 3500);
  assert.equal(stats.totalTime, 840);
  assert.equal(stats.totalSessions, 3);
  assert.equal(stats.avgPower, 180);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.bestStreak, 2);
});

test("calculatePersonalRecords finds fastest exact standard-distance sessions", () => {
  const records = calculatePersonalRecords([
    session({ id: "slow-1k", distance: 1000, duration: 250, avgSplit: 125 }),
    session({ id: "fast-1k", distance: 1000, duration: 220, avgSplit: 110 }),
    session({ id: "other-distance", distance: 750, duration: 170 }),
  ]);

  assert.deepEqual(records.map((record) => record.distance), [1000]);
  assert.equal(records[0].sessionId, "fast-1k");
  assert.equal(records[0].bestTime, 220);
});

test("calculateConsistencyRecords uses persisted consistencyScore without loaded stroke data", () => {
  const records = calculateConsistencyRecords([
    session({
      id: "lean-consistency-session",
      consistencyScore: 94,
      strokeData: undefined,
    }),
  ]);

  assert.equal(records.bestScore, 94);
  assert.equal(records.bestScoreSession?.id, "lean-consistency-session");
  assert.equal(records.avgScore, 94);
  assert.equal(records.excellentCount, 1);
  assert.equal(records.totalWithData, 1);
});

test("filterAndSortSessions applies domain filters without mutating input", () => {
  const sessions = [
    session({ id: "slow", timestamp: new Date("2026-06-18T12:00:00.000Z"), distance: 500, avgSplit: 140 }),
    session({ id: "fast", timestamp: new Date("2026-06-19T12:00:00.000Z"), distance: 500, avgSplit: 110 }),
    session({ id: "long", timestamp: new Date("2026-06-20T12:00:00.000Z"), distance: 2000, avgSplit: 125 }),
  ];

  const filtered = filterAndSortSessions(sessions, {
    dateRange: {
      start: new Date("2026-06-18T00:00:00.000Z"),
      end: new Date("2026-06-19T23:59:59.999Z"),
    },
    distanceRange: { min: 500, max: 500 },
    sortBy: "pace",
    sortOrder: "asc",
  });

  assert.deepEqual(filtered.map((row) => row.id), ["fast", "slow"]);
  assert.deepEqual(sessions.map((row) => row.id), ["slow", "fast", "long"]);
});

test("filterAndSortSessionsForView projects the sessions-list view settings", () => {
  const projected = filterAndSortSessionsForView(
    [
      session({ id: "old-5k", timestamp: new Date("2026-01-01T12:00:00.000Z"), distance: 5000, avgPower: 150 }),
      session({ id: "recent-5k", timestamp: new Date("2026-06-19T12:00:00.000Z"), distance: 5000, avgPower: 200 }),
      session({ id: "recent-1k", timestamp: new Date("2026-06-18T12:00:00.000Z"), distance: 1000, avgPower: 250 }),
    ],
    {
      filters: { dateRange: "7days", distanceRange: "5000+" },
      sortConfig: { field: "power", direction: "desc" },
    },
    { now: new Date("2026-06-20T12:00:00.000Z") },
  );

  assert.deepEqual(projected.map((row) => row.id), ["recent-5k"]);
});

test("computeEarnedAwards and checkAIAwardSuggestions expose award eligibility as pure projections", () => {
  const sessions = [
    session({ id: "first", timestamp: new Date("2026-06-18T12:00:00.000Z") }),
  ];
  const earned = computeEarnedAwards(sessions, { now: new Date("2026-06-20T12:00:00.000Z") });
  const aiSuggestion: AIAwardSuggestion = {
    id: "first-kilometer",
    title: "First Kilometer",
    description: "Row a kilometer",
    status: "approved",
    rationale: "Starter goal",
    criteria: { type: "total_distance", value: 1000, comparison: "gte" },
    suggestedAt: new Date("2026-06-17T12:00:00.000Z"),
  };

  const updatedSuggestions = checkAIAwardSuggestions(sessions, [aiSuggestion]);

  assert.ok(earned.some((award) => award.awardId === "sessions-1"));
  assert.equal(updatedSuggestions[0].status, "earned");
  assert.equal(updatedSuggestions[0].earnedAt?.toISOString(), "2026-06-18T12:00:00.000Z");
  assert.equal(aiSuggestion.status, "approved");
});
