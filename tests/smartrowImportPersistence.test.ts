import assert from "node:assert/strict";
import { test } from "node:test";

import {
  persistCsvImportSessions,
  persistSmartRowSyncImport,
  persistZipImportSessions,
  type RowingImportStoreActions,
  type SaveRowingSessionsForImport,
} from "../src/lib/smartrowImportPersistence";
import { saveRowingSessions } from "../src/lib/services/rowingSessionPersistence";
import type { Session, StrokeData } from "../src/types/session";

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

function stroke(overrides: Partial<StrokeData> = {}): StrokeData {
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

function memoryStore(initialSessions: Session[] = []): RowingImportStoreActions & {
  sessions: Session[];
} {
  return {
    sessions: [...initialSessions],
    replaceSessionsInStore(sessions) {
      this.sessions = sessions;
    },
    addSessions(sessions) {
      const existingKeys = new Set(
        this.sessions.map((row) => `${row.timestamp.getTime()}-${row.distance}`),
      );
      this.sessions.push(
        ...sessions.filter(
          (row) => !existingKeys.has(`${row.timestamp.getTime()}-${row.distance}`),
        ),
      );
    },
    updateSessionsInStore(sessions) {
      const updatesById = new Map(sessions.map((row) => [row.id, row]));
      this.sessions = this.sessions.map((row) => updatesById.get(row.id) ?? row);
    },
  };
}

test("persistCsvImportSessions saves through persistence and adds database-returned session ids", async () => {
  const store = memoryStore();
  const savedIdsForOverlap: string[][] = [];
  const saveCalls: Session[][] = [];
  const clientSession = session({ id: "client-generated-id" });

  const saveSessions: SaveRowingSessionsForImport = async (sessions) => {
    saveCalls.push(sessions);
    return {
      success: true,
      sessions: [session({ ...sessions[0], id: "db-session-id" })],
    };
  };

  const result = await persistCsvImportSessions([clientSession], store, {
    saveSessions,
    checkMocapOverlap: async (savedSessions) => {
      savedIdsForOverlap.push(savedSessions.map((saved) => saved.id));
    },
  });

  assert.equal(result.success, true);
  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0][0].id, "client-generated-id");
  assert.equal(store.sessions[0].id, "db-session-id");
  assert.deepEqual(savedIdsForOverlap, [["db-session-id"]]);
});

test("persistCsvImportSessions updates repaired sessions without duplicating them", async () => {
  const existing = session({ id: "db-session-id", avgSplit: 0 });
  const repaired = session({ id: existing.id, avgSplit: 158.5 });
  const store = memoryStore([existing]);

  const result = await persistCsvImportSessions([repaired], store, {
    saveSessions: async (sessions) => ({ success: true, sessions }),
  });

  assert.equal(result.success, true);
  assert.equal(store.sessions.length, 1);
  assert.equal(store.sessions[0].avgSplit, 158.5);
});

test("persistZipImportSessions saves stroke-data updates and applies saved sessions locally", async () => {
  const store = memoryStore([session({ id: "db-session-id", mocapSession: { id: "mocap-1" } })]);
  const strokeData = [stroke()];
  const zipUpdate = session({
    id: "db-session-id",
    strokeData,
    mocapSession: { id: "mocap-1" },
  });
  const saveCalls: Session[][] = [];

  const result = await persistZipImportSessions([zipUpdate], store, {
    saveSessions: async (sessions) => {
      saveCalls.push(sessions);
      return { success: true, sessions };
    },
  });

  assert.equal(result.success, true);
  assert.deepEqual(saveCalls[0][0].strokeData, strokeData);
  assert.deepEqual(store.sessions[0].strokeData, strokeData);
  assert.deepEqual(store.sessions[0].mocapSession, { id: "mocap-1" });
});

test("persistSmartRowSyncImport saves CSV before ZIP so ZIP matching sees database ids", async () => {
  const store = memoryStore();
  const callOrder: string[] = [];
  const overlapIds: string[] = [];
  const csvSession = session({ id: "csv-client-id" });
  const zipSession = session({ id: "db-csv-id", strokeData: [stroke()] });

  const saveSessions: SaveRowingSessionsForImport = async (sessions) => {
    const firstId = sessions[0]?.id ?? "empty";
    callOrder.push(firstId === "csv-client-id" ? "save-csv" : "save-zip");
    return {
      success: true,
      sessions: sessions.map((row) =>
        row.id === "csv-client-id"
          ? session({ ...row, id: "db-csv-id" })
          : row
      ),
    };
  };

  const result = await persistSmartRowSyncImport(
    {
      csvSessions: [csvSession],
      loadZipSessions: async () => {
        callOrder.push("load-zip");
        assert.equal(store.sessions[0].id, "db-csv-id");
        return [zipSession];
      },
      store,
    },
    {
      saveSessions,
      checkMocapOverlap: async (savedSessions) => {
        overlapIds.push(...savedSessions.map((saved) => saved.id));
      },
    },
  );

  assert.equal(result.csvResult?.success, true);
  assert.equal(result.zipResult?.success, true);
  assert.deepEqual(callOrder, ["save-csv", "load-zip", "save-zip"]);
  assert.deepEqual(overlapIds, ["db-csv-id", "db-csv-id"]);
  assert.deepEqual(store.sessions[0].strokeData, [stroke()]);
});

