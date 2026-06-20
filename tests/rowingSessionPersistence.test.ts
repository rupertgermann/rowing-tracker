import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  loadRowingSessionList,
  reviveRowingSessionTimestamps,
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
