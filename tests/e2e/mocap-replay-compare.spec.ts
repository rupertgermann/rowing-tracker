import { expect, test } from "@playwright/test";

const session = {
  id: "mock-session",
  status: "ready",
  capturePerspective: "side-left",
  captureFps: 30,
  durationSec: 12,
  qualityScore: 0.92,
  qualityFlags: [],
  createdAt: "2026-05-09T10:00:00.000Z",
  strokePostureMetrics: [
    metric(0, 0),
    metric(1, 90),
    metric(2, 180),
    metric(3, 270),
  ],
  postureFaults: [
    fault("fault-0", 0, "warning", "rounded_back_at_catch"),
    fault("fault-2a", 2, "critical", "excessive_layback"),
    fault("fault-2b", 2, "info", "slow_recovery_ratio"),
  ],
};

test("replay comparison controls render and select strokes", async ({ page }) => {
  await page.route("**/api/mocap/sessions/mock-session", (route) =>
    route.fulfill({ json: { session } }),
  );
  await page.route("**/api/mocap/sessions/mock-session/video", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route("**/api/mocap/sessions/mock-session/pose-stream", (route) =>
    route.fulfill({ status: 404 }),
  );

  await page.goto("/mocap/sessions/mock-session");

  await expect(page.getByTestId("mocap-stroke-compare")).toBeVisible();

  const faultSelect = page.getByTestId("mocap-compare-fault-stroke");
  const cleanSelect = page.getByTestId("mocap-compare-clean-stroke");

  await expect(faultSelect).toHaveValue("2");
  await expect(cleanSelect).toHaveValue("1");

  await faultSelect.selectOption("0");
  await expect(faultSelect).toHaveValue("0");

  await cleanSelect.selectOption("3");
  await expect(cleanSelect).toHaveValue("3");
});

function metric(strokeIndex: number, startFrame: number) {
  return {
    id: `metric-${strokeIndex}`,
    strokeIndex,
    segmentationSource: "pose-segmented",
    phaseBoundariesJson: {
      catchFrameIndex: startFrame,
      driveStartFrameIndex: startFrame + 10,
      finishFrameIndex: startFrame + 30,
      recoveryStartFrameIndex: startFrame + 35,
      nextCatchFrameIndex: startFrame + 60,
      confidence: 0.9,
    },
    metricsJson: {
      backAngleAtCatchDeg: 24 + strokeIndex,
      backAngleAtFinishDeg: 55 + strokeIndex,
      laybackAngleDeg: 28 + strokeIndex,
      hipKneeOpeningOffsetFrames: 3,
      armBendBeforeLegsCompleteFrames: null,
      recoveryDriveRatio: 1.8,
      shinVerticalAtCatchDeg: {
        available: false,
        reason: "requires-sidecar-3d",
      },
    },
  };
}

function fault(
  id: string,
  strokeIndex: number,
  severity: string,
  faultType: string,
) {
  return {
    id,
    strokeIndex,
    severity,
    faultType,
    phase: "catch",
    evidenceJson: {
      metric: "backAngleAtCatchDeg",
      value: 24,
      threshold: 30,
    },
  };
}
