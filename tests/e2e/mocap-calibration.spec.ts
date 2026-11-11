import { expect, test } from "@playwright/test";
import { encodeFrame } from "../../src/lib/mocap/poseFrameStream";

// Camera/worker boundary fixture: 45° torso, with a 90° finish reference.
function pose(index: number, vertical = false) {
  const points = Array.from({ length: 33 }, () => [0.5, 0.5, 1]);
  points[12] = [vertical ? 0.5 : 0.75, 0.25, 1];
  points[14] = [0.7, 0.4, 1];
  points[16] = [0.8, 0.5, 1];
  points[24] = [0.5, 0.5, 1];
  points[26] = [0.6 + 0.15 * (1 - Math.cos(2 * Math.PI * index / 90)), 0.5, 1];
  points[28] = [0.8, 0.8, 1];
  return Array.from(encodeFrame({ timestampMs: index * 1000 / 24, keypoints: new Float32Array(points.flat()), qualityFlags: 0 }));
}

test("live completed stroke displays the captured reference differences", async ({ page }) => {
  await page.route("**/api/**", route => {
    const url = route.request().url();
    if (url.endsWith("/api/auth/session")) return route.fulfill({ json: {} });
    if (url.endsWith("/api/mocap/sessions")) return route.fulfill({ json: { id: "calibration-test" } });
    return route.fulfill({ json: { ok: true } });
  });
  await page.addInitScript(({ recording, finish }) => {
    let frameIndex = 0;
    class PoseWorker extends EventTarget {
      postMessage(message: { type: string; bitmap?: ImageBitmap }) {
        if (message.type === "init") {
          setTimeout(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "ready" } })), 0);
        } else if (message.type === "frame") {
          message.bitmap?.close();
          const stage = document.documentElement.dataset.poseStage;
          const bytes = new Uint8Array(stage === "finish" ? finish : recording[stage === "recording" ? frameIndex++ % recording.length : 0]);
          this.dispatchEvent(new MessageEvent("message", { data: { type: "frame", bytes: bytes.buffer, framesEncoded: frameIndex, landmarkCount: 33, trackedKeypointCount: 33, meanConfidence: 1, qualityFlags: 0 } }));
        }
      }
      terminate() {}
    }
    Object.defineProperty(window, "Worker", { value: PoseWorker });
  }, { recording: Array.from({ length: 270 }, (_, i) => pose(i)), finish: pose(0, true) });
  await page.goto("/mocap");
  await page.getByTestId("mocap-start-calibration").click();
  await page.getByTestId("mocap-capture-catch").click();
  await page.evaluate(() => { document.documentElement.dataset.poseStage = "finish"; });
  await page.waitForTimeout(200);
  await page.getByTestId("mocap-capture-finish").click();
  await page.evaluate(() => { document.documentElement.dataset.poseStage = "recording"; });
  await page.getByTestId("mocap-start").click();
  await expect(page.getByTestId("mocap-calibration-comparison")).toContainText("Catch: 0.0° · Finish: -45.0°", { timeout: 20000 });
  await page.getByTestId("mocap-stop").click();
});
