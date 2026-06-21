import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repoRoot = process.cwd();

test("mixed store does not call retired RowingSession persistence methods", () => {
  const source = readFileSync(join(repoRoot, "src/lib/store.ts"), "utf8");

  assert.doesNotMatch(source, /\bsaveSessionsToDB\b/);
  assert.doesNotMatch(source, /\bsavePRsToDB\b/);
  assert.doesNotMatch(source, /\bfetchSessionsFromDB\b/);
  assert.doesNotMatch(source, /\bfetchSessionsFromDBWithCache\b/);
  assert.doesNotMatch(source, /\bloadRowingSessionList\b/);
  assert.doesNotMatch(source, /\bskipDbSave\b/);
});

test("RowingSession loading uses the persistence boundary before local store update", () => {
  const source = readFileSync(join(repoRoot, "src/hooks/useDataSync.ts"), "utf8");

  assert.match(source, /loadRowingSessionList/);
  assert.match(source, /replaceSessionsInStore\(rowingSessions\.sessions\)/);
});

test("call sites no longer pass retired addSessions persistence flags", () => {
  for (const relativePath of [
    "src/lib/smartrowImportPersistence.ts",
    "src/app/sync/page.tsx",
  ]) {
    const source = readFileSync(join(repoRoot, relativePath), "utf8");
    assert.doesNotMatch(source, /skipDbSave/);
  }
});
