import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repoRoot = process.cwd();

test("reanalyze route delegates lifecycle dependencies to the Prisma factory", () => {
  const source = readFileSync(
    join(repoRoot, "src/app/api/mocap/sessions/[id]/reanalyze/route.ts"),
    "utf8",
  );

  assert.match(source, /getPrismaMocapSessionLifecycle/);
  assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
  assert.doesNotMatch(source, /@\/lib\/mocap\/storage/);
  assert.doesNotMatch(source, /@\/lib\/mocap\/sessionAnalysis/);
  assert.doesNotMatch(source, /reanalyzeMocapSessionLifecycle/);
  assert.doesNotMatch(source, /\bprisma\./);
  assert.doesNotMatch(source, /\bgetMocapStorage\b/);
});

test("Prisma lifecycle factory owns the reanalyze wiring", () => {
  const source = readFileSync(
    join(repoRoot, "src/lib/mocap/lifecyclePrisma.ts"),
    "utf8",
  );

  assert.match(source, /export function createPrismaMocapSessionLifecycle/);
  assert.match(source, /reanalyze\(userId, mocapSessionId\)/);
  assert.match(source, /mocapLifecycleSessionSelect/);
  assert.match(source, /select: mocapLifecycleSessionSelect/);
  assert.match(source, /setStatus: setMocapSessionStatus/);
  assert.match(source, /getMocapStorage\(\)/);
  assert.match(source, /analyzePoseSegmented: analyzeAndPersistMocapSession/);
  assert.match(source, /analyzeCsvAligned: analyzeAndPersistMocapSessionLinked/);
  assert.doesNotMatch(source, /throw new Error\(".*must use/);
});
