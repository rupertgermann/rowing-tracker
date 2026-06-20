import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  aggregatePostureTrend,
  isLowQuality,
  LOW_QUALITY_SCORE_THRESHOLD,
  type SessionFaultInput,
} from "../src/lib/mocap/postureTrendAggregation.js";

function makeSession(overrides: Partial<SessionFaultInput> = {}): SessionFaultInput {
  return {
    sessionId: "sess-1",
    sessionDate: new Date("2025-01-01"),
    qualityScore: 0.9,
    qualityFlags: [],
    faults: [],
    strokeCount: 10,
    ...overrides,
  };
}

describe("isLowQuality", () => {
  test("high quality score, no flags → not low quality", () => {
    assert.equal(isLowQuality({ qualityScore: 0.9, qualityFlags: [] }), false);
  });

  test("score below threshold → low quality", () => {
    assert.equal(
      isLowQuality({ qualityScore: LOW_QUALITY_SCORE_THRESHOLD - 0.01, qualityFlags: [] }),
      true,
    );
  });

  test("score exactly at threshold → not low quality", () => {
    assert.equal(
      isLowQuality({ qualityScore: LOW_QUALITY_SCORE_THRESHOLD, qualityFlags: [] }),
      false,
    );
  });

  test("null score, no flags → not low quality", () => {
    assert.equal(isLowQuality({ qualityScore: null, qualityFlags: [] }), false);
  });

  test("null score, has flags → low quality", () => {
    assert.equal(isLowQuality({ qualityScore: null, qualityFlags: ["occlusion"] }), true);
  });

  test("good score + flags → low quality (flags override)", () => {
    assert.equal(isLowQuality({ qualityScore: 0.95, qualityFlags: ["blur"] }), true);
  });
});

describe("aggregatePostureTrend — empty input", () => {
  test("no sessions → empty trends", () => {
    const result = aggregatePostureTrend([]);
    assert.equal(result.totalSessions, 0);
    assert.equal(result.linkedSessionsWithFaults, 0);
    assert.deepEqual(result.trends, []);
  });
});

describe("aggregatePostureTrend — single session", () => {
  test("session with no faults → no trends", () => {
    const result = aggregatePostureTrend([makeSession({ faults: [] })]);
    assert.equal(result.totalSessions, 1);
    assert.equal(result.linkedSessionsWithFaults, 0);
    assert.equal(result.trends.length, 0);
  });

  test("session with one fault type → one trend with one point", () => {
    const result = aggregatePostureTrend([
      makeSession({
        faults: [
          { faultType: "rounded_back_at_catch", severity: "warning" },
          { faultType: "rounded_back_at_catch", severity: "critical" },
        ],
        strokeCount: 20,
      }),
    ]);
    assert.equal(result.trends.length, 1);
    assert.equal(result.trends[0].faultType, "rounded_back_at_catch");
    assert.equal(result.trends[0].points.length, 1);
    const pt = result.trends[0].points[0];
    assert.equal(pt.count, 2);
    assert.equal(pt.severityCounts.warning, 1);
    assert.equal(pt.severityCounts.critical, 1);
    assert.equal(pt.severityCounts.info, 0);
    assert.ok(Math.abs(pt.rate - 2 / 20) < 0.001);
  });
});