for (const failure of ['http', 'connection-after-commit'] as const) {
  test(`failed later import chunk refreshes committed workouts and retries safely: ${failure}`, async (t) => {
    const prior = session({ id: 'prior', distance: 99 });
    const store = memoryStore([prior]);
    const submitted = Array.from({ length: 26 }, (_, index) => session({
      id: `client-${index}`, distance: 100 + index,
    }));
    const committed = new Map([[prior.distance, prior]]);
    let posts = 0;
    const fetchImpl: typeof fetch = async (_url, init) => {
      if (init?.method !== 'POST') {
        return Response.json({ sessions: [...committed.values()] });
      }
      posts++;
      if (posts === 2 && failure === 'http') {
        return Response.json({ error: 'Unavailable' }, { status: 503 });
      }
      const rows: Session[] = JSON.parse(String(init.body)).sessions;
      const saved = rows.map(row => ({ ...row, id: `db-${row.distance}` }));
      for (const row of saved) committed.set(row.distance, row);
      if (posts === 2) throw new Error('Connection lost after commit');
      return Response.json({ sessions: saved });
    };
    t.mock.method(globalThis, 'fetch', fetchImpl);
    const options = { saveSessions: (rows: Session[]) => saveRowingSessions(rows, { fetchImpl, persistDerivedData: false }) };
    const failed = await persistCsvImportSessions(submitted, store, options);
    assert.equal(failed.success, false);
    assert.equal(store.sessions.length, failure === 'http' ? 26 : 27);
    assert.match(failed.error!, /may have been saved.*refreshed.*retry/i);
    assert.ok(store.sessions.every(row => row.id === 'prior' || row.id.startsWith('db-')));
    const retried = await persistCsvImportSessions(submitted, store, options);
    assert.equal(retried.success, true);
    assert.equal(store.sessions.length, 27);
    assert.equal(new Set(store.sessions.map(row => row.id)).size, 27);
  });
}

test('failed ZIP import and failed refresh preserve visible workouts and report uncertainty', async (t) => {
  const prior = session({ id: 'prior' });
  const store = memoryStore([prior]);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Offline'); });
  const result = await persistZipImportSessions([session({ id: 'prior', strokeData: [stroke()] })], store, {
    saveSessions: rows => saveRowingSessions(rows, { persistDerivedData: false }),
  });
  assert.equal(result.success, false);
  assert.deepEqual(store.sessions, [prior]);
  assert.match(result.error!, /may have been saved.*refresh failed.*out of date/i);
  assert.doesNotMatch(result.error!, /has been refreshed|complete/i);
});

test('ZIP and SmartRow imports split ordinary workouts to fit the real request schema', async () => {
  const { sessionsInput } = await import('../src/lib/sessionInput');
  const rows = Array.from({ length: 25 }, (_, i) => session({ id: `zip-${i}`, strokeData: Array.from({ length: 2100 }, () => stroke()) }));
  for (const mode of ['zip', 'sync']) {
    const store = memoryStore(rows.map(row => ({ ...row, strokeData: undefined })));
    const sizes: number[] = [];
    const saveSessions: SaveRowingSessionsForImport = (sessions, options) => saveRowingSessions(sessions, {
      ...options, persistDerivedData: false,
      fetchImpl: async (_url, init) => {
        const body = sessionsInput.parse(JSON.parse(String(init?.body)));
        sizes.push(body.sessions.length);
        return Response.json({ sessions: body.sessions });
      },
    });
    if (mode === 'zip') {
      assert.equal((await persistZipImportSessions(rows, store, { saveSessions })).success, true);
    } else {
      const result = await persistSmartRowSyncImport({ csvSessions: [], loadZipSessions: async () => rows, store }, { saveSessions });
      assert.equal(result.zipResult?.success, true);
    }
    assert.deepEqual(sizes, [23, 2]);
    assert.equal(store.sessions.filter(row => row.strokeData?.length === 2100).length, 25);
  }
});
