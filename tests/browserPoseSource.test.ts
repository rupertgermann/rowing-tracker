import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserPoseSource } from "../src/lib/mocap/browserPoseSource";
import type { PoseCaptureSource } from "../src/lib/mocap/poseCaptureSource";

type WorkerListener = (event: MessageEvent) => void;
type WorkerErrorListener = (event: ErrorEvent) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];

  private readonly messageListeners = new Set<WorkerListener>();
  private readonly errorListeners = new Set<WorkerErrorListener>();
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: WorkerListener | WorkerErrorListener,
  ): void {
    if (type === "message") this.messageListeners.add(listener as WorkerListener);
    if (type === "error") this.errorListeners.add(listener as WorkerErrorListener);
  }

  removeEventListener(
    type: string,
    listener: WorkerListener | WorkerErrorListener,
  ): void {
    if (type === "message") {
      this.messageListeners.delete(listener as WorkerListener);
    }
    if (type === "error") {
      this.errorListeners.delete(listener as WorkerErrorListener);
    }
  }

  postMessage(message: { type?: string }): void {
    if (message.type === "init") {
      queueMicrotask(() => this.emitMessage({ type: "ready" }));
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(data: unknown): void {
    for (const listener of this.messageListeners) {
      listener({ data } as MessageEvent);
    }
  }
}

test("browser pose source drains queued pose frame bytes through the shared contract", async () => {
  await withBrowserPoseSourceGlobals(async ({ fetchCalls }) => {
    const frames: Uint8Array[] = [];
    const source = new BrowserPoseSource({
      sessionId: "session-1",
      videoEl: fakeVideoElement(),
      flushBytes: 100,
      onFrame: (frame) => frames.push(frame.poseFrameBytes),
    });
    const contract: PoseCaptureSource = source;

    await contract.init();
    FakeWorker.instances[0].emitMessage(makeFrameMessage(1, [1, 2, 3]));
    FakeWorker.instances[0].emitMessage(makeFrameMessage(2, [4, 5]));
    await contract.drain();

    assert.equal(contract.framesCaptured, 2);
    assert.equal(contract.status, "ready");
    assert.deepEqual(frames.map((frame) => [...frame]), [
      [1, 2, 3],
      [4, 5],
    ]);
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      String(fetchCalls[0].input),
      "/api/mocap/sessions/session-1/pose-stream",
    );
    assert.equal(fetchCalls[0].init?.method, "POST");
    assert.deepEqual(
      [...new Uint8Array(await (fetchCalls[0].init?.body as Blob).arrayBuffer())],
      [1, 2, 3, 4, 5],
    );
  });
});

test("browser pose source reports drain upload errors through the shared contract", async () => {
  await withBrowserPoseSourceGlobals(
    async () => {
      const errors: Error[] = [];
      const source = new BrowserPoseSource({
        sessionId: "session-2",
        videoEl: fakeVideoElement(),
        flushBytes: 100,
        onError: (err) => errors.push(err),
      });
      const contract: PoseCaptureSource = source;

      await contract.init();
      FakeWorker.instances[0].emitMessage(makeFrameMessage(1, [9, 8, 7]));
      await contract.drain();

      assert.equal(errors.length, 1);
      assert.equal(errors[0].message, "Pose upload failed: 500");
    },
    { fetchOk: false },
  );
});

async function withBrowserPoseSourceGlobals(
  run: (context: {
    fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[];
  }) => Promise<void>,
  options: { fetchOk?: boolean } = {},
): Promise<void> {
  const originalWorker = globalThis.Worker;
  const originalFetch = globalThis.fetch;
  const fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[] = [];

  FakeWorker.instances = [];
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    return new Response(null, { status: options.fetchOk === false ? 500 : 200 });
  }) as typeof fetch;

  try {
    await run({ fetchCalls });
  } finally {
    globalThis.Worker = originalWorker;
    globalThis.fetch = originalFetch;
    FakeWorker.instances = [];
  }
}

function makeFrameMessage(framesEncoded: number, bytes: number[]): unknown {
  return {
    type: "frame",
    framesEncoded,
    landmarkCount: 33,
    trackedKeypointCount: 20,
    meanConfidence: 0.8,
    qualityFlags: 0,
    bytes: new Uint8Array(bytes).buffer,
  };
}

function fakeVideoElement(): HTMLVideoElement {
  return { readyState: 2 } as HTMLVideoElement;
}
