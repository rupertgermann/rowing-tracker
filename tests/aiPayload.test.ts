import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildPostureAIPayload,
  assertNoKeypointsInPayload,
} from "../src/lib/mocap/aiPayload.js";

const MOCK_FAULTS = [
  { faultType: "rounded_back_at_catch", severity: "warning" },
];

const MOCK_METRICS = [
  {
    strokeIndex: 0,
    segmentationSource: "pose-segmented",
    metricsJson: {
      backAngleAtCatchDeg: 25,
      laybackAngleDeg: 35,
      recoveryDriveRatio: 1.8,
    },
  },
];

describe("buildPostureAIPayload", () => {
  test("returns null when cloudAIEnabled false", () => {
    const result = buildPostureAIPayload(MOCK_FAULTS, MOCK_METRICS, [], null, {
      cloudAIEnabled: false,
      mocapDetailedAIShare: true,
    });
    assert.equal(result, null);
  });

  test("tier 3 when mocapDetailedAIShare false", () => {
    const result = buildPostureAIPayload(MOCK_FAULTS, MOCK_METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: false,
    });
    assert.ok(result !== null);
    assert.equal(result.tier, 3);
    assert.equal(result.strokeMetrics, undefined);
    // Hard guard must pass
    assertNoKeypointsInPayload(result);
  });

  test("tier 2 when both flags true", () => {
    const result = buildPostureAIPayload(MOCK_FAULTS, MOCK_METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: true,
    });
    assert.ok(result !== null);
    assert.equal(result.tier, 2);
    assert.ok(Array.isArray(result.strokeMetrics));
    assert.equal(result.strokeMetrics!.length, 1);
    // Hard guard must pass
    assertNoKeypointsInPayload(result);
  });

  test("tier 3 fault summary is correct", () => {
    const faults = [
      { faultType: "rounded_back_at_catch", severity: "warning" },
      { faultType: "rounded_back_at_catch", severity: "warning" },
      { faultType: "excessive_layback", severity: "critical" },
    ];
    const result = buildPostureAIPayload(faults, [], ["low_confidence"], 0.72, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: false,
    });
    assert.ok(result !== null);
    assert.equal(result.faultSummary.totalFaults, 3);
    assert.equal(result.faultSummary.faultCounts["rounded_back_at_catch"], 2);
    assert.equal(result.faultSummary.faultCounts["excessive_layback"], 1);
    assert.equal(result.faultSummary.severityCounts.warning, 2);
    assert.equal(result.faultSummary.severityCounts.critical, 1);
    assert.equal(result.faultSummary.severityCounts.info, 0);
    assert.deepEqual(result.faultSummary.qualityFlags, ["low_confidence"]);
    assert.equal(result.faultSummary.sessionQualityScore, 0.72);
  });

  test("tier 2 stroke metrics contain correct scalar values", () => {
    const result = buildPostureAIPayload(MOCK_FAULTS, MOCK_METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: true,
    });
    assert.ok(result !== null && result.strokeMetrics);
    const m = result.strokeMetrics[0];
    assert.equal(m.strokeIndex, 0);
    assert.equal(m.segmentationSource, "pose-segmented");
    assert.equal(m.backAngleAtCatchDeg, 25);
    assert.equal(m.laybackAngleDeg, 35);
    assert.equal(m.recoveryDriveRatio, 1.8);
  });

  test("tier 2 stroke metrics default to 0 for missing numeric fields", () => {
    const metrics = [
      {
        strokeIndex: 1,
        segmentationSource: "csv-aligned",
        metricsJson: { someOtherField: "hello" },
      },
    ];
    const result = buildPostureAIPayload(MOCK_FAULTS, metrics, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: true,
    });
    assert.ok(result !== null && result.strokeMetrics);
    const m = result.strokeMetrics[0];
    assert.equal(m.backAngleAtCatchDeg, 0);
    assert.equal(m.laybackAngleDeg, 0);
    assert.equal(m.recoveryDriveRatio, 0);
  });
});

describe("assertNoKeypointsInPayload", () => {
  test("throws on payload containing keypoints key", () => {
    assert.throws(() => assertNoKeypointsInPayload({ keypoints: [1, 2, 3] }));
  });

  test("throws on payload containing landmarks key", () => {
    assert.throws(() =>
      assertNoKeypointsInPayload({ frame: { landmarks: [] } }),
    );
  });

  test("does not throw on safe payload", () => {
    assert.doesNotThrow(() => assertNoKeypointsInPayload({ data: "safe" }));
  });

  test("does not throw on tier 3 payload from buildPostureAIPayload", () => {
    const result = buildPostureAIPayload(MOCK_FAULTS, MOCK_METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: false,
    });
    assert.doesNotThrow(() => assertNoKeypointsInPayload(result));
  });

  test("does not throw on tier 2 payload from buildPostureAIPayload", () => {
    const result = buildPostureAIPayload(MOCK_FAULTS, MOCK_METRICS, [], null, {
      cloudAIEnabled: true,
      mocapDetailedAIShare: true,
    });
    assert.doesNotThrow(() => assertNoKeypointsInPayload(result));
  });
});
