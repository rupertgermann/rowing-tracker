import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { CLEAN_CATCH_AWARD_ID } from "../src/lib/postureAchievements";
import type { SessionFaultInput } from "../src/lib/mocap/postureTrendAggregation";
import { useRowingStore } from "../src/lib/store";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function qualifyingSession(): SessionFaultInput {
  return {
    sessionId: "mocap-1",
    sessionDate: new Date("2026-07-29T18:00:00.000Z"),
    qualityScore: 0.9,
    qualityFlags: [],
    faults: [],
    strokeCount: 30,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  useRowingStore.setState({
    earnedAwards: [],
    newlyEarnedAward: null,
    hasInitializedFromDB: false,
  });
});

test("analytics reload does not re-notify a persisted Clean Catch award while awards hydrate", async () => {
  let releaseAwards: ((response: Response) => void) | undefined;
  const awardsResponse = new Promise<Response>((resolve) => {
    releaseAwards = resolve;
  });
  let awardSaveCount = 0;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";

    if (url === "/api/awards" && method === "GET") {
      return awardsResponse;
    }

    if (url === "/api/awards" && method === "POST") {
      awardSaveCount += 1;
      return jsonResponse({ success: true });
    }

    return jsonResponse({});
  };

  const initialization = useRowingStore.getState().initializeFromDB();

  // This is the analytics card's current reload order: its posture response
  // can arrive while the persisted award request is still pending.
  useRowingStore.getState().evaluatePostureAwards([qualifyingSession()]);

  releaseAwards?.(
    jsonResponse({
      awards: [
        {
          awardId: CLEAN_CATCH_AWARD_ID,
          earnedAt: "2026-07-29T18:00:00.000Z",
        },
      ],
    }),
  );
  await initialization;

  const state = useRowingStore.getState();
  assert.equal(state.newlyEarnedAward, null);
  assert.equal(state.earnedAwards.length, 1);
  assert.equal(state.earnedAwards[0].awardId, CLEAN_CATCH_AWARD_ID);
  assert.equal(awardSaveCount, 0);
});

test("a newly earned Clean Catch notification is shown and persisted only once", async () => {
  let awardSaveCount = 0;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";

    if (url === "/api/awards" && method === "POST") {
      awardSaveCount += 1;
      return jsonResponse({ success: true });
    }

    return jsonResponse({});
  };

  await useRowingStore.getState().initializeFromDB();

  useRowingStore.getState().evaluatePostureAwards([qualifyingSession()]);
  assert.equal(useRowingStore.getState().newlyEarnedAward?.awardId, CLEAN_CATCH_AWARD_ID);

  useRowingStore.getState().dismissNewAward();
  useRowingStore.getState().evaluatePostureAwards([qualifyingSession()]);

  const state = useRowingStore.getState();
  assert.equal(state.newlyEarnedAward, null);
  assert.equal(state.earnedAwards.length, 1);
  assert.equal(awardSaveCount, 1);
});

test("posture trend eligibility only reads ready mocap sessions attached to rowing sessions", () => {
  const routeSource = readFileSync(
    path.join(process.cwd(), "src/app/api/mocap/posture-trend/route.ts"),
    "utf8",
  );

  assert.match(
    routeSource,
    /where:\s*\{\s*userId,\s*status:\s*"ready",\s*rowingSessionId:\s*\{\s*not:\s*null\s*\}/,
  );
});
