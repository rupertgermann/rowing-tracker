import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import net from "node:net";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("rowing-tracker-sidecar serves the ADR-0005 contract with synthetic frames", async () => {
  const port = await getFreePort();
  const sidecar = startSidecar(port, ["--source", "synthetic"]);

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "ready");
    assert.equal(health.schemaVersion, 2);
    assert.equal(health.cameras, 3);
    assert.equal(health.fps, 30);
    assert.equal(health.source, "synthetic");

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 200);
    const started = (await startRes.json()) as {
      sessionId?: string;
      calibrationId?: string;
    };
    assert.ok(started.sessionId);
    assert.ok(started.calibrationId);

    const frame = await readOneSidecarFrame(port);
    assert.equal(frame.schema_version, 2);
    assert.equal(frame.source, "sidecar-3d");
    assert.equal(frame.keypoints.length, 33);
    assert.equal(frame.quality.camera_count, 3);
    assert.equal(typeof frame.keypoints[0].z, "number");

    const stopRes = await fetch(`http://localhost:${port}/session/stop`, {
      method: "POST",
    });
    assert.equal(stopRes.status, 200);
  } finally {
    await stopProcess(sidecar);
  }
});

test("rowing-tracker-sidecar streams recorded FreeMoCap-style frames", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sidecar-freemocap-"));
  const dataPath = path.join(root, "frames.json");
  await writeFile(
    dataPath,
    JSON.stringify({
      frames: [
        Array.from({ length: 33 }, (_, index) => [
          index + 0.5,
          index + 100.5,
          index + 200.5,
          index < 13 ? 0.91 : 0.25,
        ]),
      ],
    }),
  );

  const port = await getFreePort();
  const sidecar = startSidecar(port, [
    "--source",
    "freemocap",
    "--freemocap-data",
    dataPath,
    "--fps",
    "20",
    "--camera-count",
    "4",
  ]);

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "ready");
    assert.equal(health.source, "freemocap");
    assert.equal(health.fps, 20);
    assert.equal(health.cameras, 4);
    assert.equal(health.calibrationId, "freemocap-frames");

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 200);

    const frame = await readOneSidecarFrame(port);
    assert.equal(frame.source, "sidecar-3d");
    assert.equal(frame.keypoints[12].x, 12.5);
    assert.equal(frame.keypoints[12].y, 112.5);
    assert.equal(frame.keypoints[12].z, 212.5);
    assert.equal(frame.keypoints[12].confidence, 0.91);
    assert.equal(frame.quality.tracked_count, 13);
    assert.equal(frame.quality.camera_count, 4);

    await fetch(`http://localhost:${port}/session/stop`, { method: "POST" });
  } finally {
    await stopProcess(sidecar);
  }
});

test("rowing-tracker-sidecar refuses unconfigured FreeMoCap capture", async () => {
  const port = await getFreePort();
  const sidecar = startSidecar(port, ["--source", "freemocap"]);

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "error");
    assert.equal(health.source, "freemocap");
    assert.deepEqual(health.cameras, 0);
    assert.match(
      String((health.diagnostics as unknown[])[0]),
      /FreeMoCap live camera runtime is not configured/,
    );

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 409);
    const startBody = (await startRes.json()) as { status: string };
    assert.equal(startBody.status, "error");
  } finally {
    await stopProcess(sidecar);
  }
});

test("rowing-tracker-sidecar refuses capture when no cameras are available", async () => {
  const port = await getFreePort();
  const sidecar = startSidecar(port, [
    "--source",
    "synthetic",
    "--camera-count",
    "0",
  ]);

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "error");
    assert.equal(health.cameras, 0);
    assert.match(
      String((health.diagnostics as unknown[])[0]),
      /No cameras available/,
    );

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 409);
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

function startSidecar(
  port: number,
  extraArgs: string[],
): ChildProcessWithoutNullStreams {
  const sidecarSrc = path.join(process.cwd(), "sidecar", "src");
  const env = {
    ...process.env,
    PYTHONPATH: process.env.PYTHONPATH
      ? `${sidecarSrc}${path.delimiter}${process.env.PYTHONPATH}`
      : sidecarSrc,
  };
  return spawn(
    "python3",
    [
      "-m",
      "rowing_tracker_sidecar",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      ...extraArgs,
    ],
    { env },
  );
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
  throw new Error(`sidecar did not become healthy: ${String(lastError)}`);
}

async function readOneSidecarFrame(port: number): Promise<{
  schema_version: number;
  source: string;
  keypoints: Array<{
    x: number;
    y: number;
    z: number;
    confidence: number;
  }>;
  quality: { tracked_count: number; camera_count: number };
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/pose-stream`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Timed out waiting for sidecar pose frame"));
    }, 5000);
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Sidecar WebSocket failed"));
    };
    ws.onmessage = (event) => {
      clearTimeout(timeout);
      ws.close();
      resolve(JSON.parse(String(event.data)));
    };
  });
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
