import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCatchQualifies,
  firstCleanCatchDate,
  CLEAN_CATCH_MIN_STROKES,
  CLEAN_CATCH_MAX_FAULT_RATE,
} from "../src/lib/postureAchievements.js";
import type { SessionFaultInput } from "../src/lib/mocap/postureTrendAggregation.js";

function makeSession(overrides: Partial<SessionFaultInput> = {}): SessionFaultInput {
  return {
    sessionId: "sess-1",
    sessionDate: new Date("2025-06-01"),
    qualityScore: 0.9,
    qualityFlags: [],
    faults: [],
    strokeCount: 30,
    ...overrides,
  };
}

function roundedBackFaults(n: number) {
  return Array.from({ length: n }, () => ({ faultType: "rounded_back_at_catch", severity: "warning" as const }));
}

// ── cleanCatchQualifies ────────────────────────────────────────────────────

describe("cleanCatchQualifies — eligibility guards", () => {
  test("low quality score → false", () => {
    assert.equal(cleanCatchQualifies(makeSession({ qualityScore: 0.4 })), false);
  });

  test("quality flags present → false", () => {
    assert.equal(cleanCatchQualifies(makeSession({ qualityFlags: ["partial_occlusion"] })), false);
  });

  test("stroke count below minimum → false", () => {
    assert.equal(
      cleanCatchQualifies(makeSession({ strokeCount: CLEAN_CATCH_MIN_STROKES - 1 })),
      false,
    );
  });

  test("exactly minimum strokes, zero faults → true", () => {
    assert.equal(
      cleanCatchQualifies(makeSession({ strokeCount: CLEAN_CATCH_MIN_STROKES, faults: [] })),
      true,
    );
  });
});

describe("cleanCatchQualifies — fault rate threshold", () => {
  test("zero faults → true", () => {
    assert.equal(cleanCatchQualifies(makeSession({ strokeCount: 20, faults: [] })), true);
  });

  test("fault rate exactly at threshold → true", () => {
    // 10% of 20 strokes = 2 faults
    assert.equal(
      cleanCatchQualifies(makeSession({ strokeCount: 20, faults: roundedBackFaults(2) })),
      true,
    );
  });

  test("fault rate one above threshold → false", () => {
    // 3/20 = 15% > 10%
    assert.equal(
      cleanCatchQualifies(makeSession({ strokeCount: 20, faults: roundedBackFaults(3) })),
      false,
    );
  });

  test("other fault types not counted toward rounded_back rate", () => {
    const faults = [
      { faultType: "excessive_layback", severity: "warning" as const },
      { faultType: "early_arm_bend", severity: "info" as const },
    ];
    // 0 rounded_back faults out of 20 strokes → eligible
    assert.equal(cleanCatchQualifies(makeSession({ strokeCount: 20, faults })), true);
  });

  test("high fault rate with poor quality → false (quality check first)", () => {
    assert.equal(
      cleanCatchQualifies(makeSession({ qualityScore: 0.3, strokeCount: 30, faults: [] })),
      false,
    );
  });
});

// ── firstCleanCatchDate ────────────────────────────────────────────────────

describe("firstCleanCatchDate", () => {
  test("empty sessions → null", () => {
    assert.equal(firstCleanCatchDate([]), null);
  });

  test("no qualifying sessions → null", () => {
    const sessions = [
      makeSession({ qualityScore: 0.3 }),
      makeSession({ strokeCount: 5 }),
      makeSession({ strokeCount: 20, faults: roundedBackFaults(5) }), // 25% > 10%
    ];
    assert.equal(firstCleanCatchDate(sessions), null);
  });

  test("single qualifying session → its date", () => {
    const date = new Date("2025-08-15");
    const result = firstCleanCatchDate([makeSession({ sessionDate: date, strokeCount: 25, faults: [] })]);
    assert.deepEqual(result, date);
  });

  test("returns earliest qualifying date when multiple sessions qualify", () => {
    const early = new Date("2025-03-01");
    const late = new Date("2025-09-01");
    const sessions = [
      makeSession({ sessionDate: late, strokeCount: 30, faults: [] }),
      makeSession({ sessionDate: early, strokeCount: 30, faults: [] }),
    ];
    assert.deepEqual(firstCleanCatchDate(sessions), early);
  });

  test("skips non-qualifying sessions to find first qualifying one", () => {
    const badDate = new Date("2025-01-01");
    const goodDate = new Date("2025-06-01");
    const sessions = [
      makeSession({ sessionDate: badDate, qualityScore: 0.2 }), // low quality
      makeSession({ sessionDate: goodDate, strokeCount: 30, faults: [] }),
    ];
    assert.deepEqual(firstCleanCatchDate(sessions), goodDate);
  });

  test("poor quality session between two clean sessions → returns earliest clean", () => {
    const d1 = new Date("2025-02-01");
    const d2 = new Date("2025-04-01"); // low quality
    const d3 = new Date("2025-07-01");
    const sessions = [
      makeSession({ sessionDate: d3, strokeCount: 30, faults: [] }),
      makeSession({ sessionDate: d2, qualityScore: 0.1 }),
      makeSession({ sessionDate: d1, strokeCount: 30, faults: [] }),
    ];
    assert.deepEqual(firstCleanCatchDate(sessions), d1);
  });
});
