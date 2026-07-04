/**
 * Opt-in smoke test for a real FreeMoCap sidecar runtime.
 *
 * This is skipped by default so normal CI remains hardware-free. To run it,
 * start Rowing Tracker's dev server and a ready sidecar on localhost, then set:
 *
 *   ROWING_TRACKER_SIDECAR_HARDWARE_SMOKE=1
 *
 * The test mocks only Rowing Tracker's auth/database API surface. Sidecar
 * health, session start/stop, and WebSocket frame streaming use the real local
 * sidecar process.
 */
import { expect, test, type Page, type Route } from "@playwright/test";
import {
  BYTES_PER_FRAME_V2,
  HEADER_SIZE,
  KEYPOINT_SCHEMA_V2,
  encodeHeader,
} from "../../src/lib/mocap/poseFrameStream";

const SMOKE_ENABLED =
  process.env.ROWING_TRACKER_SIDECAR_HARDWARE_SMOKE === "1";
const ALLOW_SYNTHETIC =
  process.env.ROWING_TRACKER_SIDECAR_HARDWARE_ALLOW_SYNTHETIC === "1";
const SIDECAR_PORT = Number.parseInt(
  process.env.ROWING_TRACKER_SIDECAR_PORT ?? "8765",
  10,
);
const SESSION_ID = "hardware-sidecar-smoke";

type SidecarHealth = {
  status?: string;
  fps?: number;
  cameras?: number;
  schemaVersion?: number;
  contractVersion?: number;
  sidecarVersion?: string;
  source?: string;
  calibrationId?: string | null;
  diagnostics?: string[];
};

type FinalizeBody = {
  durationSec: number;
  qualityFlags?: string[];
  skipAnalysis?: boolean;
};

test.describe("hardware-gated FreeMoCap sidecar smoke", () => {
  test.skip(
    !SMOKE_ENABLED,
    "Set ROWING_TRACKER_SIDECAR_HARDWARE_SMOKE=1 with a real ready sidecar to run.",
  );

  test("records through Rowing Tracker and verifies replay-ready sidecar output", async ({
    page,
  }) => {
    const health = await fetchSidecarHealth();
    assertSmokeHealth(health);

    const uploadedFrameChunks: Uint8Array[] = [];
    let finalizeBody: FinalizeBody | null = null;
    let finalizedFrameCount = 0;

    await installSidecarPortSetting(page, SIDECAR_PORT);
    await mockPersistenceAroundRealSidecar(page, {
      health,
      uploadedFrameChunks,
      onFinalize: (body) => {
        finalizeBody = body;
        finalizedFrameCount = uploadedFrameCount(uploadedFrameChunks);
      },
    });

    await page.goto("/mocap");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("mocap-sidecar-toggle").check();

    await expect(page.getByTestId("mocap-sidecar-status")).toContainText(
      "Sidecar ready",
    );
    await expect(page.getByTestId("mocap-start")).toBeEnabled();

    await page.getByTestId("mocap-start").click();
    await expect(page.getByTestId("mocap-recording-indicator")).toBeVisible();

    await expect
      .poll(() => uploadedFrameCount(uploadedFrameChunks), {
        message: "sidecar frame uploads",
        timeout: 20_000,
      })
      .toBeGreaterThanOrEqual(1);

    await page.getByTestId("mocap-stop").click();
    await expect(page.getByTestId("mocap-done")).toContainText("pose frames");

    expect(finalizeBody).not.toBeNull();
    expect(finalizeBody!.skipAnalysis).toBe(false);
    expect(finalizedFrameCount).toBeGreaterThanOrEqual(1);

    await page.getByTestId("mocap-replay-link").click();
    await expect(page).toHaveURL(/\/mocap\/sessions\/hardware-sidecar-smoke$/);
    await expect(page.getByTestId("mocap-replay-sidecar")).toBeVisible();
    await expect(page.getByText("pose-segmented")).toBeVisible();
  });
});

async function installSidecarPortSetting(page: Page, port: number) {
  if (port === 8765) return;
  await page.addInitScript((sidecarPort) => {
    window.localStorage.setItem(
      "rowing_app_settings",
      JSON.stringify({
        version: "sidecar-hardware-smoke",
        updatedAt: new Date().toISOString(),
        mocapSettings: { sidecarPort },
      }),
    );
  }, port);
}

