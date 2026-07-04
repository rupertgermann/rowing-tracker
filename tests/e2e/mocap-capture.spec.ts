/**
 * Mocap capture-and-persist smoke test.
 *
 * Verifies the route loads and the camera permission is NOT requested before
 * the user clicks Start (acceptance: "Camera permission prompt fires only when
 * user clicks Start mocap session, not on page load").
 *
 * The full capture round-trip (worker init → MediaPipe load → MediaRecorder →
 * finalize) requires an authenticated session and reachable model/wasm assets.
 * Wire that variant in CI once the auth fixture lands; for now this spec
 * keeps the contract regression-proof on the UI surface.
 */
import { test, expect, type Page } from "@playwright/test";

const sidecarCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};

type FinalizeBody = {
  durationSec: number;
  qualityFlags?: string[];
  skipAnalysis?: boolean;
};

test("capture page loads without prompting for camera", async ({ page }) => {
  let mediaRequested = false;
  await page.exposeFunction("__markMediaRequested", () => {
    mediaRequested = true;
  });
  await page.addInitScript(() => {
    const orig = navigator.mediaDevices?.getUserMedia?.bind(
      navigator.mediaDevices,
    );
    if (orig) {
      navigator.mediaDevices.getUserMedia = (...args) => {
        // @ts-expect-error injected fn
        window.__markMediaRequested?.();
        return orig(...args);
      };
    }
  });

  await page.goto("/mocap");
  await expect(page.getByText("Motion capture session")).toBeVisible();
  await expect(page.getByTestId("mocap-view-sessions")).toHaveAttribute(
    "href",
    "/mocap/sessions",
  );
  await expect(page.getByTestId("mocap-start")).toBeVisible();
  await expect(page.getByTestId("mocap-start")).toBeDisabled();
  await expect(page.getByTestId("mocap-start-calibration")).toBeVisible();
  await expect(page.getByTestId("mocap-recording-indicator")).toHaveCount(0);
  expect(mediaRequested).toBe(false);
});

test("sidecar capture can start and finalize as analyzable", async ({ page }) => {
  let finalizeBody: FinalizeBody | null = null;

  await mockSidecarCapture(page, {
    appSessionId: "mock-sidecar",
    onFinalize: (body) => {
      finalizeBody = body;
    },
  });

  await openReadySidecarCapture(page);
  await page.getByTestId("mocap-start").click();
  await expect(page.getByTestId("mocap-recording-indicator")).toBeVisible();

  await page.waitForTimeout(100);
  await page.getByTestId("mocap-stop").click();

  await expect(page.getByTestId("mocap-done")).toContainText(
    "12 pose frames",
  );
  expect(finalizeBody).not.toBeNull();
  expect(finalizeBody!.durationSec).toBeGreaterThan(0);
  expect(finalizeBody!.durationSec).toBeLessThan(60 * 60 * 8);
  expect(finalizeBody!.skipAnalysis).toBe(false);
  expect(finalizeBody!.qualityFlags ?? []).not.toContain("record-only");
});

test("sidecar capture preserves active sessions when finalize fails", async ({
  page,
}) => {
  let deleteRequested = false;

  await mockSidecarCapture(page, {
    appSessionId: "mock-sidecar-finalize-fails",
    finalizeStatus: 500,
    finalizeError: "analysis worker crashed",
    onDelete: () => {
      deleteRequested = true;
    },
  });

  await openReadySidecarCapture(page);
  await page.getByTestId("mocap-start").click();
  await expect(page.getByTestId("mocap-recording-indicator")).toBeVisible();
  await page.getByTestId("mocap-stop").click();

  await expect(page.getByTestId("mocap-error")).toContainText(
    "Finalize failed: analysis worker crashed",
  );
  expect(deleteRequested).toBe(false);
});

