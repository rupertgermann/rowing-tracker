import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);

test("sidecar package installs locally and exposes rowing-tracker-sidecar", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sidecar-install-"));
  const venv = path.join(root, ".venv");

  await execFileAsync("python3", ["-m", "venv", venv], { timeout: 30_000 });
  const python = path.join(venv, "bin", "python");
  const command = path.join(venv, "bin", "rowing-tracker-sidecar");

  await execFileAsync(python, ["-m", "pip", "install", "-e", "sidecar"], {
    cwd: process.cwd(),
    timeout: 60_000,
  });
  const { stdout } = await execFileAsync(command, ["--help"], {
    timeout: 30_000,
  });

  assert.match(stdout, /Run the Rowing Tracker local mocap sidecar/);
  assert.match(stdout, /--source/);
  assert.match(stdout, /--freemocap-data/);
});
