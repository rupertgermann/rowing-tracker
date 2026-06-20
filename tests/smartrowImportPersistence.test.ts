import assert from "node:assert/strict";
import { test } from "node:test";

import {
  persistCsvImportSessions,
  persistSmartRowSyncImport,
  persistZipImportSessions,
  type RowingImportStoreActions,
  type SaveRowingSessionsForImport,
} from "../src/lib/smartrowImportPersistence";
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
    addSessions(sessions) {
      this.sessions.push(...sessions);
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
