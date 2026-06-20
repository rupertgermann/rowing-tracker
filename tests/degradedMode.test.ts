import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMocapCaptureSupport,
  hasSustainedLowEffectiveFps,
  readBrowserMocapCapabilities,
} from "../src/lib/mocap/degradedMode";

test("feature detection allows full mocap when recording and pose APIs exist", () => {
  const capabilities = readBrowserMocapCapabilities({
    navigator: {
      mediaDevices: { getUserMedia() {} },
    },
    MediaRecorder: function MediaRecorder() {},
    Worker: function Worker() {},
    createImageBitmap() {},
    requestAnimationFrame() {},
  } as unknown as typeof globalThis);

  const support = evaluateMocapCaptureSupport(capabilities);

  assert.equal(support.videoCaptureSupported, true);
  assert.equal(support.livePoseSupported, true);
  assert.equal(support.recordOnlyRecommended, false);
  assert.equal(support.reason, null);
});

test("feature detection offers record-only when pose APIs are missing", () => {
  const support = evaluateMocapCaptureSupport({
    getUserMedia: true,
    mediaRecorder: true,
    worker: false,
    createImageBitmap: true,
    requestAnimationFrame: true,
  });

  assert.equal(support.videoCaptureSupported, true);
  assert.equal(support.livePoseSupported, false);
  assert.equal(support.recordOnlyAvailable, true);
  assert.equal(support.recordOnlyRecommended, true);
  assert.equal(support.reason, "missing-pose-api");
});

test("feature detection blocks capture when video recording APIs are missing", () => {
  const support = evaluateMocapCaptureSupport({
    getUserMedia: true,
    mediaRecorder: false,
    worker: true,
    createImageBitmap: true,
    requestAnimationFrame: true,
  });

  assert.equal(support.videoCaptureSupported, false);
  assert.equal(support.recordOnlyAvailable, false);
  assert.equal(support.reason, "missing-recorder-api");
});

test("low effective FPS must be sustained before record-only is recommended", () => {
  assert.equal(
    hasSustainedLowEffectiveFps(
      [
        { timestampMs: 0, effectiveFps: 9 },
        { timestampMs: 1000, effectiveFps: 8 },
        { timestampMs: 2000, effectiveFps: 10 },
        { timestampMs: 3000, effectiveFps: 7 },
      ],
      { nowMs: 3000 },
    ),
    true,
  );

  assert.equal(
    hasSustainedLowEffectiveFps(
      [
        { timestampMs: 0, effectiveFps: 9 },
        { timestampMs: 1000, effectiveFps: 18 },
        { timestampMs: 2000, effectiveFps: 10 },
        { timestampMs: 3000, effectiveFps: 20 },
      ],
      { nowMs: 3000 },
    ),
    false,
  );
});
