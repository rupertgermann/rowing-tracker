export type RecordOnlyReason =
  | "missing-camera-api"
  | "missing-recorder-api"
  | "missing-pose-api"
  | "low-effective-fps";

export type MocapBrowserCapabilities = {
  getUserMedia: boolean;
  mediaRecorder: boolean;
  worker: boolean;
  createImageBitmap: boolean;
  requestAnimationFrame: boolean;
};

export type MocapCaptureSupport = {
  videoCaptureSupported: boolean;
  livePoseSupported: boolean;
  recordOnlyAvailable: boolean;
  recordOnlyRecommended: boolean;
  reason: RecordOnlyReason | null;
  message: string;
};

export type EffectiveFpsSample = {
  timestampMs: number;
  effectiveFps: number;
};

const MIN_LIVE_POSE_FPS = 12;
const LOW_FPS_WINDOW_MS = 3000;
const MIN_LOW_FPS_SAMPLES = 4;
const LOW_FPS_RATIO = 0.75;

export function readBrowserMocapCapabilities(
  target: typeof globalThis = globalThis,
): MocapBrowserCapabilities {
  const maybeNavigator = target.navigator as Navigator | undefined;
  return {
    getUserMedia:
      typeof maybeNavigator?.mediaDevices?.getUserMedia === "function",
    mediaRecorder: typeof target.MediaRecorder === "function",
    worker: typeof target.Worker === "function",
    createImageBitmap: typeof target.createImageBitmap === "function",
    requestAnimationFrame: typeof target.requestAnimationFrame === "function",
  };
}

export function evaluateMocapCaptureSupport(
  capabilities: MocapBrowserCapabilities,
): MocapCaptureSupport {
  if (!capabilities.getUserMedia) {
    return {
      videoCaptureSupported: false,
      livePoseSupported: false,
      recordOnlyAvailable: false,
      recordOnlyRecommended: false,
      reason: "missing-camera-api",
      message:
        "This browser cannot access the camera, so mocap recording is unavailable here.",
    };
  }

  if (!capabilities.mediaRecorder) {
    return {
      videoCaptureSupported: false,
      livePoseSupported: false,
      recordOnlyAvailable: false,
      recordOnlyRecommended: false,
      reason: "missing-recorder-api",
      message:
        "This browser can open the camera but cannot record video. Try another browser or device.",
    };
  }

  const livePoseSupported =
    capabilities.worker &&
    capabilities.createImageBitmap &&
    capabilities.requestAnimationFrame;

  if (!livePoseSupported) {
    return {
      videoCaptureSupported: true,
      livePoseSupported: false,
      recordOnlyAvailable: true,
      recordOnlyRecommended: true,
      reason: "missing-pose-api",
      message:
        "Live pose analysis is not supported in this browser. You can still record video for later review.",
    };
  }

  return {
    videoCaptureSupported: true,
    livePoseSupported: true,
    recordOnlyAvailable: true,
    recordOnlyRecommended: false,
    reason: null,
    message: "Live pose analysis is available.",
  };
}

export function hasSustainedLowEffectiveFps(
  samples: readonly EffectiveFpsSample[],
  opts: {
    nowMs?: number;
    minFps?: number;
    windowMs?: number;
    minSamples?: number;
  } = {},
): boolean {
  const nowMs = opts.nowMs ?? samples.at(-1)?.timestampMs ?? 0;
  const minFps = opts.minFps ?? MIN_LIVE_POSE_FPS;
  const windowMs = opts.windowMs ?? LOW_FPS_WINDOW_MS;
  const minSamples = opts.minSamples ?? MIN_LOW_FPS_SAMPLES;
  const recent = samples.filter(
    (sample) => sample.timestampMs >= nowMs - windowMs,
  );

  if (recent.length < minSamples) return false;

  const durationMs = recent.at(-1)!.timestampMs - recent[0].timestampMs;
  if (durationMs < windowMs * 0.75) return false;

  const lowSamples = recent.filter(
    (sample) => sample.effectiveFps > 0 && sample.effectiveFps < minFps,
  );
  return lowSamples.length / recent.length >= LOW_FPS_RATIO;
}

export function lowFpsRecordOnlySupport(): MocapCaptureSupport {
  return {
    videoCaptureSupported: true,
    livePoseSupported: true,
    recordOnlyAvailable: true,
    recordOnlyRecommended: true,
    reason: "low-effective-fps",
    message:
      "Live pose analysis is running too slowly on this device. Record-only mode will save video without live posture analysis.",
  };
}

export function recordOnlyQualityFlag(reason: RecordOnlyReason | null): string {
  if (reason === "missing-pose-api") return "missing-pose-api";
  if (reason === "low-effective-fps") return "low-effective-fps";
  return "record-only";
}
