import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildPostureAIPayload,
  assertNoKeypointsInPayload,
} from "../src/lib/mocap/aiPayload.js";

const FAULTS = [
  { faultType: "rounded_back_at_catch", severity: "warning" },
  { faultType: "excessive_layback", severity: "critical" },
];

const METRICS = [
  {
    strokeIndex: 0,
    segmentationSource: "pose-segmented",
    metricsJson: {
      backAngleAtCatchDeg: 28,
      laybackAngleDeg: 40,
      recoveryDriveRatio: 2.1,
    },
  },
];

describe("insight posture payload gating", () => {
  test("cloud AI disabled → null payload (Tier 1 wall)", () => {
    const result = buildPostureAIPayload(FAULTS, METRICS, [], null, {
      cloudAIEnabled: false,
      mocapDetailedAIShare: true,
    });
    assert.equal(result, null);
  });

  test("cloud enabled, detailed share off → Tier 3 fault summary only", () => {
    const result = buildPostureAIPayload(FAULTS, METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: false,
    });
    assert.ok(result !== null);
    assert.equal(result.tier, 3);
    assert.equal(result.strokeMetrics, undefined);
    assert.equal(result.faultSummary.totalFaults, 2);
    assertNoKeypointsInPayload(result);
  });

  test("cloud enabled, detailed share on → Tier 2 adds scalar metrics", () => {
    const result = buildPostureAIPayload(FAULTS, METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: true,
    });
    assert.ok(result !== null);
    assert.equal(result.tier, 2);
    assert.ok(Array.isArray(result.strokeMetrics));
    assert.equal(result.strokeMetrics!.length, 1);
    const m = result.strokeMetrics![0];
    assert.equal(m.backAngleAtCatchDeg, 28);
    assert.equal(m.laybackAngleDeg, 40);
    assert.equal(m.recoveryDriveRatio, 2.1);
    assertNoKeypointsInPayload(result);
  });

  test("no faults or metrics → still valid payload structure", () => {
    const result = buildPostureAIPayload([], [], [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: false,
    });
    assert.ok(result !== null);
    assert.equal(result.faultSummary.totalFaults, 0);
    assertNoKeypointsInPayload(result);
  });
});

describe("raw keypoint leakage guard", () => {
  test("throws if keypoints key present", () => {
    assert.throws(
      () => assertNoKeypointsInPayload({ keypoints: [[0.1, 0.2, 0.9]] }),
      /HARD GUARD VIOLATION/,
    );
  });

  test("throws if landmarks key present", () => {
    assert.throws(
      () => assertNoKeypointsInPayload({ frame: { landmarks: [] } }),
      /HARD GUARD VIOLATION/,
    );
  });

  test("Tier 2 payload passes guard (no keypoints)", () => {
    const payload = buildPostureAIPayload(FAULTS, METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: true,
    });
    assert.doesNotThrow(() => assertNoKeypointsInPayload(payload));
  });

  test("Tier 3 payload passes guard", () => {
    const payload = buildPostureAIPayload(FAULTS, METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: false,
    });
    assert.doesNotThrow(() => assertNoKeypointsInPayload(payload));
  });
});
