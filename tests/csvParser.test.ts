import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSmartRowCsv } from "../src/lib/csvParser";
import type { Session } from "../src/types/session";

class TestFileReader {
  result: string | null = null;
  onload: ((event: { target: TestFileReader }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;

  readAsText(file: Blob): void {
    file.text()
      .then((text) => {
        this.result = text;
        this.onload?.({ target: this });
      })
      .catch((error) => this.onerror?.(error));
  }
}

Object.defineProperty(globalThis, "FileReader", {
  configurable: true,
  value: TestFileReader,
});

const headers = [
  "Time stamp (UTC)",
  "Distance (m)",
  "Time",
  "Energy (kCal)",
  "Stroke count (#)",
  "Average power (W)",
  "Maximum power (W)",
  "Watt per KG",
  "Average split (s)",
  "Minimum split (s)",
  "Average work (J)",
  "Average stroke length (m)",
  "Average stroke rate (SPM)",
  "Maximum stroke rate (SPM)",
];

function summaryFile(averageSplit: string): File {
  const values = [
    "2026-03-09 17:58:44.627",
    "1000",
    "317",
    "0",
    "118",
    "87.5",
    "110",
    "1",
    averageSplit,
    "150",
    "0",
    "0",
    "22",
    "24",
  ];

  return new File(
    [`${headers.join(";")}\n${values.join(";")}`],
    "smartrow-workouts.csv",
    { type: "text/csv" },
  );
}

test("parseSmartRowCsv derives average pace when the summary split is missing", async () => {
  const parsed = await parseSmartRowCsv(summaryFile(""), []);

  assert.equal(parsed.sessions.length, 1);
  assert.equal(parsed.sessions[0].avgSplit, 158.5);
  assert.equal(parsed.result.importedSessions, 1);
  assert.deepEqual(parsed.result.errors, []);
});

test("parseSmartRowCsv returns an update when derived pace repairs an existing session", async () => {
  const existing: Session = {
    id: "database-session-id",
    timestamp: new Date("2026-03-09T17:58:44.627Z"),
    distance: 1000,
    duration: 317,
    energy: 0,
    strokeCount: 118,
    avgPower: 87.5,
    maxPower: 110,
    wattPerKg: 1,
    avgSplit: 0,
    minSplit: 150,
    avgWork: 0,
    avgStrokeLength: 0,
    avgStrokeRate: 22,
    maxStrokeRate: 24,
    mocapSession: { id: "linked-mocap-id" },
  };

  const parsed = await parseSmartRowCsv(summaryFile(""), [existing]);

  assert.equal(parsed.sessions.length, 1);
  assert.equal(parsed.sessions[0].id, existing.id);
  assert.equal(parsed.sessions[0].avgSplit, 158.5);
  assert.deepEqual(parsed.sessions[0].mocapSession, existing.mocapSession);
  assert.equal(parsed.result.importedSessions, 0);
  assert.equal(parsed.result.updatedSessions, 1);
  assert.equal(parsed.result.duplicatesSkipped, 0);
});

test("parseSmartRowCsv keeps an existing valid pace and skips the duplicate", async () => {
  const existing: Session = {
    id: "database-session-id",
    timestamp: new Date("2026-03-09T17:58:44.627Z"),
    distance: 1000,
    duration: 317,
    energy: 0,
    strokeCount: 118,
    avgPower: 87.5,
    maxPower: 110,
    wattPerKg: 1,
    avgSplit: 159,
    minSplit: 150,
    avgWork: 0,
    avgStrokeLength: 0,
    avgStrokeRate: 22,
    maxStrokeRate: 24,
  };

  const parsed = await parseSmartRowCsv(summaryFile(""), [existing]);

  assert.deepEqual(parsed.sessions, []);
  assert.equal(parsed.result.importedSessions, 0);
  assert.equal(parsed.result.updatedSessions, 0);
  assert.equal(parsed.result.duplicatesSkipped, 1);
});
