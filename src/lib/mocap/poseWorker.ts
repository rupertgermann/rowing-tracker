/// <reference lib="webworker" />
/**
 * BrowserPoseSource Web Worker.
 *
 * Receives ImageBitmap frames from the main thread, runs MediaPipe Pose
 * Landmarker, posts back encoded PoseFrame bytes (BYTES_PER_FRAME_V1 each).
 * Main thread is responsible for capturing frames and uploading bytes.
 */
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  encodeFrame,
  KEYPOINTS_PER_FRAME_V1,
  QUALITY_FLAG,
  type PoseFrame,
} from "./poseFrameStream";

type InitMessage = {
  type: "init";
  wasmBaseUrl: string;
  modelAssetUrl: string;
  startTimeMs: number;
};

type FrameMessage = {
  type: "frame";
  bitmap: ImageBitmap;
  timestampMs: number;
};

type CloseMessage = { type: "close" };

type WorkerInbound = InitMessage | FrameMessage | CloseMessage;

type ReadyOut = { type: "ready" };
type FrameOut = {
  type: "frame";
  bytes: ArrayBuffer;
  framesEncoded: number;
  timestampMs: number;
  landmarkCount: number;
};
type ErrorOut = { type: "error"; message: string };

let landmarker: PoseLandmarker | null = null;
let captureStartMs = 0;
let framesEncoded = 0;
let busy = false;

function buildKeypointsFromLandmarks(
  landmarks: NormalizedLandmark[],
): { keypoints: Float32Array; lowConfidence: boolean } {
  const keypoints = new Float32Array(KEYPOINTS_PER_FRAME_V1 * 3);
  let lowConfidence = false;
  let lowConfidenceCount = 0;
  const limit = Math.min(landmarks.length, KEYPOINTS_PER_FRAME_V1);
  for (let i = 0; i < limit; i++) {
    const lm = landmarks[i];
    const visibility = lm.visibility ?? 0;
    keypoints[i * 3 + 0] = lm.x;
    keypoints[i * 3 + 1] = lm.y;
    keypoints[i * 3 + 2] = visibility;
    if (visibility < 0.4) lowConfidenceCount++;
  }
  if (lowConfidenceCount > KEYPOINTS_PER_FRAME_V1 * 0.3) {
    lowConfidence = true;
  }
  return { keypoints, lowConfidence };
}

async function init(msg: InitMessage): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(msg.wasmBaseUrl);
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: msg.modelAssetUrl,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  captureStartMs = msg.startTimeMs;
  framesEncoded = 0;
  const out: ReadyOut = { type: "ready" };
  postMessage(out);
}

function processFrame(msg: FrameMessage): void {
  if (!landmarker) {
    msg.bitmap.close();
    return;
  }
  if (busy) {
    // Drop frame to keep up. Keeps fps stable under load.
    msg.bitmap.close();
    return;
  }
  busy = true;
  try {
    const result = landmarker.detectForVideo(msg.bitmap, msg.timestampMs);
    const landmarks = result.landmarks?.[0] ?? [];

    let qualityFlags = 0;
    let keypoints: Float32Array;
    if (landmarks.length === 0) {
      keypoints = new Float32Array(KEYPOINTS_PER_FRAME_V1 * 3);
      qualityFlags |= QUALITY_FLAG.OUT_OF_FRAME;
    } else {
      const built = buildKeypointsFromLandmarks(landmarks);
      keypoints = built.keypoints;
      if (built.lowConfidence) qualityFlags |= QUALITY_FLAG.LOW_CONFIDENCE;
    }

    const frame: PoseFrame = {
      timestampMs: msg.timestampMs - captureStartMs,
      keypoints,
      qualityFlags,
    };
    const bytes = encodeFrame(frame);
    framesEncoded += 1;

    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    const out: FrameOut = {
      type: "frame",
      bytes: buf,
      framesEncoded,
      timestampMs: frame.timestampMs,
      landmarkCount: landmarks.length,
    };
    postMessage(out, [buf]);
  } catch (err) {
    const out: ErrorOut = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    postMessage(out);
  } finally {
    msg.bitmap.close();
    busy = false;
  }
}

function close(): void {
  landmarker?.close();
  landmarker = null;
}

self.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;
  switch (msg.type) {
    case "init":
      init(msg).catch((err) => {
        const out: ErrorOut = {
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        };
        postMessage(out);
      });
      break;
    case "frame":
      processFrame(msg);
      break;
    case "close":
      close();
      break;
  }
};
