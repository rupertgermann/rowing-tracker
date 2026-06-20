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

test("sidecar capture can start and finalize as record-only", async ({ page }) => {
  let finalizeBody:
    | {
        durationSec: number;
        qualityFlags?: string[];
        skipAnalysis?: boolean;
      }
    | null = null;

  await page.route("http://localhost:8765/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        fps: 60,
        cameras: 3,
        schemaVersion: 2,
      }),
    });
  });
  await page.route("http://localhost:8765/session/stop", async (route) => {
    await route.fulfill({ status: 200, body: "" });
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
          durationSec: finalizeBody?.durationSec ?? 0,
          frameCount: 0,
          poseStreamBytes: 0,
          strokeMetricCount: 0,
          faultCount: 0,
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
  await page.getByTestId("mocap-sidecar-toggle").check();
  await expect(page.getByTestId("mocap-sidecar-status")).toContainText(
    "Sidecar ready",
  );

  await expect(page.getByTestId("mocap-start")).toBeEnabled();
  await page.getByTestId("mocap-start").click();
  await expect(page.getByTestId("mocap-recording-indicator")).toBeVisible();

  await page.waitForTimeout(100);
  await page.getByTestId("mocap-stop").click();

  await expect(page.getByTestId("mocap-done")).toContainText(
    "Video-only recording",
  );
  expect(finalizeBody).not.toBeNull();
  expect(finalizeBody!.durationSec).toBeGreaterThan(0);
  expect(finalizeBody!.durationSec).toBeLessThan(60 * 60 * 8);
  expect(finalizeBody!.skipAnalysis).toBe(true);
  expect(finalizeBody!.qualityFlags).toContain("record-only");
});
