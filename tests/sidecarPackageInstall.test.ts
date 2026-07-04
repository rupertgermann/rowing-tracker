import assert from "node:assert/strict";
import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import net from "node:net";
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
    timeout: 180_000,
  });
  const { stdout } = await execFileAsync(command, ["--help"], {
    timeout: 30_000,
  });

  assert.match(stdout, /Run the Rowing Tracker local mocap sidecar/);
  assert.match(stdout, /--source/);
  assert.match(stdout, /--freemocap-data/);
  assert.match(stdout, /--freemocap-recording/);
  assert.match(stdout, /--freemocap-calibration-toml/);
  assert.match(stdout, /--freemocap-provider/);

  const port = await getFreePort();
  const sidecar = spawn(command, [
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--source",
    "synthetic",
  ]);
  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "ready");
    assert.equal(health.schemaVersion, 2);
    assert.equal(health.contractVersion, 1);
    assert.equal(health.sidecarVersion, "0.1.0");
  } finally {
    await stopProcess(sidecar);
  }
});

async function getFreePort(): Promise<number> {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForHealth(
  port: number,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 5000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`installed sidecar did not start: ${String(lastError)}`);
}

async function stopProcess(proc: ChildProcessWithoutNullStreams): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  proc.kill("SIGTERM");
  await Promise.race([
    once(proc, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
  if (proc.exitCode === null && proc.signalCode === null) {
    proc.kill("SIGKILL");
    await once(proc, "exit");
  }
}
