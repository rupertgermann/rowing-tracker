import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { initializeStoreFromDB } from "../src/lib/dataSync";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

test("initializeStoreFromDB leaves RowingSession loading to the persistence boundary", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    switch (url) {
      case "/api/awards":
        return jsonResponse({
          awards: [
            {
              awardId: "sessions-1",
              earnedAt: "2026-05-08T14:30:00.000Z",
            },
          ],
        });
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

  assert.equal(data.earnedAwards.length, 1);
  assert.equal(data.earnedAwards[0].awardId, "sessions-1");
  assert.ok(!requestedUrls.includes("/api/sessions"));
  assert.ok(!requestedUrls.includes("/api/prs"));
  assert.ok(!requestedUrls.includes("/api/sessions/list"));
});
