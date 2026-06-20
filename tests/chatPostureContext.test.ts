import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildPostureAIPayload,
  buildMocapCoachContext,
  assertNoKeypointsInPayload,
} from "../src/lib/mocap/aiPayload.js";

// Fixtures mirroring what the server aggregates from linked MocapSessions
const LINKED_FAULTS = [
  { faultType: "rounded_back_at_catch", severity: "warning" },
  { faultType: "excessive_layback", severity: "critical" },
  { faultType: "arm_bend_at_finish", severity: "info" },
];

const LINKED_METRICS = [
  {
    strokeIndex: 0,
    segmentationSource: "pose-segmented",
    metricsJson: {
      backAngleAtCatchDeg: 30,
      laybackAngleDeg: 42,
      recoveryDriveRatio: 2.0,
    },
  },
  {
    strokeIndex: 1,
    segmentationSource: "pose-segmented",
    metricsJson: {
      backAngleAtCatchDeg: 28,
      laybackAngleDeg: 39,
      recoveryDriveRatio: 2.2,
    },
  },
];

describe("chat posture context – payload construction", () => {
  test("cloud AI disabled → null (Tier 1 hard-wall)", () => {
    const result = buildPostureAIPayload(
      LINKED_FAULTS,
      LINKED_METRICS,
      [],
      null,
      { cloudAIEnabled: false, mocapDetailedAIShare: true },
    );
    assert.equal(result, null);
  });

  test("cloud enabled, detailed share off → Tier 3 fault summary only", () => {
    const result = buildPostureAIPayload(
      LINKED_FAULTS,
      LINKED_METRICS,
      ["low_quality"],
      0.72,
      { cloudAIEnabled: true, mocapDetailedAIShare: false },
    );
    assert.ok(result !== null);
    assert.equal(result.tier, 3);
    assert.equal(result.strokeMetrics, undefined);
    assert.equal(result.faultSummary.totalFaults, 3);
    assert.equal(result.faultSummary.severityCounts.warning, 1);
    assert.equal(result.faultSummary.severityCounts.critical, 1);
    assert.equal(result.faultSummary.severityCounts.info, 1);
    assert.deepEqual(result.faultSummary.qualityFlags, ["low_quality"]);
    assert.equal(result.faultSummary.sessionQualityScore, 0.72);
  });

  test("cloud enabled, detailed share on → Tier 2 includes per-stroke metrics", () => {
    const result = buildPostureAIPayload(
      LINKED_FAULTS,
      LINKED_METRICS,
      [],
      null,
      { cloudAIEnabled: true, mocapDetailedAIShare: true },
    );
    assert.ok(result !== null);
    assert.equal(result.tier, 2);
    assert.ok(Array.isArray(result.strokeMetrics));
    assert.equal(result.strokeMetrics!.length, 2);
    assert.equal(result.strokeMetrics![0].backAngleAtCatchDeg, 30);
    assert.equal(result.strokeMetrics![1].laybackAngleDeg, 39);
  });

  test("no linked sessions → empty payload is still valid structure", () => {
    const result = buildPostureAIPayload([], [], [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: false,
    });
    assert.ok(result !== null);
    assert.equal(result.faultSummary.totalFaults, 0);
    assert.deepEqual(result.faultSummary.qualityFlags, []);
    assert.equal(result.faultSummary.sessionQualityScore, null);
  });
});

