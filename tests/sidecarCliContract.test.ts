import assert from "node:assert/strict";
import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import net from "node:net";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("rowing-tracker-sidecar serves the ADR-0005 contract with synthetic frames", async () => {
  const port = await getFreePort();
  const sidecar = startSidecar(port, ["--source", "synthetic"]);

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "ready");
    assert.equal(health.schemaVersion, 2);
    assert.equal(health.contractVersion, 1);
    assert.equal(health.sidecarVersion, "0.1.0");
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
        {
          keypoints: Array.from({ length: 33 }, (_, index) => ({
            index,
            x: index + 0.5,
            y: index + 100.5,
            z: index + 200.5,
            confidence: index < 13 ? 0.91 : 0.25,
          })),
          quality: {
            reprojection_error_mm: 4.5,
          },
        },
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
    assert.equal(frame.quality.reprojection_error_mm, 4.5);

    await fetch(`http://localhost:${port}/session/stop`, { method: "POST" });
  } finally {
    await stopProcess(sidecar);
  }
});

test("rowing-tracker-sidecar rejects recorded FreeMoCap frames with incomplete keypoint indexes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sidecar-freemocap-"));
  const dataPath = path.join(root, "frames.json");
  await writeFile(
    dataPath,
    JSON.stringify({
      frames: [
        {
          keypoints: Array.from({ length: 33 }, (_, index) => ({
            index: Math.min(index, 31),
            x: index + 0.5,
            y: index + 100.5,
            z: index + 200.5,
            confidence: 0.91,
          })),
        },
      ],
    }),
  );

  const port = await getFreePort();
  const sidecar = startSidecar(port, [
    "--source",
    "freemocap",
    "--freemocap-data",
    dataPath,
  ]);

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "error");
    assert.equal(health.source, "freemocap");
    assert.match(
      String((health.diagnostics as unknown[])[0]),
      /keypoint indexes must contain 0 through 32 exactly once/,
    );

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 409);
  } finally {
    await stopProcess(sidecar);
  }
});

test("rowing-tracker-sidecar streams injected FreeMoCap runtime provider frames", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sidecar-runtime-"));
  await writeFile(
    path.join(root, "fake_runtime_provider.py"),
    `
from rowing_tracker_sidecar.contract import SourceHealth
from rowing_tracker_sidecar.sources import RuntimeFrame, SourceSession

class FakeRuntimeProvider:
    def __init__(self):
        self.active = False
        self.session_id = None

    def health(self):
        return SourceHealth(
            status="ready",
            fps=24,
            camera_count=5,
            source="freemocap",
            calibration_id="runtime-calibration",
            diagnostics=("fake runtime ready",),
        )

    def start_session(self, session_id):
        self.active = True
        self.session_id = f"runtime-{session_id}"
        return SourceSession(
            session_id=self.session_id,
            calibration_id="runtime-calibration",
        )

    def stop_session(self, session_id):
        if session_id != self.session_id:
            raise RuntimeError(f"unexpected session {session_id}")
        self.active = False

    def frame(self):
        if not self.active:
            raise RuntimeError("runtime provider is not active")
        return RuntimeFrame(
            keypoints=[
                [index + 0.25, index + 100.25, index + 200.25, 0.92]
                for index in range(33)
            ],
            timestamp_ms=1710000000123,
            reprojection_error_mm=2.75,
            camera_count=5,
        )

def create_provider():
    return FakeRuntimeProvider()
`,
  );

  const port = await getFreePort();
  const sidecar = startSidecar(
    port,
    [
      "--source",
      "freemocap",
      "--freemocap-provider",
      "fake_runtime_provider:create_provider",
    ],
    { pythonPath: [root] },
  );

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "ready");
    assert.equal(health.source, "freemocap");
    assert.equal(health.fps, 24);
    assert.equal(health.cameras, 5);
    assert.equal(health.calibrationId, "runtime-calibration");

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 200);
    const started = (await startRes.json()) as Record<string, unknown>;
    assert.match(String(started.sessionId), /^runtime-[0-9a-f-]+$/);
    assert.equal(started.calibrationId, "runtime-calibration");

    const frame = await readOneSidecarFrame(port);
    assert.equal(frame.schema_version, 2);
    assert.equal(frame.timestamp_ms, 1710000000123);
    assert.equal(frame.source, "sidecar-3d");
    assert.equal(frame.keypoints.length, 33);
    assert.equal(frame.keypoints[12].x, 12.25);
    assert.equal(frame.keypoints[12].y, 112.25);
    assert.equal(frame.keypoints[12].z, 212.25);
    assert.equal(frame.keypoints[12].confidence, 0.92);
    assert.equal(frame.quality.tracked_count, 33);
    assert.equal(frame.quality.camera_count, 5);
    assert.equal(frame.quality.reprojection_error_mm, 2.75);

    const stopRes = await fetch(`http://localhost:${port}/session/stop`, {
      method: "POST",
    });
    assert.equal(stopRes.status, 200);
  } finally {
    await stopProcess(sidecar);
  }
});

