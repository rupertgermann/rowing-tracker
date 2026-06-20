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
