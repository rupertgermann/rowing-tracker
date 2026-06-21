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
import { test, expect } from "@playwright/test";

const sidecarCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
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
  let finalizeBody:
    | {
        durationSec: number;
        qualityFlags?: string[];
        skipAnalysis?: boolean;
      }
    | null = null;

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
    await route.fulfill({ status: 200, headers: sidecarCorsHeaders, body: "" });
  });
  await page.route("**/api/mocap/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "mock-sidecar" }),
    });
  });
  await page.route(
    "**/api/mocap/sessions/mock-sidecar/sidecar/connect",
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
    "**/api/mocap/sessions/mock-sidecar/finalize",
    async (route) => {
      finalizeBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "mock-sidecar",
          status: "ready",
          analysisMode: "pose-segmented",
          durationSec: finalizeBody?.durationSec ?? 0,
          frameCount: 12,
          poseStreamBytes: 4096,
          strokeMetricCount: 2,
          faultCount: 1,
        }),
      });
    },
  );
  await page.route("**/api/mocap/sessions/mock-sidecar", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session: { postureFaults: [] } }),
    });
  });

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
