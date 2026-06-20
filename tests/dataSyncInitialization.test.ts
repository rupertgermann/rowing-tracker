import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { initializeStoreFromDB } from "../src/lib/dataSync";

const fullSession = {
  id: "session-with-analysis",
  timestamp: "2026-05-08T14:30:00.000Z",
  distance: 100,
  duration: 40,
  energy: 0,
  strokeCount: 10,
  avgPower: 100,
  maxPower: 120,
  wattPerKg: 0,
  avgSplit: 200,
  minSplit: 190,
  avgWork: 100,
  avgStrokeLength: 10,
  avgStrokeRate: 24,
  maxStrokeRate: 26,
  strokeData: [
    {
      strokeIndex: 0,
      time: 1,
      timestamp: "00:01",
      distance: 5,
      work: 10,
      power: 100,
      avgPower: 100,
      split: 200,
      avgSplit: 200,
      strokeRate: 24,
      heartRate: null,
    },
  ],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

test("initializeStoreFromDB preserves full session strokeData for cold session detail loads", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    switch (url) {
      case "/api/sessions":
        return jsonResponse({ sessions: [fullSession] });
      case "/api/prs":
        return jsonResponse({ prs: [] });
      case "/api/awards":
        return jsonResponse({ awards: [] });
      case "/api/training-plans":
        return jsonResponse({ plans: [] });
      case "/api/insights":
        return jsonResponse({ insights: [] });
      case "/api/chat":
        return jsonResponse({ chatSessions: [] });
      case "/api/settings":
        return jsonResponse({ settings: null });
      case "/api/generated-achievements":
        return jsonResponse({ achievements: [] });
      case "/api/memory":
        return jsonResponse({ documents: [] });
      default:
        throw new Error(`Unexpected fetch: ${url}`);
    }
  };

  const data = await initializeStoreFromDB();

  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].id, "session-with-analysis");
  assert.equal(data.sessions[0].strokeData?.length, 1);
  assert.equal(data.sessions[0].strokeData?.[0].strokeIndex, 0);
  assert.ok(requestedUrls.includes("/api/sessions"));
  assert.ok(!requestedUrls.includes("/api/sessions/list"));
});