test("sidecar capture preserves active sessions when sidecar stop fails", async ({
  page,
}) => {
  let deleteRequested = false;

  await mockSidecarCapture(page, {
    appSessionId: "mock-sidecar-stop-fails",
    stopStatus: 500,
    onDelete: () => {
      deleteRequested = true;
    },
  });

  await openReadySidecarCapture(page);
  await page.getByTestId("mocap-start").click();
  await expect(page.getByTestId("mocap-recording-indicator")).toBeVisible();
  await page.getByTestId("mocap-stop").click();

  await expect(page.getByTestId("mocap-error")).toContainText(
    "Sidecar session/stop failed: 500",
  );
  expect(deleteRequested).toBe(false);
});

async function openReadySidecarCapture(page: Page) {
  await page.goto("/mocap");
  await page.waitForLoadState("networkidle");
  const sidecarToggle = page.getByTestId("mocap-sidecar-toggle");
  if (await sidecarToggle.isChecked()) {
    await sidecarToggle.uncheck();
  }
  await sidecarToggle.check();
  await expect(page.getByTestId("mocap-start")).toContainText(
    "Start sidecar capture",
  );
  await expect(page.getByTestId("mocap-sidecar-status")).toContainText(
    "Sidecar ready",
  );
  await expect(page.getByTestId("mocap-start")).toBeEnabled();
  await installMockSidecarWebSocket(page);
}

async function installMockSidecarWebSocket(page: Page) {
  await page.evaluate(() => {
    class MockWebSocket {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      readyState = 1;
      readonly url: string;

      constructor(url: string) {
        this.url = url;
        setTimeout(() => this.onopen?.(new Event("open")), 0);
      }

      send() {}

      close() {
        this.readyState = 3;
        this.onclose?.(new CloseEvent("close"));
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: MockWebSocket,
      writable: true,
    });
  });
}

async function mockSidecarCapture(
  page: Page,
  opts: {
    appSessionId: string;
    stopStatus?: number;
    finalizeStatus?: number;
    finalizeError?: string;
    onFinalize?: (body: FinalizeBody) => void;
    onDelete?: () => void;
  },
) {
  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: sidecarCorsHeaders,
      body: JSON.stringify({
        status: "ready",
        fps: 60,
        cameras: 3,
        schemaVersion: 2,
        contractVersion: 1,
        sidecarVersion: "0.1.0",
      }),
    });
  });
  await page.route("**/session/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: sidecarCorsHeaders,
      body: JSON.stringify({
        sessionId: "sidecar-session",
        calibrationId: "calibration-1",
      }),
    });
  });
  await page.route("**/session/stop", async (route) => {
    await route.fulfill({
      status: opts.stopStatus ?? 200,
      contentType: "application/json",
      headers: sidecarCorsHeaders,
      body:
        opts.stopStatus && opts.stopStatus >= 400
          ? JSON.stringify({ error: "sidecar stop failed" })
          : "",
    });
  });
  await page.route("**/api/mocap/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: opts.appSessionId }),
    });
  });
  await page.route(
    `**/api/mocap/sessions/${opts.appSessionId}/sidecar/connect`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({ port: 8765 });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "connected",
          fps: 60,
          cameras: 3,
          schemaVersion: 2,
          port: 8765,
        }),
      });
    },
  );
  await page.route(
    `**/api/mocap/sessions/${opts.appSessionId}/finalize`,
    async (route) => {
      const body = route.request().postDataJSON() as FinalizeBody;
      opts.onFinalize?.(body);
      if (opts.finalizeStatus && opts.finalizeStatus >= 400) {
        await route.fulfill({
          status: opts.finalizeStatus,
          contentType: "application/json",
          body: JSON.stringify({
            error: opts.finalizeError ?? "finalize failed",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: opts.appSessionId,
          status: "ready",
          analysisMode: "pose-segmented",
          durationSec: body.durationSec,
          frameCount: 12,
          poseStreamBytes: 4096,
          strokeMetricCount: 2,
          faultCount: 1,
        }),
      });
    },
  );
  await page.route(`**/api/mocap/sessions/${opts.appSessionId}`, async (route) => {
    if (route.request().method() === "DELETE") {
      opts.onDelete?.();
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session: { postureFaults: [] } }),
    });
  });
}
