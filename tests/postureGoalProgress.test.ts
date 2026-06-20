import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computePostureGoalProgress,
} from "../src/lib/postureGoalProgress.js";
import type { SessionFaultInput } from "../src/lib/mocap/postureTrendAggregation.js";

function makeSession(overrides: Partial<SessionFaultInput> = {}): SessionFaultInput {
  return {
    sessionId: "sess-1",
    sessionDate: new Date("2025-01-01"),
    qualityScore: 0.9,
    qualityFlags: [],
    faults: [],
    strokeCount: 20,
    ...overrides,
  };
}

describe("computePostureGoalProgress — no sessions", () => {
  test("empty sessions → currentRate 0, not achieved", () => {
    const result = computePostureGoalProgress([], "excessive_layback", 0.1);
    assert.equal(result.currentRate, 0);
    assert.equal(result.totalFaults, 0);
    assert.equal(result.totalStrokes, 0);
    assert.equal(result.linkedMocapSessionCount, 0);
    assert.equal(result.achieved, false);
  });
});

describe("computePostureGoalProgress — single session", () => {
  test("session with zero strokes → rate 0", () => {
    const result = computePostureGoalProgress(
      [makeSession({ strokeCount: 0, faults: [{ faultType: "excessive_layback", severity: "warning" }] })],
      "excessive_layback",
      0.1,
    );
    assert.equal(result.currentRate, 0);
    assert.equal(result.totalStrokes, 0);
  });

  test("counts only matching fault type", () => {
    const result = computePostureGoalProgress(
      [
        makeSession({
          strokeCount: 10,
          faults: [
            { faultType: "excessive_layback", severity: "warning" },
            { faultType: "early_arm_bend", severity: "info" },
            { faultType: "excessive_layback", severity: "critical" },
          ],
        }),
      ],
      "excessive_layback",
      0.1,
    );
    assert.equal(result.totalFaults, 2);
    assert.ok(Math.abs(result.currentRate - 2 / 10) < 0.001);
  });

  test("goal achieved when currentRate ≤ targetRate", () => {
    const result = computePostureGoalProgress(
      [makeSession({ strokeCount: 10, faults: [{ faultType: "excessive_layback", severity: "info" }] })],
      "excessive_layback",
      0.2,
    );
    // rate = 1/10 = 0.1, target = 0.2 → achieved
    assert.equal(result.achieved, true);
  });

  test("goal not achieved when currentRate > targetRate", () => {
    const result = computePostureGoalProgress(
      [makeSession({ strokeCount: 10, faults: [
        { faultType: "excessive_layback", severity: "warning" },
        { faultType: "excessive_layback", severity: "warning" },
        { faultType: "excessive_layback", severity: "warning" },
      ] })],
      "excessive_layback",
      0.2,
    );
    // rate = 3/10 = 0.3, target = 0.2 → not achieved
    assert.equal(result.achieved, false);
  });

  test("goal achieved exactly at boundary (rate === target)", () => {
    const result = computePostureGoalProgress(
      [makeSession({ strokeCount: 10, faults: [
        { faultType: "excessive_layback", severity: "warning" },
        { faultType: "excessive_layback", severity: "warning" },
      ] })],
      "excessive_layback",
      0.2,
    );
    // rate = 2/10 = 0.2, target = 0.2 → achieved (≤)
    assert.equal(result.achieved, true);
  });
});

describe("computePostureGoalProgress — multiple sessions", () => {
  const sessions: SessionFaultInput[] = [
    makeSession({
      sessionId: "a",
      strokeCount: 20,
      faults: [
        { faultType: "rounded_back_at_catch", severity: "warning" },
        { faultType: "rounded_back_at_catch", severity: "warning" },
        { faultType: "excessive_layback", severity: "info" },
      ],
    }),
    makeSession({
      sessionId: "b",
      strokeCount: 10,
      faults: [
        { faultType: "rounded_back_at_catch", severity: "critical" },
      ],
    }),
    makeSession({
      sessionId: "c",
      strokeCount: 15,
      faults: [],
    }),
  ];

  test("accumulates faults and strokes across sessions", () => {
    const result = computePostureGoalProgress(sessions, "rounded_back_at_catch", 0.1);
    assert.equal(result.totalFaults, 3);
    assert.equal(result.totalStrokes, 45);
    assert.equal(result.linkedMocapSessionCount, 3);
    assert.ok(Math.abs(result.currentRate - 3 / 45) < 0.001);
  });

  test("session with no matching faults contributes 0 faults but full stroke count", () => {
    const result = computePostureGoalProgress(sessions, "early_arm_bend", 0.05);
    assert.equal(result.totalFaults, 0);
    assert.equal(result.totalStrokes, 45);
    assert.equal(result.currentRate, 0);
    assert.equal(result.achieved, true);
  });

  test("returns correct faultType in result", () => {
    const result = computePostureGoalProgress(sessions, "rounded_back_at_catch", 0.1);
    assert.equal(result.faultType, "rounded_back_at_catch");
    assert.equal(result.targetRate, 0.1);
  });
});