test("freemocap runtime source rejects non-finite live provider frames", async () => {
  const script = String.raw`
import math

from rowing_tracker_sidecar.contract import SourceHealth
from rowing_tracker_sidecar.sources import FreeMocapRuntimeSource, RuntimeFrame, SourceSession

class BadRuntimeProvider:
    def health(self):
        return SourceHealth(
            status="ready",
            fps=24,
            camera_count=3,
            source="freemocap",
            calibration_id="runtime-calibration",
        )

    def start_session(self, session_id):
        return SourceSession(
            session_id=session_id,
            calibration_id="runtime-calibration",
        )

    def stop_session(self, session_id):
        return None

    def frame(self):
        return RuntimeFrame(
            keypoints=[
                [math.nan if index == 12 else index, index + 100, index + 200, 0.9]
                for index in range(33)
            ],
            timestamp_ms=1710000000123,
            reprojection_error_mm=1.5,
            camera_count=3,
        )

source = FreeMocapRuntimeSource(provider=BadRuntimeProvider())

try:
    source.frame(0, 1710000000999)
except ValueError as exc:
    assert "must be finite" in str(exc)
else:
    raise AssertionError("expected non-finite runtime frame rejection")
`;
  await execFileAsync("python3", ["-c", script], {
    env: sidecarPythonEnv(),
    timeout: 30_000,
  });
});

test("sidecar state delegates source session lifecycle", async () => {
  const script = String.raw`
from rowing_tracker_sidecar.contract import SourceHealth
from rowing_tracker_sidecar.server import SidecarState
from rowing_tracker_sidecar.sources import SourceSession

class FakeSource:
    fps = 42
    camera_count = 2
    calibration_id = "health-calibration"

    def __init__(self):
        self.started_with = None
        self.stopped_with = None

    def health(self):
        return SourceHealth(
            status="ready",
            fps=self.fps,
            camera_count=self.camera_count,
            source="freemocap",
            calibration_id=self.calibration_id,
        )

    def start_session(self, session_id):
        self.started_with = session_id
        return SourceSession(
            session_id=f"runtime-{session_id}",
            calibration_id="runtime-calibration",
        )

    def stop_session(self, session_id):
        self.stopped_with = session_id

    def frame(self, frame_index, timestamp_ms):
        raise AssertionError("frame should not be read by lifecycle test")

source = FakeSource()
state = SidecarState(source)
status, body = state.start()

assert status == 200
assert source.started_with is not None
assert body["sessionId"] == f"runtime-{source.started_with}"
assert body["calibrationId"] == "runtime-calibration"
assert state.session_id == body["sessionId"]
assert state.is_active()

stop_status, stop_body = state.stop()
assert stop_status == 200
assert source.stopped_with == body["sessionId"]
assert stop_body == {"status": "stopped", "sessionId": body["sessionId"]}
assert state.session_id is None
assert not state.is_active()
`;
  await execFileAsync("python3", ["-c", script], {
    env: sidecarPythonEnv(),
    timeout: 30_000,
  });
});

test("sidecar state refuses source session start failures without arming", async () => {
  const script = String.raw`
from rowing_tracker_sidecar.contract import SourceHealth
from rowing_tracker_sidecar.server import SidecarState

class FailingSource:
    fps = 42
    camera_count = 2
    calibration_id = "health-calibration"

    def health(self):
        return SourceHealth(
            status="ready",
            fps=self.fps,
            camera_count=self.camera_count,
            source="freemocap",
            calibration_id=self.calibration_id,
        )

    def start_session(self, session_id):
        raise RuntimeError("camera runtime refused start")

    def stop_session(self, session_id):
        raise AssertionError("stop should not be called")

    def frame(self, frame_index, timestamp_ms):
        raise AssertionError("frame should not be read")

state = SidecarState(FailingSource())
status, body = state.start()

assert status == 409
assert body["status"] == "error"
assert "camera runtime refused start" in body["diagnostics"][-1]
assert state.session_id is None
assert not state.is_active()
`;
  await execFileAsync("python3", ["-c", script], {
    env: sidecarPythonEnv(),
    timeout: 30_000,
  });
});

