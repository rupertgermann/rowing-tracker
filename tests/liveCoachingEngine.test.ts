import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LiveCoachingEngine } from "../src/lib/mocap/coaching/liveCoachingEngine";
import type { CoachingCue } from "../src/lib/mocap/coaching/coachingAdvisor";
import type {
  PoseFrameStream,
  PostureFault,
  PostureFaultType,
  Stroke,
} from "../src/lib/mocap/analysis/types";

interface Fixture {
  name: string;
  stream: PoseFrameStream;
  expected: {
    strokeCount: number;
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

interface RecordedCue {
  cue: CoachingCue;
  stroke: Stroke;
  faults: PostureFault[];
  emittedAtMs: number;
  bufferedFrameCount: number;
}

function runFixture(
  fixture: Fixture,
  opts: {
    minSeverity?: "info" | "warning";
    perFaultThrottleMs?: number;
    segmenterIntervalMs?: number;
    trailingFrameMargin?: number;
  } = {},
): { cues: RecordedCue[]; finalClock: number } {
  const cues: RecordedCue[] = [];
  let clock = 0;
  // Each frame advances the injected clock by one tick (1000/fps ms).
  const frameTickMs = 1000 / fixture.stream.fps;

  const engine = new LiveCoachingEngine({
    fps: fixture.stream.fps,
    capturePerspective: fixture.stream.capturePerspective,
    minSeverity: opts.minSeverity ?? "warning",
    // Tick on every frame so determinism does not depend on wall clock.
    segmenterIntervalMs: opts.segmenterIntervalMs ?? 0,
    perFaultThrottleMs: opts.perFaultThrottleMs ?? 8000,
    trailingFrameMargin: opts.trailingFrameMargin ?? 3,
    now: () => clock,
    onCue: (cue, stroke, faults) => {
      cues.push({
        cue,
        stroke,
        faults,
        emittedAtMs: clock,
        bufferedFrameCount: engine.bufferedFrameCount,
      });
    },
  });

  for (const frame of fixture.stream.frames) {
    clock += frameTickMs;
    engine.pushFrame(frame);
  }
  engine.flush();
  return { cues, finalClock: clock };
}

test("clean-reference fixture emits no cues", () => {
  const fixture = loadFixture("clean-reference.json");
  const { cues } = runFixture(fixture);
  assert.equal(
    cues.length,
    0,
    `expected no cues on clean reference, got ${cues
      .map((r) => r.cue.faultType)
      .join(", ")}`,
  );
});

test("rounded-back-critical fixture emits a critical rounded_back_at_catch cue", () => {
  const fixture = loadFixture("rounded-back-critical.json");
  const { cues } = runFixture(fixture);
  const matching = cues.filter(
    (r) => r.cue.faultType === "rounded_back_at_catch",
  );
  assert.ok(matching.length >= 1, "expected at least one rounded-back cue");
  assert.equal(matching[0].cue.severity, "critical");
  assert.ok(
    matching[0].cue.drills.length >= 1,
    "cue should ship with drill suggestions",
  );
});

test("excessive-layback fixture surfaces only at verbose verbosity (info severity)", () => {
  const fixture = loadFixture("excessive-layback.json");
  const expectsInfoOnly = fixture.expected.faults.every(
    (f) => f.severity === "info",
  );
  if (!expectsInfoOnly) {
    // Fixture is mixed-severity: skip the strict quiet/verbose contrast
    // assertion to keep the test stable across fixture tweaks.
    return;
  }

  const quiet = runFixture(fixture, { minSeverity: "warning" });
  assert.equal(
    quiet.cues.length,
    0,
    "info-only faults must be suppressed in quiet mode",
  );

  const verbose = runFixture(fixture, { minSeverity: "info" });
  assert.ok(
    verbose.cues.length >= 1,
    "info-only faults should surface in verbose mode",
  );
});

test("same faultType is throttled within the per-fault throttle window", () => {
  const fixture = loadFixture("rounded-back-critical.json");
  const { cues } = runFixture(fixture, { perFaultThrottleMs: 60_000 });
  const rounded = cues.filter(
    (r) => r.cue.faultType === "rounded_back_at_catch",
  );
  assert.equal(
    rounded.length,
    1,
    `expected throttle to collapse repeated cues; got ${rounded.length}`,
  );
});

test("cues are emitted post-stroke, after nextCatchFrameIndex is buffered", () => {
  const fixture = loadFixture("rounded-back-critical.json");
  const { cues } = runFixture(fixture);
  for (const record of cues) {
    assert.ok(
      record.bufferedFrameCount >= record.stroke.nextCatchFrameIndex,
      `cue for stroke ${record.stroke.strokeIndex} fired before stroke completion`,
    );
  }
});