describe("chat posture context – AI Coach mocap tool context", () => {
  test("cloud enabled, detailed share off → session summaries without stroke metrics", () => {
    const result = buildMocapCoachContext(
      [
        {
          id: "mocap-1",
          rowingSessionId: "rowing-1",
          createdAt: new Date("2026-05-08T10:00:00.000Z"),
          source: "browser",
          capturePerspective: "side-left",
          qualityFlags: ["low_confidence"],
          qualityScore: 0.82,
          faults: LINKED_FAULTS,
          metrics: LINKED_METRICS,
        },
      ],
      {
        cloudAIEnabled: true,
        mocapDetailedAIShare: false,
        includeStrokeMetrics: true,
      },
    );

    assert.ok(result !== null);
    assert.equal(result.tier, 3);
    assert.equal(result.sessionCount, 1);
    assert.equal(result.sessions[0].mocapSessionId, "mocap-1");
    assert.equal(result.sessions[0].rowingSessionId, "rowing-1");
    assert.equal(result.sessions[0].faultSummary.totalFaults, 3);
    assert.equal(result.sessions[0].strokeMetrics, undefined);
    assert.equal(result.privacy.rawPoseIncluded, false);
    assert.equal(result.privacy.videoIncluded, false);
    assert.equal(result.privacy.detailedMetricsIncluded, false);
    assertNoKeypointsInPayload(result);
  });

  test("cloud enabled, detailed share on and requested → session summaries include scalar metrics", () => {
    const result = buildMocapCoachContext(
      [
        {
          id: "mocap-1",
          rowingSessionId: null,
          createdAt: "2026-05-08T10:00:00.000Z",
          source: "sidecar",
          capturePerspective: "sidecar-3d",
          qualityFlags: [],
          qualityScore: null,
          faults: LINKED_FAULTS,
          metrics: LINKED_METRICS,
        },
      ],
      {
        cloudAIEnabled: true,
        mocapDetailedAIShare: true,
        includeStrokeMetrics: true,
      },
    );

    assert.ok(result !== null);
    assert.equal(result.tier, 2);
    assert.equal(result.sessions[0].strokeMetrics?.length, 2);
    assert.equal(result.sessions[0].strokeMetrics?.[0].backAngleAtCatchDeg, 30);
    assert.equal(result.privacy.detailedMetricsIncluded, true);
    assertNoKeypointsInPayload(result);
  });

  test("cloud disabled → no mocap context leaves the app", () => {
    const result = buildMocapCoachContext(
      [
        {
          id: "mocap-1",
          rowingSessionId: "rowing-1",
          createdAt: "2026-05-08T10:00:00.000Z",
          source: "browser",
          capturePerspective: "side-left",
          qualityFlags: [],
          qualityScore: null,
          faults: LINKED_FAULTS,
          metrics: LINKED_METRICS,
        },
      ],
      {
        cloudAIEnabled: false,
        mocapDetailedAIShare: true,
        includeStrokeMetrics: true,
      },
    );

    assert.equal(result, null);
  });
});

describe("chat posture context – raw keypoint hard guard", () => {
  test("Tier 3 chat payload passes guard", () => {
    const payload = buildPostureAIPayload(
      LINKED_FAULTS,
      LINKED_METRICS,
      [],
      null,
      { cloudAIEnabled: true, mocapDetailedAIShare: false },
    );
    assert.doesNotThrow(() => assertNoKeypointsInPayload(payload));
  });

  test("Tier 2 chat payload passes guard", () => {
    const payload = buildPostureAIPayload(
      LINKED_FAULTS,
      LINKED_METRICS,
      [],
      null,
      { cloudAIEnabled: true, mocapDetailedAIShare: true },
    );
    assert.doesNotThrow(() => assertNoKeypointsInPayload(payload));
  });

  test("guard throws if keypoints sneaked into chat-bound payload", () => {
    const poisoned = {
      tier: 3 as const,
      faultSummary: {
        totalFaults: 0,
        faultCounts: {},
        severityCounts: { info: 0, warning: 0, critical: 0 },
        qualityFlags: [],
        sessionQualityScore: null,
        // SHOULD NEVER HAPPEN — guard must catch this
        keypoints: [[0.1, 0.2, 0.9]],
      },
    };
    assert.throws(
      () => assertNoKeypointsInPayload(poisoned),
      /HARD GUARD VIOLATION/,
    );
  });

  test("guard throws if landmarks sneaked into chat-bound payload", () => {
    const poisoned = {
      tier: 3 as const,
      faultSummary: {
        totalFaults: 0,
        faultCounts: {},
        severityCounts: { info: 0, warning: 0, critical: 0 },
        qualityFlags: [],
        sessionQualityScore: null,
        landmarks: [],
      },
    };
    assert.throws(
      () => assertNoKeypointsInPayload(poisoned),
      /HARD GUARD VIOLATION/,
    );
  });
});
