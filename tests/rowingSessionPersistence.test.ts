import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  clearRowingSessionStrokeData,
  deleteRowingSession,
  loadRowingSessionList,
  reviveRowingSessionTimestamps,
  saveRowingSessionStrokeData,
} from "../src/lib/services/rowingSessionPersistence";
import {
  cacheSessionsData,
  clearSessionsCache,
  getCachedSessions,
} from "../src/lib/services/sessionsCache";
import type { Session } from "../src/types/session";

class MemoryStorage {
  private items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }
}

function session(overrides: Partial<Session> & { id: string }): Session {
  return {
    timestamp: new Date("2026-05-08T14:30:00.000Z"),
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
    ...overrides,
    id: overrides.id,
  };
}

function stroke(overrides: Partial<NonNullable<Session["strokeData"]>[number]> = {}) {
  return {
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
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  const localStorage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });
});

afterEach(() => {
  clearSessionsCache();
  delete (globalThis as { fetch?: typeof fetch }).fetch;
  delete (globalThis as { localStorage?: Storage }).localStorage;
  delete (globalThis as { window?: Window }).window;
});

test("loadRowingSessionList returns cached sessions on revision and count cache hit", async () => {
  cacheSessionsData([session({ id: "cached-session" })], 7);

  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return jsonResponse({
      sessions: [session({ id: "fresh-session" })],
      sessionsRevision: 7,
      count: 1,
    });
  };

  const result = await loadRowingSessionList();

  assert.equal(fetchCalls, 1);
  assert.equal(result.source, "cache");
  assert.equal(result.revision, 7);
  assert.equal(result.count, 1);
  assert.equal(result.sessions[0].id, "cached-session");
  assert.ok(result.sessions[0].timestamp instanceof Date);
});

test("loadRowingSessionList fetches and caches sessions on cache miss", async () => {
  globalThis.fetch = async () => jsonResponse({
    sessions: [
      {
        ...session({ id: "fresh-session" }),
        timestamp: "2026-05-09T14:30:00.000Z",
      },
    ],
    sessionsRevision: 3,
    count: 1,
  });

  const result = await loadRowingSessionList();
  const cached = getCachedSessions();

  assert.equal(result.source, "network");
  assert.equal(result.revision, 3);
  assert.equal(result.count, 1);
  assert.equal(result.sessions[0].id, "fresh-session");
  assert.ok(result.sessions[0].timestamp instanceof Date);
  assert.equal(cached?.sessionsRevision, 3);
  assert.equal(cached?.sessions[0].id, "fresh-session");
});

test("loadRowingSessionList falls back to stale cache when the list fetch fails", async () => {
  cacheSessionsData([
    {
      ...session({ id: "stale-session" }),
      timestamp: "2026-05-07T14:30:00.000Z" as unknown as Date,
    },
  ], 2);
  globalThis.fetch = async () => jsonResponse({ error: "unavailable" }, 503);

  const result = await loadRowingSessionList();

  assert.equal(result.source, "stale-cache");
  assert.equal(result.revision, 2);
  assert.equal(result.count, 1);
  assert.equal(result.sessions[0].id, "stale-session");
  assert.ok(result.sessions[0].timestamp instanceof Date);
});

test("reviveRowingSessionTimestamps revives list timestamps before UI state", () => {
  const [revived] = reviveRowingSessionTimestamps([
    {
      ...session({ id: "serialized-session" }),
      timestamp: "2026-05-10T14:30:00.000Z" as unknown as Date,
    },
  ]);

  assert.ok(revived.timestamp instanceof Date);
  assert.equal(revived.timestamp.toISOString(), "2026-05-10T14:30:00.000Z");
});

test("saveRowingSessionStrokeData persists stroke data through the RowingSession boundary and invalidates cache", async () => {
  cacheSessionsData([session({ id: "cached-session" })], 7);
  localStorage.setItem("rowing_analytics_cache", JSON.stringify({ cachedAt: Date.now() }));

  const strokes = [stroke(), stroke({ strokeIndex: 1, distance: 10 })];
  const captured: { requestBody?: { sessions: Session[] } } = {};

  globalThis.fetch = async (input, init) => {
    assert.equal(input, "/api/sessions");
    assert.equal(init?.method, "POST");
    captured.requestBody = JSON.parse(init?.body as string);

    return jsonResponse({
      sessions: [
        {
          ...session({ id: "session-with-strokes" }),
          timestamp: "2026-05-08T14:30:00.000Z",
          consistencyScore: 92,
        },
      ],
      count: 1,
    });
  };

  const saved = await saveRowingSessionStrokeData(
    session({ id: "session-with-strokes" }),
    strokes,
  );

  assert.ok(captured.requestBody);
  assert.deepEqual(captured.requestBody.sessions[0].strokeData, strokes);
  assert.equal(saved.id, "session-with-strokes");
  assert.equal(saved.strokeData, strokes);
  assert.equal(saved.strokeDataCount, 2);
  assert.equal(saved.consistencyScore, 92);
  assert.ok(saved.timestamp instanceof Date);
  assert.equal(getCachedSessions(), null);
  assert.equal(localStorage.getItem("rowing_analytics_cache"), null);
});

test("clearRowingSessionStrokeData persists an explicit empty strokeData array and keeps summary fields", async () => {
  cacheSessionsData([session({ id: "cached-session" })], 7);

  const original = session({
    id: "session-to-clear",
    distance: 2000,
    duration: 480,
    avgPower: 210,
    strokeData: [stroke()],
    strokeDataCount: 1,
    consistencyScore: 88,
  });
  const captured: { requestBody?: { sessions: Session[] } } = {};

  globalThis.fetch = async (_input, init) => {
    captured.requestBody = JSON.parse(init?.body as string);

    return jsonResponse({
      sessions: [
        {
          ...original,
          strokeData: undefined,
          strokeDataCount: 0,
          consistencyScore: null,
          timestamp: original.timestamp.toISOString(),
        },
      ],
      count: 1,
    });
  };

  const cleared = await clearRowingSessionStrokeData(original);

  assert.ok(captured.requestBody);
  assert.deepEqual(captured.requestBody.sessions[0].strokeData, []);
  assert.equal(cleared.distance, 2000);
  assert.equal(cleared.duration, 480);
  assert.equal(cleared.avgPower, 210);
  assert.equal(cleared.strokeData, undefined);
  assert.equal(cleared.strokeDataCount, 0);
  assert.equal(cleared.consistencyScore, null);
  assert.equal(getCachedSessions(), null);
});

test("deleteRowingSession persists deletion through the RowingSession boundary and invalidates cache", async () => {
  cacheSessionsData([session({ id: "cached-session" })], 7);

  let requestedUrl = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    assert.equal(init?.method, "DELETE");
    return jsonResponse({ success: true, sessionId: "session-to-delete" });
  };

  const deletedSessionId = await deleteRowingSession("session-to-delete");

  assert.equal(requestedUrl, "/api/sessions?id=session-to-delete");
  assert.equal(deletedSessionId, "session-to-delete");
  assert.equal(getCachedSessions(), null);
});
