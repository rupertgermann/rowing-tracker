import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  POSTURE_FAULT_CATALOG_V1,
  PostureFaultDetector,
  PostureMetricsCalculator,
  StrokePhaseSegmenter,
  analyzePoseFrameStream,
  migratePostureThresholdSettings,
  postureThresholdsV1,
  resolvePostureThresholdSettings,
  type PoseFrameStream,
  type PostureFaultType,
} from "../src/lib/mocap/analysis";

interface Fixture {
  name: string;
  stream: PoseFrameStream;
  expected: {
    strokeCount: number;
    boundaries: Array<{
      catchFrameIndex: number;
      finishFrameIndex: number;
      nextCatchFrameIndex: number;
    }>;
    metrics?: {
      strokeIndex: number;
      backAngleAtCatchDeg: number;
      backAngleAtFinishDeg: number;
      laybackAngleDeg: number;
    };
    faults: Array<{
      faultType: PostureFaultType;
      severity: "info" | "warning" | "critical";
    }>;
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "fixtures", "mocap");

function loadFixture(fileName: string): Fixture {
  return JSON.parse(
    readFileSync(path.join(fixturesDir, fileName), "utf8"),
  ) as Fixture;
}

function loadFixtures(): Fixture[] {
  return readdirSync(fixturesDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map(loadFixture);
}

test("stroke segmenter returns exact counts and expected phase boundaries", () => {
  for (const fixture of loadFixtures()) {
    const strokes = StrokePhaseSegmenter(fixture.stream);
    assert.equal(strokes.length, fixture.expected.strokeCount, fixture.name);

    for (const [i, expected] of fixture.expected.boundaries.entries()) {
      const actual = strokes[i];
      assert.ok(actual, `${fixture.name} stroke ${i} missing`);
      assertWithin(actual.catchFrameIndex, expected.catchFrameIndex, 2);
      assertWithin(actual.finishFrameIndex, expected.finishFrameIndex, 2);
      assertWithin(actual.nextCatchFrameIndex, expected.nextCatchFrameIndex, 2);
      assert.equal(actual.segmentationSource, "pose-segmented");
    }
  }
});

test("posture metrics match fixture ground truth angles", () => {
  for (const fixture of loadFixtures()) {
    if (!fixture.expected.metrics) continue;
    const strokes = StrokePhaseSegmenter(fixture.stream);
    const expected = fixture.expected.metrics;
    const metrics = PostureMetricsCalculator(
      fixture.stream,
      strokes[expected.strokeIndex],
    );

    assertWithin(
      metrics.backAngleAtCatchDeg,
      expected.backAngleAtCatchDeg,
      2,
    );
    assertWithin(
      metrics.backAngleAtFinishDeg,
      expected.backAngleAtFinishDeg,
      2,
    );
    assertWithin(metrics.laybackAngleDeg, expected.laybackAngleDeg, 2);
    assert.equal(metrics.leftRightAsymmetry.available, false);
    assert.equal(metrics.shinVerticalAtCatchDeg.available, false);
    assert.equal(metrics.kneeTrackDeviation.available, false);
  }
});

test("fault detector produces zero faults on the clean reference fixture", () => {
  const fixture = loadFixture("clean-reference.json");
  const strokes = StrokePhaseSegmenter(fixture.stream);
  const allFaults = strokes.flatMap((stroke) =>
    PostureFaultDetector(PostureMetricsCalculator(fixture.stream, stroke)),
  );
  assert.deepEqual(allFaults, []);
});

test("crafted fault fixtures trigger exactly the expected v1 fault", () => {
  for (const fixture of loadFixtures()) {
    if (fixture.name === "clean-reference") continue;

    const strokes = StrokePhaseSegmenter(fixture.stream);
    const faults = PostureFaultDetector(
      PostureMetricsCalculator(fixture.stream, strokes[0]),
    ).map((fault) => ({
      faultType: fault.faultType,
      severity: fault.severity,
    }));

    assert.deepEqual(faults, fixture.expected.faults, fixture.name);
  }
});

test("post-session analysis maps strokes to derived metric and fault rows", () => {
  const clean = loadFixture("clean-reference.json");
  const cleanResult = analyzePoseFrameStream(clean.stream);
  assert.equal(cleanResult.metrics.length, clean.expected.strokeCount);
  assert.equal(cleanResult.faults.length, 0);
  assert.equal(cleanResult.metrics[0]?.segmentationSource, "pose-segmented");
  assert.equal(
    cleanResult.metrics[0]?.phaseBoundariesJson.catchFrameIndex,
    clean.expected.boundaries[0]?.catchFrameIndex,
  );

  const rounded = loadFixture("rounded-back-critical.json");
  const roundedResult = analyzePoseFrameStream(rounded.stream);
  assert.ok(
    roundedResult.faults.some(
      (fault) =>
        fault.faultType === rounded.expected.faults[0]?.faultType &&
        fault.severity === rounded.expected.faults[0]?.severity,
    ),
  );
});

test("fault detector never emits outside the v1 catalog", () => {
  const catalog = new Set<PostureFaultType>(POSTURE_FAULT_CATALOG_V1);
  for (const fixture of loadFixtures()) {
    const strokes = StrokePhaseSegmenter(fixture.stream);
    const faults = strokes.flatMap((stroke) =>
      PostureFaultDetector(PostureMetricsCalculator(fixture.stream, stroke)),
    );
    for (const fault of faults) {
      assert.ok(catalog.has(fault.faultType), fault.faultType);
    }
  }
});

test("threshold migration updates defaults but preserves user overrides", () => {
  const v2Defaults = {
    version: "V2" as const,
    thresholds: {
      ...postureThresholdsV1.thresholds,
      rounded_back_at_catch: {
        warningBelowDeg: 35,
        criticalBelowDeg: 25,
      },
    },
  };
  const stored = {
    version: "V1" as const,
    thresholds: postureThresholdsV1.thresholds,
    userOverridden: false,
  };
  const migrated = migratePostureThresholdSettings(stored, v2Defaults);
  assert.equal(migrated.version, "V2");
  assert.equal(migrated.thresholds.rounded_back_at_catch.warningBelowDeg, 35);

  const overridden = migratePostureThresholdSettings(
    {
      ...stored,
      userOverridden: true,
      thresholds: {
        ...postureThresholdsV1.thresholds,
        rounded_back_at_catch: {
          warningBelowDeg: 10,
          criticalBelowDeg: 5,
        },
      },
    },
    v2Defaults,
  );
  assert.equal(overridden.version, "V1");
  assert.equal(
    overridden.thresholds.rounded_back_at_catch.warningBelowDeg,
    10,
  );
});

test("relaxed posture thresholds emit strictly fewer fixture faults", () => {
  const fixture = loadFixture("rounded-back-critical.json");
  const stroke = StrokePhaseSegmenter(fixture.stream)[0];
  const metrics = PostureMetricsCalculator(fixture.stream, stroke);
  const defaultFaults = PostureFaultDetector(metrics);
  const relaxedFaults = PostureFaultDetector(metrics, {
    ...postureThresholdsV1.thresholds,
    rounded_back_at_catch: {
      warningBelowDeg: 0,
      criticalBelowDeg: 0,
    },
  });

  assert.ok(defaultFaults.length > relaxedFaults.length);
});

test("malformed posture thresholds fall back to defaults with warning", () => {
  const resolved = resolvePostureThresholdSettings({
    version: "V1",
    userOverridden: true,
    thresholds: {
      ...postureThresholdsV1.thresholds,
      slow_recovery_ratio: {
        warningAboveRatio: "fast",
        criticalAboveRatio: 3.5,
      },
    },
  });

  assert.equal(resolved.settings.userOverridden, false);
  assert.equal(
    resolved.settings.thresholds.slow_recovery_ratio.warningAboveRatio,
    postureThresholdsV1.thresholds.slow_recovery_ratio.warningAboveRatio,
  );
  assert.match(resolved.warning ?? "", /malformed|invalid/);
});

test("analysis modules remain pure TypeScript with no I/O imports", () => {
  const analysisDir = path.join(here, "..", "src", "lib", "mocap", "analysis");
  for (const fileName of readdirSync(analysisDir)) {
    if (!fileName.endsWith(".ts")) continue;
    const src = readFileSync(path.join(analysisDir, fileName), "utf8");
    assert.doesNotMatch(src, /from\s+["'](?:node:)?fs["']/);
    assert.doesNotMatch(src, /from\s+["']@\/lib\/db\/prisma["']/);
    assert.doesNotMatch(src, /\bfetch\s*\(/);
    assert.doesNotMatch(src, /\bwindow\b|\bdocument\b|\bnavigator\b/);
  }
});

function assertWithin(actual: number, expected: number, tolerance: number): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} within ${tolerance} of ${expected}`,
  );
}
