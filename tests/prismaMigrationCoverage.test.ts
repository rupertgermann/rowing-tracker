import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

function allMigrationSql(): string {
  return readdirSync(migrationsDir)
    .filter((dir) => statSync(path.join(migrationsDir, dir)).isDirectory())
    .sort()
    .map((dir) =>
      readFileSync(path.join(migrationsDir, dir, "migration.sql"), "utf8"),
    )
    .join("\n");
}

test("migrations create posture goals and sidecar settings used by Prisma schema", () => {
  const sql = allMigrationSql();

  assert.match(sql, /CREATE TABLE "PlanPostureGoal"/);
  assert.match(sql, /CREATE UNIQUE INDEX "PlanPostureGoal_planId_key"/);
  assert.match(sql, /ALTER TABLE "PlanPostureGoal" ADD CONSTRAINT "PlanPostureGoal_planId_fkey"/);
  assert.match(sql, /ALTER TABLE "UserSettings" ADD COLUMN "sidecarPort" INTEGER/);
});
