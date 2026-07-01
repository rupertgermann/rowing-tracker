import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FreemocapSidecarSource,
  resolveSidecarPort,
} from "../src/lib/mocap/sidecarPoseSource";
import type { PoseCaptureSourceStatus } from "../src/lib/mocap/poseCaptureSource";

test("sidecar source uses the default port for readiness, connect, start, and stop", async () => {
  await withSidecarGlobals(async ({ fetchCalls }) => {
    const statuses: PoseCaptureSourceStatus[] = [];
    const source = new FreemocapSidecarSource({
      onStatus: (status) => statuses.push(status),
    });

    await source.init();
    await source.connect("session-1");
    await source.start();
    await source.stop();

    assert.equal(source.port, 8765);
    assert.deepEqual(statuses, [
      "loading",
      "ready",
      "capturing",
      "stopping",
      "stopped",
    ]);
    assert.deepEqual(fetchCalls.map((call) => String(call.input)), [
      "http://localhost:8765/health",
      "/api/mocap/sessions/session-1/sidecar/connect",
      "http://localhost:8765/session/start",
      "http://localhost:8765/session/stop",
    ]);
    assert.deepEqual(JSON.parse(fetchCalls[1].init?.body as string), {
      port: 8765,
    });
  });
});

test("sidecar source uses a configured custom port consistently", async () => {
  await withSidecarGlobals(async ({ fetchCalls }) => {
    const source = new FreemocapSidecarSource({ port: 9012 });

    await source.init();
    await source.connect("session-2");
    await source.start();
    await source.stop();

    assert.equal(source.port, 9012);
    assert.deepEqual(fetchCalls.map((call) => String(call.input)), [
      "http://localhost:9012/health",
      "/api/mocap/sessions/session-2/sidecar/connect",
      "http://localhost:9012/session/start",
      "http://localhost:9012/session/stop",
    ]);
    assert.deepEqual(JSON.parse(fetchCalls[1].init?.body as string), {
      port: 9012,
    });
  });
});

test("sidecar source reports unreachable readiness through status and error callbacks", async () => {
  await withSidecarGlobals(
    async () => {
      const statuses: Array<[PoseCaptureSourceStatus, string | undefined]> = [];
      const errors: Error[] = [];
      const source = new FreemocapSidecarSource({
        onStatus: (status, detail) => statuses.push([status, detail]),
        onError: (err) => errors.push(err),
      });

      await assert.rejects(
        () => source.init(),
        /Sidecar not reachable on port 8765/,
      );

      assert.deepEqual(statuses, [
        ["loading", undefined],
        ["error", "Sidecar not reachable on port 8765"],
      ]);
      assert.equal(errors.length, 1);
      assert.equal(errors[0].message, "Sidecar not reachable on port 8765");
    },
    { healthResponse: "unreachable" },
  );
});

test("sidecar source reports non-ready health through status and error callbacks", async () => {
  await withSidecarGlobals(
    async () => {
      const statuses: Array<[PoseCaptureSourceStatus, string | undefined]> = [];
      const errors: Error[] = [];
      const source = new FreemocapSidecarSource({
        port: 4567,
        onStatus: (status, detail) => statuses.push([status, detail]),
        onError: (err) => errors.push(err),
      });

      await assert.rejects(
        () => source.init(),
        /Sidecar not ready: initializing \(camera rig warming up\)/,
      );

      assert.deepEqual(statuses, [
        ["loading", undefined],
        ["error", "Sidecar not ready: initializing (camera rig warming up)"],
      ]);
      assert.equal(errors.length, 1);
      assert.equal(
        errors[0].message,
        "Sidecar not ready: initializing (camera rig warming up)",
      );
    },
    { healthResponse: "initializing", healthDiagnostics: ["camera rig warming up"] },
  );
});

test("sidecar source stops sidecar after start response omits metadata", async () => {
  await withSidecarGlobals(
    async ({ fetchCalls }) => {
      const statuses: PoseCaptureSourceStatus[] = [];
      const source = new FreemocapSidecarSource({
        onStatus: (status) => statuses.push(status),
      });

      await source.init();
      await source.start();
      await source.stop();

      assert.deepEqual(fetchCalls.map((call) => String(call.input)), [
        "http://localhost:8765/health",
        "http://localhost:8765/session/start",
        "http://localhost:8765/session/stop",
      ]);
      assert.deepEqual(statuses, [
        "loading",
        "ready",
        "capturing",
        "stopping",
        "stopped",
      ]);
    },
    { startResponse: "malformed" },
  );
});

test("resolveSidecarPort falls back to the default when no user port is configured", () => {
  assert.equal(resolveSidecarPort(null), 8765);
  assert.equal(resolveSidecarPort(undefined), 8765);
});

async function withSidecarGlobals(
  run: (context: {
    fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[];
  }) => Promise<void>,
  options: {
    healthResponse?: "ready" | "initializing" | "unreachable";
    healthDiagnostics?: string[];
    startResponse?: "ready" | "malformed";
  } = {},
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    const url = String(input);
    if (url.includes("/health")) {
      if (options.healthResponse === "unreachable") {
        throw new TypeError("fetch failed");
      }
      return Response.json({
        status: options.healthResponse ?? "ready",
        fps: 60,
        cameras: 3,
        schemaVersion: 2,
        diagnostics: options.healthDiagnostics,
      });
    }
    if (url.includes("/session/start")) {
      if (options.startResponse === "malformed") {
        return new Response("{", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return Response.json({
        sessionId: "sidecar-session",
        calibrationId: "calibration-1",
      });
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    await run({ fetchCalls });
  } finally {
    globalThis.fetch = originalFetch;
  }
}
