import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import {
  FreemocapSidecarSource,
  encodeSidecarPoseFrame,
  validateSidecarKeypointFrame,
} from "../src/lib/mocap/freemocapSidecarSource";
import type { PoseCaptureSource } from "../src/lib/mocap/poseCaptureSource";
import {
  BYTES_PER_FRAME_V2,
  KEYPOINT_SCHEMA_V2,
  decodeFrame,
} from "../src/lib/mocap/poseFrameStream";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    } as MessageEvent);
  }

  emitError(): void {
    this.onerror?.({} as Event);
  }
}

test("sidecar source starts capture, records calibration, and encodes v2 frames", async () => {
  await withSidecarGlobals(async ({ fetchCalls }) => {
    const captured: Uint8Array[] = [];
    const trackedCounts: number[] = [];
    const source = new FreemocapSidecarSource({
      sessionId: "session-1",
      cameraCount: 3,
      flushBytes: BYTES_PER_FRAME_V2 * 4,
      onFrame: (frame) => {
        captured.push(frame.poseFrameBytes);
        trackedCounts.push(frame.trackedKeypointCount);
      },
    });
    const contract: PoseCaptureSource = source;

    await contract.init();
    await contract.start();
    FakeWebSocket.instances[0].emitMessage(makeSidecarFrame(0));
    FakeWebSocket.instances[0].emitMessage(makeSidecarFrame(1));

    assert.equal(source.calibrationId, "calibration-1");
    assert.equal(source.sidecarSessionId, "sidecar-1");
    assert.equal(contract.framesCaptured, 2);
    assert.equal(captured.length, 2);
    assert.deepEqual(trackedCounts, [33, 33]);
    assert.equal(captured[0].byteLength, BYTES_PER_FRAME_V2);

    const decoded = decodeFrame(captured[0], 0, KEYPOINT_SCHEMA_V2);
    assert.equal(decoded.timestampMs, 0);
    assert.equal(decoded.keypoints[12 * 4], Math.fround(12));
    assert.equal(decoded.keypoints[12 * 4 + 1], Math.fround(112));
    assert.equal(decoded.keypoints[12 * 4 + 2], Math.fround(212));
    assert.equal(decoded.keypoints[12 * 4 + 3], Math.fround(0.9));
    assert.equal(decoded.qualityFlags, 0);
    const decodedSecond = decodeFrame(captured[1], 0, KEYPOINT_SCHEMA_V2);
    assert.equal(decodedSecond.timestampMs, 33);

    await contract.stop();
    assert.equal(FakeWebSocket.instances[0].closed, true);
    assert.deepEqual(fetchCalls.map((call) => String(call.input)), [
      "/api/mocap/sessions/session-1/sidecar/connect",
      "http://localhost:8765/session/stop",
      "/api/mocap/sessions/session-1/pose-stream",
    ]);
  });
});