describe("aggregatePostureTrend — multiple sessions", () => {
  const sessions: SessionFaultInput[] = [
    makeSession({
      sessionId: "a",
      sessionDate: new Date("2025-03-01"),
      faults: [
        { faultType: "excessive_layback", severity: "warning" },
        { faultType: "early_arm_bend", severity: "info" },
      ],
      strokeCount: 10,
    }),
    makeSession({
      sessionId: "b",
      sessionDate: new Date("2025-03-15"),
      faults: [
        { faultType: "excessive_layback", severity: "critical" },
        { faultType: "excessive_layback", severity: "warning" },
        { faultType: "slow_recovery_ratio", severity: "warning" },
      ],
      strokeCount: 15,
    }),
    makeSession({
      sessionId: "c",
      sessionDate: new Date("2025-04-01"),
      faults: [],
      strokeCount: 12,
    }),
  ];

  test("counts sessions and fault sessions correctly", () => {
    const result = aggregatePostureTrend(sessions);
    assert.equal(result.totalSessions, 3);
    assert.equal(result.linkedSessionsWithFaults, 2);
  });

  test("produces correct number of fault type trends", () => {
    const result = aggregatePostureTrend(sessions);
    const types = result.trends.map((t) => t.faultType).sort();
    assert.deepEqual(types, ["early_arm_bend", "excessive_layback", "slow_recovery_ratio"]);
  });

  test("excessive_layback has two points in chronological order", () => {
    const result = aggregatePostureTrend(sessions);
    const layback = result.trends.find((t) => t.faultType === "excessive_layback");
    assert.ok(layback);
    assert.equal(layback.points.length, 2);
    assert.equal(layback.points[0].date, "2025-03-01");
    assert.equal(layback.points[0].count, 1);
    assert.equal(layback.points[1].date, "2025-03-15");
    assert.equal(layback.points[1].count, 2);
    assert.equal(layback.points[1].severityCounts.critical, 1);
    assert.equal(layback.points[1].severityCounts.warning, 1);
  });

  test("early_arm_bend only appears in first session", () => {
    const result = aggregatePostureTrend(sessions);
    const arm = result.trends.find((t) => t.faultType === "early_arm_bend");
    assert.ok(arm);
    assert.equal(arm.points.length, 1);
    assert.equal(arm.points[0].severityCounts.info, 1);
  });

  test("session without faults contributes no point for any fault type", () => {
    const result = aggregatePostureTrend(sessions);
    for (const trend of result.trends) {
      assert.ok(
        !trend.points.some((p) => p.sessionId === "c"),
        `session c should not appear in trend for ${trend.faultType}`,
      );
    }
  });

  test("trends are sorted alphabetically by fault type", () => {
    const result = aggregatePostureTrend(sessions);
    const types = result.trends.map((t) => t.faultType);
    assert.deepEqual(types, [...types].sort());
  });
});

describe("aggregatePostureTrend — quality marking", () => {
  test("low quality score session marked on its fault points", () => {
    const result = aggregatePostureTrend([
      makeSession({
        qualityScore: 0.2,
        faults: [{ faultType: "rounded_back_at_catch", severity: "warning" }],
      }),
    ]);
    assert.equal(result.trends[0].points[0].lowQuality, true);
  });

  test("quality flags session marked on its fault points", () => {
    const result = aggregatePostureTrend([
      makeSession({
        qualityFlags: ["partial_occlusion"],
        faults: [{ faultType: "excessive_layback", severity: "info" }],
      }),
    ]);
    const pt = result.trends[0].points[0];
    assert.equal(pt.lowQuality, true);
    assert.deepEqual(pt.qualityFlags, ["partial_occlusion"]);
  });

  test("good quality session is not marked low quality", () => {
    const result = aggregatePostureTrend([
      makeSession({
        qualityScore: 0.95,
        qualityFlags: [],
        faults: [{ faultType: "slow_recovery_ratio", severity: "warning" }],
      }),
    ]);
    assert.equal(result.trends[0].points[0].lowQuality, false);
  });
});

describe("aggregatePostureTrend — rate calculation", () => {
  test("rate = count / strokeCount", () => {
    const result = aggregatePostureTrend([
      makeSession({
        faults: [
          { faultType: "slow_recovery_ratio", severity: "warning" },
          { faultType: "slow_recovery_ratio", severity: "critical" },
        ],
        strokeCount: 8,
      }),
    ]);
    const pt = result.trends[0].points[0];
    assert.ok(Math.abs(pt.rate - 2 / 8) < 0.001);
  });

  test("zero strokeCount → rate is 0", () => {
    const result = aggregatePostureTrend([
      makeSession({
        faults: [{ faultType: "early_arm_bend", severity: "info" }],
        strokeCount: 0,
      }),
    ]);
    assert.equal(result.trends[0].points[0].rate, 0);
  });
});
