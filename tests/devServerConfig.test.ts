import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("dev server uses webpack to avoid Turbopack CPU spin", () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.dev, "next dev --webpack");
});