test("sidecar source captures from a real synthetic sidecar process", async () => {
  const port = await getFreePort();
  const sidecar = startPythonSidecar(port);
  await waitForSidecarHealth(port);
  const originalFetch = globalThis.fetch;
  const poseUploads: Uint8Array[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/sidecar/connect")) {
      assert.deepEqual(JSON.parse(init?.body as string), { port });
      const startRes = await originalFetch(`http://localhost:${port}/session/start`, {
        method: "POST",
      });
      assert.equal(startRes.status, 200);
      const started = (await startRes.json()) as {
        sessionId?: string;
        calibrationId?: string;
      };
      return jsonResponse(
        {
          status: "connected",
          fps: 30,
          cameras: 3,
          schemaVersion: 2,
          port,
          sidecarSessionId: started.sessionId,
          calibrationId: started.calibrationId,
        },
        200,
      );
    }
    if (url.endsWith("/pose-stream")) {
      const body = init?.body;
      assert.ok(body instanceof Blob);
      poseUploads.push(new Uint8Array(await body.arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const source = new FreemocapSidecarSource({
      sessionId: "session-real-sidecar",
      port,
      flushBytes: BYTES_PER_FRAME_V2,
    });

    await source.init();
    await source.start();
    await waitFor(() => source.framesCaptured >= 2 && poseUploads.length >= 1);
    await source.stop();

    assert.match(source.sidecarSessionId ?? "", /^[0-9a-f-]{36}$/);
    assert.equal(source.calibrationId, "synthetic-calibration");
    assert.ok(source.framesCaptured >= 2);
    assert.ok(poseUploads.length >= 1);
    assert.equal(
      poseUploads.reduce((total, chunk) => total + chunk.byteLength, 0) %
        BYTES_PER_FRAME_V2,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await stopProcess(sidecar);
  }
});

test("sidecar source flushes buffered v2 bytes by threshold and drains on stop", async () => {
  await withSidecarGlobals(async ({ fetchCalls }) => {
    const source = new FreemocapSidecarSource({
      sessionId: "session-2",
      flushBytes: BYTES_PER_FRAME_V2 * 2,
    });

    await source.init();
    await source.start();
    FakeWebSocket.instances[0].emitMessage(makeSidecarFrame(0));
    FakeWebSocket.instances[0].emitMessage(makeSidecarFrame(1));
    await tick();

    let poseUploads = fetchCalls.filter((call) =>
      String(call.input).endsWith("/pose-stream"),
    );
    assert.equal(poseUploads.length, 1);
    assert.equal(
      (poseUploads[0].init?.body as Blob).size,
      BYTES_PER_FRAME_V2 * 2,
    );

    FakeWebSocket.instances[0].emitMessage(makeSidecarFrame(2));
    await source.stop();
    poseUploads = fetchCalls.filter((call) =>
      String(call.input).endsWith("/pose-stream"),
    );
    assert.equal(poseUploads.length, 2);
    assert.equal((poseUploads[1].init?.body as Blob).size, BYTES_PER_FRAME_V2);

    const uploadIndexes = fetchCalls
      .map((call, index) =>
        String(call.input).endsWith("/pose-stream") ? index : -1,
      )
      .filter((index) => index !== -1);
    const stopIndex = fetchCalls.findIndex(
      (call) => String(call.input) === "http://localhost:8765/session/stop",
    );
    assert.equal(uploadIndexes.length, 2);
    assert.ok(stopIndex > uploadIndexes[0]);
    assert.ok(stopIndex < uploadIndexes[1]);
  });
});

test("sidecar source reports malformed frames without uploading them", async () => {
  await withSidecarGlobals(async ({ fetchCalls }) => {
    const errors: Error[] = [];
    const source = new FreemocapSidecarSource({
      sessionId: "session-3",
      onError: (err) => errors.push(err),
    });

    await source.init();
    await source.start();
    FakeWebSocket.instances[0].emitMessage({
      ...makeSidecarFrame(0),
      keypoints: [],
    });
    await source.stop();

    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /33 keypoints/);
    assert.equal(
      fetchCalls.some((call) => String(call.input).endsWith("/pose-stream")),
      false,
    );
  });
});

test("sidecar source propagates start and websocket errors", async () => {
  await withSidecarGlobals(
    async () => {
      const errors: Error[] = [];
      const source = new FreemocapSidecarSource({
        sessionId: "session-4",
        onError: (err) => errors.push(err),
      });

      await source.init();
      await assert.rejects(
        () => source.start(),
        /Sidecar session\/start failed: 503/,
      );
      assert.equal(source.status, "error");
      assert.equal(
        errors[0].message,
        "Sidecar session/start failed: 503 (unreachable)",
      );
    },
    { connectStatus: 503 },
  );

  await withSidecarGlobals(async () => {
    const errors: Error[] = [];
    const source = new FreemocapSidecarSource({
      sessionId: "session-5",
      onError: (err) => errors.push(err),
    });

    await source.init();
    await source.start();
    FakeWebSocket.instances[0].emitError();
    await source.stop();

    assert.equal(errors[0].message, "Sidecar WebSocket error");
  });
});

test("sidecar source reports stop errors after pending uploads are drained", async () => {
  await withSidecarGlobals(
    async ({ fetchCalls }) => {
      const errors: Error[] = [];
      const source = new FreemocapSidecarSource({
        sessionId: "session-6",
        flushBytes: BYTES_PER_FRAME_V2 * 4,
        onError: (err) => errors.push(err),
      });

      await source.init();
      await source.start();
      FakeWebSocket.instances[0].emitMessage(makeSidecarFrame(0));
      await assert.rejects(
        () => source.stop(),
        /Sidecar session\/stop failed: 500/,
      );

      assert.equal(
        fetchCalls.some((call) => String(call.input).endsWith("/pose-stream")),
        true,
      );
      assert.equal(errors.at(-1)?.message, "Sidecar session/stop failed: 500");
    },
    { stopStatus: 500 },
  );
});

test("sidecar source rejects final drain upload failures", async () => {
  await withSidecarGlobals(
    async () => {
      const errors: Error[] = [];
      const statuses: string[] = [];
      const source = new FreemocapSidecarSource({
        sessionId: "session-7",
        flushBytes: BYTES_PER_FRAME_V2 * 4,
        onStatus: (status) => statuses.push(status),
        onError: (err) => errors.push(err),
      });

      await source.init();
      await source.start();
      FakeWebSocket.instances[0].emitMessage(makeSidecarFrame(0));

      await assert.rejects(() => source.stop(), /Pose upload failed: 500/);

      assert.equal(errors.at(-1)?.message, "Pose upload failed: 500");
      assert.equal(statuses.includes("stopped"), false);
    },
    { poseUploadStatus: 500 },
  );
});

test("sidecar frame validator accepts ADR-0005 snake_case and rejects duplicates", () => {
  const frame = validateSidecarKeypointFrame(makeSidecarFrame(7));
  assert.equal(frame.frameIndex, 7);
  assert.equal(frame.timestampMs, 1_700_000_000_231);
  assert.equal(frame.quality.trackedCount, 13);
  assert.equal(frame.quality.cameraCount, 3);

  const encoded = encodeSidecarPoseFrame(frame);
  assert.equal(encoded.byteLength, BYTES_PER_FRAME_V2);

  const duplicate = makeSidecarFrame(0);
  duplicate.keypoints[1] = { ...duplicate.keypoints[1], index: 0 };
  assert.throws(
    () => validateSidecarKeypointFrame(duplicate),
    /Duplicate sidecar keypoint index 0/,
  );
});

test("sidecar frame validator requires schema and source fields", () => {
  const missingSchema = makeSidecarFrame(0) as Partial<ReturnType<typeof makeSidecarFrame>>;
  delete missingSchema.schema_version;
  assert.throws(
    () => validateSidecarKeypointFrame(missingSchema),
    /schemaVersion must be a finite number/,
  );

  const missingSource = makeSidecarFrame(0) as Partial<ReturnType<typeof makeSidecarFrame>>;
  delete missingSource.source;
  assert.throws(
    () => validateSidecarKeypointFrame(missingSource),
    /source must be a string/,
  );
});

async function withSidecarGlobals(
  run: (context: {
    fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[];
  }) => Promise<void>,
  options: {
    connectStatus?: number;
    stopStatus?: number;
    poseUploadStatus?: number;
  } = {},
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  const fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[] = [];

  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    const url = String(input);
    if (url.endsWith("/sidecar/connect")) {
      const status = options.connectStatus ?? 200;
      return jsonResponse(
        {
          status: status === 200 ? "connected" : "unreachable",
          sidecarSessionId: "sidecar-1",
          calibrationId: "calibration-1",
        },
        status,
      );
    }
    if (url.endsWith("/pose-stream")) {
      return new Response(null, { status: options.poseUploadStatus ?? 200 });
    }
    if (url === "http://localhost:8765/session/stop") {
      return new Response(null, { status: options.stopStatus ?? 200 });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    await run({ fetchCalls });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    FakeWebSocket.instances = [];
  }
}

function makeSidecarFrame(seed: number): {
  schema_version: number;
  frame_index: number;
  timestamp_ms: number;
  source: string;
  keypoints: Array<{
    index: number;
    x: number;
    y: number;
    z: number;
    confidence: number;
  }>;
  quality: {
    tracked_count: number;
    mean_confidence: number;
    reprojection_error_mm: number;
    camera_count: number;
  };
} {
  return {
    schema_version: 2,
    frame_index: seed,
    timestamp_ms: 1_700_000_000_000 + seed * 33,
    source: "sidecar-3d",
    keypoints: Array.from({ length: 33 }, (_, index) => ({
      index,
      x: seed + index,
      y: seed + 100 + index,
      z: seed + 200 + index,
      confidence: 0.9,
    })),
    quality: {
      tracked_count: 13,
      mean_confidence: 0.9,
      reprojection_error_mm: 1.2,
      camera_count: 3,
    },
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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

function startPythonSidecar(port: number): ChildProcessWithoutNullStreams {
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
      "--source",
      "synthetic",
    ],
    { env },
  );
}

async function waitForSidecarHealth(port: number): Promise<void> {
  const deadline = Date.now() + 5000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`sidecar did not become healthy: ${String(lastError)}`);
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("timed out waiting for sidecar frames");
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
