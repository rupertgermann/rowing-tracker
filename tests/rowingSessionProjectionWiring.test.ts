import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const repoRoot = process.cwd();

const projectionConsumers = [
  "src/app/(routes)/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/analytics/page.tsx",
  "src/app/prs/page.tsx",
  "src/app/sessions/page.tsx",
  "src/components/AwardsList.tsx",
];

const derivedStoreGetterPattern = /\bget(?:Stats|PersonalRecords|FilteredSessions)\s*\(/;

test("RowingSession projection consumers do not call mixed-store derived getters", () => {
  for (const relativePath of projectionConsumers) {
    const source = readFileSync(join(repoRoot, relativePath), "utf8");

    assert.equal(
      derivedStoreGetterPattern.test(source),
      false,
      `${relativePath} should use pure RowingSession projections instead of mixed-store derived getters`,
    );
  }
});

test("main RowingSession projection consumers import the pure projection boundary", () => {
  for (const relativePath of projectionConsumers) {
    const source = readFileSync(join(repoRoot, relativePath), "utf8");

    assert.match(
      source,
      /rowingSessionProjections/,
      `${relativePath} should depend on the pure RowingSession projection boundary`,
    );
  }
});