test("sidecar state reports source session stop failures without clearing active session", async () => {
  const script = String.raw`
from rowing_tracker_sidecar.contract import SourceHealth
from rowing_tracker_sidecar.server import SidecarState
from rowing_tracker_sidecar.sources import SourceSession

class FailingStopSource:
    fps = 42
    camera_count = 2
    calibration_id = "runtime-calibration"

    def health(self):
        return SourceHealth(
            status="ready",
            fps=self.fps,
            camera_count=self.camera_count,
            source="freemocap",
            calibration_id=self.calibration_id,
        )

    def start_session(self, session_id):
        return SourceSession(
            session_id=f"runtime-{session_id}",
            calibration_id=self.calibration_id,
        )

    def stop_session(self, session_id):
        raise RuntimeError(f"camera runtime refused stop for {session_id}")

    def frame(self, frame_index, timestamp_ms):
        raise AssertionError("frame should not be read")

state = SidecarState(FailingStopSource())
start_status, start_body = state.start()
stop_status, stop_body = state.stop()

assert start_status == 200
assert stop_status == 409
assert stop_body["status"] == "error"
assert stop_body["sessionId"] == start_body["sessionId"]
assert "camera runtime refused stop" in stop_body["diagnostics"][-1]
assert state.session_id == start_body["sessionId"]
assert state.is_active()
`;
  await execFileAsync("python3", ["-c", script], {
    env: sidecarPythonEnv(),
    timeout: 30_000,
  });
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
      new RegExp(
        "FreeMoCap package (is not installed|.+ is installed, " +
          "but it does not expose a supported headless live camera API)",
      ),
    );

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 409);
    const startBody = (await startRes.json()) as Record<string, unknown>;
    assert.equal(startBody.status, "error");
    assert.equal(startBody.source, "freemocap");
    assert.equal(startBody.fps, 30);
    assert.equal(startBody.cameras, 0);
    assert.equal(startBody.schemaVersion, 2);
    assert.equal(startBody.contractVersion, 1);
    assert.equal(startBody.sidecarVersion, "0.1.0");
    assert.deepEqual(startBody.diagnostics, health.diagnostics);
  } finally {
    await stopProcess(sidecar);
  }
});

test("rowing-tracker-sidecar diagnoses installed FreeMoCap package without a supported live API", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sidecar-freemocap-pkg-"));
  await mkdir(path.join(root, "freemocap"), { recursive: true });
  await writeFile(path.join(root, "freemocap", "__init__.py"), "");
  await mkdir(path.join(root, "freemocap-1.8.2.dist-info"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "freemocap-1.8.2.dist-info", "METADATA"),
    "Metadata-Version: 2.1\nName: freemocap\nVersion: 1.8.2\n",
  );

  const port = await getFreePort();
  const sidecar = startSidecar(port, ["--source", "freemocap"], {
    pythonPath: [root],
  });

  try {
    const health = await waitForHealth(port);
    assert.equal(health.status, "error");
    assert.equal(health.source, "freemocap");
    assert.equal(health.cameras, 0);
    assert.match(
      String((health.diagnostics as unknown[])[0]),
      new RegExp(
        "FreeMoCap package 1\\.8\\.2 is installed, " +
          "but it does not expose a supported headless live camera API",
      ),
    );
    assert.match(
      String((health.diagnostics as unknown[])[1]),
      /live calibrated camera frames require an injected --freemocap-provider adapter/,
    );

    const startRes = await fetch(`http://localhost:${port}/session/start`, {
      method: "POST",
    });
    assert.equal(startRes.status, 409);
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
    const startBody = (await startRes.json()) as Record<string, unknown>;
    assert.equal(startBody.status, "error");
    assert.equal(startBody.source, "synthetic");
    assert.equal(startBody.fps, 30);
    assert.equal(startBody.cameras, 0);
    assert.equal(startBody.schemaVersion, 2);
    assert.equal(startBody.contractVersion, 1);
    assert.equal(startBody.sidecarVersion, "0.1.0");
    assert.deepEqual(startBody.diagnostics, health.diagnostics);
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
  options: { pythonPath?: string[] } = {},
): ChildProcessWithoutNullStreams {
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
    { env: sidecarPythonEnv(options.pythonPath) },
  );
}

function sidecarPythonEnv(extraPythonPath: string[] = []): NodeJS.ProcessEnv {
  const sidecarSrc = path.join(process.cwd(), "sidecar", "src");
  const pythonPath = [
    sidecarSrc,
    ...extraPythonPath,
    process.env.PYTHONPATH,
  ].filter((entry): entry is string => Boolean(entry));
  return {
    ...process.env,
    PYTHONPATH: pythonPath.join(path.delimiter),
  };
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
  timestamp_ms: number;
  source: string;
  keypoints: Array<{
    x: number;
    y: number;
    z: number;
    confidence: number;
  }>;
  quality: {
    tracked_count: number;
    camera_count: number;
    reprojection_error_mm: number;
  };
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
