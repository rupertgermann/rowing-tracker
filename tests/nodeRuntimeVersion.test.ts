import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedNodeVersion = "24.18.0";

function readRepositoryFile(filePath: string): string {
  return readFileSync(path.join(repositoryRoot, filePath), "utf8");
}

test("Node 24 is used consistently across local, app, and CI runtimes", () => {
  assert.equal(readRepositoryFile(".nvmrc").trim(), expectedNodeVersion);
  assert.equal(readRepositoryFile(".node-version").trim(), expectedNodeVersion);

  const packageJson = JSON.parse(readRepositoryFile("package.json"));
  assert.equal(packageJson.engines.node, ">=24.0.0");

  assert.match(
    readRepositoryFile("scripts/check-node-version.mjs"),
    /const minimum = \[24, 0, 0\];/
  );
  assert.match(
    readRepositoryFile(".github/workflows/sidecar-release.yml"),
    /node-version: "24\.18\.0"/
  );
});
