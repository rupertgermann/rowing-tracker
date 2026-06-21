import { KEYPOINTS_PER_FRAME_V2 } from "../../src/lib/mocap/poseFrameStream";

export interface TestSidecarMockOptions {
  port?: number;
  cameraCount?: number;
  meanConfidence?: number;
  reprojectionErrorMm?: number;
  frames?: TestSidecarFrame[];
  onPoseUpload?: (bytes: Uint8Array) => Promise<void> | void;
}

export type TestSidecarFrame = ReturnType<typeof makeTestSidecarFrame>;

interface MockWebSocketLike {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
  emitFrame(frame: TestSidecarFrame): void;
}

export class TestSidecarMock {
  readonly port: number;
  readonly cameraCount: number;
  readonly meanConfidence: number;
  readonly reprojectionErrorMm: number;
  readonly frames: TestSidecarFrame[];
  sessionStarted = false;
  sessionStopped = false;
  healthCalls = 0;
  startCalls = 0;
  stopCalls = 0;
  poseUploads = 0;
  private sockets: MockWebSocketLike[] = [];

  constructor(private readonly options: TestSidecarMockOptions = {}) {
    this.port = options.port ?? 8765;
    this.cameraCount = options.cameraCount ?? 3;
    this.meanConfidence = options.meanConfidence ?? 0.92;
    this.reprojectionErrorMm = options.reprojectionErrorMm ?? 1.2;
    this.frames = options.frames ?? makeTestSidecarStrokeFrames();
  }

  registerSocket(socket: MockWebSocketLike): void {
    this.sockets.push(socket);
  }

  emitPoseFrames(frames = this.frames): void {
    const socket = this.sockets.at(-1);
    if (!socket) {
      throw new Error("No sidecar pose-stream socket is connected");
    }
    for (const frame of frames) {
      socket.emitFrame(frame);
    }
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = String(input);
    if (url === `http://localhost:${this.port}/health`) {
      this.healthCalls += 1;
      return jsonResponse({
        status: "ready",
        fps: 30,
        cameras: this.cameraCount,
        schemaVersion: 2,
        meanConfidence: this.meanConfidence,
        reprojectionErrorMm: this.reprojectionErrorMm,
      });
    }

    if (url === `http://localhost:${this.port}/session/start`) {
      this.startSession();
      return jsonResponse({
        sessionId: "test-sidecar-session",
        calibrationId: "test-calibration",
      });
    }

    if (url === `http://localhost:${this.port}/session/stop`) {
      this.stopSession();
      return new Response(null, { status: 200 });
    }

    if (url.endsWith("/sidecar/connect")) {
      this.startSession();
      return jsonResponse({
        status: "connected",
        sidecarSessionId: "test-sidecar-session",
        calibrationId: "test-calibration",
      });
    }

    if (url.endsWith("/pose-stream")) {
      this.poseUploads += 1;
      const body = init?.body;
      if (!(body instanceof Blob)) {
        return jsonResponse({ error: "Expected pose-stream Blob body" }, 400);
      }
      const bytes = new Uint8Array(await body.arrayBuffer());
      await this.options.onPoseUpload?.(bytes);
      return new Response(null, { status: 200 });
    }

    return jsonResponse({ error: `Unhandled test sidecar URL: ${url}` }, 404);
  }

  private startSession(): void {
    this.sessionStarted = true;
    this.startCalls += 1;
  }

  private stopSession(): void {
    this.sessionStopped = true;
    this.stopCalls += 1;
  }
}

export async function withTestSidecarMock(
  options: TestSidecarMockOptions,
  run: (mock: TestSidecarMock) => Promise<void>,
): Promise<void> {
  const mock = new TestSidecarMock(options);
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;

  class MockWebSocket implements MockWebSocketLike {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    closed = false;

    constructor(readonly url: string) {
      if (url !== `ws://localhost:${mock.port}/pose-stream`) {
        throw new Error(`Unhandled test sidecar WebSocket URL: ${url}`);
      }
      mock.registerSocket(this);
    }

    close(): void {
      this.closed = true;
    }

    emitFrame(frame: TestSidecarFrame): void {
      this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
    }
  }

  globalThis.fetch = mock.fetch.bind(mock) as typeof fetch;
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

  try {
    await run(mock);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
  }
}

export function makeTestSidecarStrokeFrames(): TestSidecarFrame[] {
  const hipKneeDepths = [
    20, 80, 150, 240, 320, 240, 150, 80, 20,
    80, 150, 240, 320, 240, 150, 80, 20,
    80, 150, 240, 320, 240, 150, 80, 20,
  ];
  return hipKneeDepths.map((hipKneeDepth, frameIndex) =>
    makeTestSidecarFrame(frameIndex, hipKneeDepth),
  );
}

export function makeTestSidecarFrame(
  frameIndex: number,
  hipKneeDepth: number,
): {
  schema_version: 2;
  frame_index: number;
  timestamp_ms: number;
  source: "sidecar-3d";
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
  const keypoints = Array.from({ length: KEYPOINTS_PER_FRAME_V2 }, (_, index) => ({
    index,
    x: 0,
    y: 1000,
    z: 0,
    confidence: 0,
  }));

  keypoints[11] = trackedPoint(11, -180, 700, 160);
  keypoints[12] = trackedPoint(12, 180, 700, 160);
  keypoints[13] = trackedPoint(13, -210, 850, 180);
  keypoints[14] = trackedPoint(14, 210, 850, 180);
  keypoints[15] = trackedPoint(15, -220, 1000, 210);
  keypoints[16] = trackedPoint(16, 220, 1000, 210);
  keypoints[23] = trackedPoint(23, -120, 1000, 0);
  keypoints[24] = trackedPoint(24, 120, 1000, 0);
  keypoints[25] = trackedPoint(25, -120, 1000, hipKneeDepth);
  keypoints[26] = trackedPoint(26, 120, 1000, hipKneeDepth);
  keypoints[27] = trackedPoint(27, -120, 1100, hipKneeDepth + 0.1);
  keypoints[28] = trackedPoint(28, 120, 1100, hipKneeDepth + 0.1);

  return {
    schema_version: 2,
    frame_index: frameIndex,
    timestamp_ms: 1_700_000_000_000 + frameIndex * 33,
    source: "sidecar-3d",
    keypoints,
    quality: {
      tracked_count: 13,
      mean_confidence: 0.92,
      reprojection_error_mm: 1.2,
      camera_count: 3,
    },
  };
}

function trackedPoint(
  index: number,
  x: number,
  y: number,
  z: number,
): { index: number; x: number; y: number; z: number; confidence: number } {
  return { index, x, y, z, confidence: 0.92 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