async function mockPersistenceAroundRealSidecar(
  page: Page,
  opts: {
    health: SidecarHealth;
    uploadedFrameChunks: Uint8Array[];
    onFinalize: (body: FinalizeBody) => void;
  },
) {
  await page.route("**/api/mocap/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await fulfillJson(route, { id: SESSION_ID });
  });

  await page.route(
    `**/api/mocap/sessions/${SESSION_ID}/sidecar/connect`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({ port: SIDECAR_PORT });
      const startRes = await fetch(
        `http://localhost:${SIDECAR_PORT}/session/start`,
        { method: "POST" },
      );
      const started = (await startRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!startRes.ok) {
        await fulfillJson(route, started, startRes.status);
        return;
      }
      await fulfillJson(route, {
        status: "connected",
        fps: opts.health.fps,
        cameras: opts.health.cameras,
        schemaVersion: opts.health.schemaVersion,
        contractVersion: opts.health.contractVersion,
        sidecarVersion: opts.health.sidecarVersion,
        source: opts.health.source,
        port: SIDECAR_PORT,
        sidecarSessionId:
          typeof started.sessionId === "string" ? started.sessionId : null,
        calibrationId:
          typeof started.calibrationId === "string"
            ? started.calibrationId
            : opts.health.calibrationId,
      });
    },
  );

  await page.route(
    `**/api/mocap/sessions/${SESSION_ID}/pose-stream`,
    async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataBuffer();
        expect(body).not.toBeNull();
        opts.uploadedFrameChunks.push(new Uint8Array(body!));
        await route.fulfill({ status: 200, body: "" });
        return;
      }
      await fulfillPoseRange(route, buildPoseStreamBlob(opts));
    },
  );

  await page.route(
    `**/api/mocap/sessions/${SESSION_ID}/finalize`,
    async (route) => {
      const body = route.request().postDataJSON() as FinalizeBody;
      opts.onFinalize(body);
      const frameCount = uploadedFrameCount(opts.uploadedFrameChunks);
      await fulfillJson(route, {
        id: SESSION_ID,
        status: "ready",
        analysisMode: "pose-segmented",
        durationSec: body.durationSec,
        frameCount,
        poseStreamBytes: HEADER_SIZE + frameCount * BYTES_PER_FRAME_V2,
        strokeMetricCount: 1,
        faultCount: 0,
      });
    },
  );

  await page.route(
    `**/api/mocap/sessions/${SESSION_ID}/assignment-candidates`,
    async (route) => {
      await fulfillJson(route, {
        linkable: false,
        reason: "hardware-smoke",
        message: "Hardware smoke sessions are not linked to CSV rows.",
        candidates: [],
      });
    },
  );

  await page.route(
    `**/api/mocap/sessions/${SESSION_ID}/sidecar/stop`,
    async (route) => {
      const stopRes = await fetch(`http://localhost:${SIDECAR_PORT}/session/stop`, {
        method: "POST",
      });
      const body = (await stopRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      await fulfillJson(route, body, stopRes.status);
    },
  );

  await page.route(`**/api/mocap/sessions/${SESSION_ID}`, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await fulfillJson(route, { session: smokeSession(opts) });
  });
}

async function fetchSidecarHealth(): Promise<SidecarHealth> {
  const res = await fetch(`http://localhost:${SIDECAR_PORT}/health`);
  if (!res.ok) {
    throw new Error(`Sidecar health check failed: ${res.status}`);
  }
  return (await res.json()) as SidecarHealth;
}

function assertSmokeHealth(health: SidecarHealth) {
  expect(health.status).toBe("ready");
  expect(health.schemaVersion).toBe(KEYPOINT_SCHEMA_V2);
  expect(health.contractVersion).toBe(1);
  expect(health.cameras).toBeGreaterThan(0);
  expect(health.fps).toBeGreaterThan(0);
  if (!ALLOW_SYNTHETIC) {
    expect(health.source).toBe("freemocap");
    expect(health.calibrationId).toBeTruthy();
  }
}

function buildPoseStreamBlob(opts: {
  health: SidecarHealth;
  uploadedFrameChunks: Uint8Array[];
}): Uint8Array {
  const frameBytes = concatBytes(opts.uploadedFrameChunks);
  const frameCount = Math.floor(frameBytes.byteLength / BYTES_PER_FRAME_V2);
  const header = encodeHeader({
    fps: opts.health.fps ?? 30,
    keypointSchemaVersion: KEYPOINT_SCHEMA_V2,
    frameCount,
    coordinateSpace: "world-mm-3d",
    cameraCount: opts.health.cameras ?? 1,
  });
  return concatBytes([header, frameBytes]);
}

function uploadedFrameCount(chunks: Uint8Array[]): number {
  return Math.floor(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0) /
      BYTES_PER_FRAME_V2,
  );
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fulfillPoseRange(route: Route, blob: Uint8Array) {
  const range = route.request().headers().range;
  const match = range?.match(/^bytes=(\d+)-(\d+)$/);
  const start = match ? Number.parseInt(match[1], 10) : 0;
  const requestedEnd = match ? Number.parseInt(match[2], 10) : blob.byteLength - 1;
  const end = Math.min(requestedEnd, blob.byteLength - 1);
  const slice = blob.slice(start, end + 1);
  await route.fulfill({
    status: range ? 206 : 200,
    contentType: "application/octet-stream",
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${blob.byteLength}`,
    },
    body: Buffer.from(slice),
  });
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function smokeSession(opts: {
  health: SidecarHealth;
  uploadedFrameChunks: Uint8Array[];
}) {
  return {
    id: SESSION_ID,
    status: "ready",
    capturePerspective: "sidecar-3d",
    captureFps: opts.health.fps ?? 30,
    durationSec: Math.max(1, uploadedFrameCount(opts.uploadedFrameChunks) / 30),
    qualityScore: 0.9,
    qualityFlags: [],
    createdAt: new Date().toISOString(),
    rowingSessionId: null,
    rowingSession: null,
    strokePostureMetrics: [
      {
        id: "hardware-smoke-metric-0",
        strokeIndex: 0,
        segmentationSource: "pose-segmented",
        phaseBoundariesJson: {
          catchFrameIndex: 0,
          driveStartFrameIndex: 0,
          finishFrameIndex: 0,
          recoveryStartFrameIndex: 0,
          nextCatchFrameIndex: 0,
          confidence: 0.8,
        },
        metricsJson: {
          backAngleAtCatchDeg: 30,
          backAngleAtFinishDeg: 55,
          laybackAngleDeg: 25,
          recoveryDriveRatio: 2,
          sidecar3D: {
            lateralShoulderSymmetryMm: 0,
            leftKneeTrackDeviationMm: 0,
            rightKneeTrackDeviationMm: 0,
            nearShinAngleDeg: 90,
          },
        },
      },
    ],
    postureFaults: [],
  };
}
