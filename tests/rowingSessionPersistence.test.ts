import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  loadRowingSessionList,
  reviveRowingSessionTimestamps,
  saveRowingSessions,
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

test("saveRowingSessions posts CSV import rows, returns database ids, and clears caches once", async () => {
  cacheSessionsData([session({ id: "cached-session" })], 7);
  localStorage.setItem("rowing_analytics_cache", JSON.stringify({ stale: true }));

  const submitted = session({ id: "client-generated-id" });
  const requests: Array<{ input: string; body: { sessions: Session[] } }> = [];
  const progressMessages: string[] = [];

  globalThis.fetch = async (input, init) => {
    requests.push({
      input: String(input),
      body: JSON.parse(String(init?.body)),
    });

    return jsonResponse({
      sessions: [
        {
          ...submitted,
          id: "db-session-id",
          timestamp: submitted.timestamp.toISOString(),
        },
      ],
    });
  };

  const result = await saveRowingSessions([submitted], {
    onProgress: (progress) => progressMessages.push(progress.message),
  });

  assert.equal(result.success, true);
  assert.equal(result.sessions?.[0].id, "db-session-id");
  assert.ok(result.sessions?.[0].timestamp instanceof Date);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, "/api/sessions");
  assert.equal(requests[0].body.sessions[0].id, "client-generated-id");
  assert.equal(getCachedSessions(), null);
  assert.equal(localStorage.getItem("rowing_analytics_cache"), null);
  assert.equal(progressMessages.at(-1), "Upload complete!");
});

test("saveRowingSessions preserves ZIP stroke data and linked mocap marker when API returns a lean row", async () => {
  const strokeData = [
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
  ];
  const submitted = session({
    id: "db-session-id",
    strokeData,
    mocapSession: { id: "mocap-1" },
  });

  globalThis.fetch = async () => jsonResponse({
    sessions: [
      {
        ...session({ id: "db-session-id" }),
        timestamp: "2026-05-08T14:30:00.000Z",
      },
    ],
  });

  const result = await saveRowingSessions([submitted]);

  assert.equal(result.success, true);
  assert.deepEqual(result.sessions?.[0].strokeData, strokeData);
  assert.deepEqual(result.sessions?.[0].mocapSession, { id: "mocap-1" });
});
