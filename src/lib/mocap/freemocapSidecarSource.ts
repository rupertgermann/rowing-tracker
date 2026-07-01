import {
  BYTES_PER_FRAME_V2,
  KEYPOINT_SCHEMA_V2,
  KEYPOINTS_PER_FRAME_V2,
  QUALITY_FLAG,
  encodeFrameV2,
  type PoseFrame,
} from "./poseFrameStream";
import type {
  PoseCaptureFrame,
  PoseCaptureSource,
  PoseCaptureSourceStatus,
} from "./poseCaptureSource";
import {
  SIDECAR_DEFAULT_PORT,
  connectSidecarStream,
  stopSidecarSession,
  type SidecarKeypointFrame,
} from "./sidecarClient";
import { PoseStreamUploadBuffer } from "./poseStreamUploadBuffer";

export interface FreemocapSidecarSourceOptions {
  sessionId: string;
  port?: number;
  cameraCount?: number;
  uploadPoseStream?: boolean;
  flushBytes?: number;
  flushIntervalMs?: number;
  onStatus?: (status: PoseCaptureSourceStatus, detail?: string) => void;
  onFrame?: (frame: PoseCaptureFrame) => void;
  onError?: (err: Error) => void;
}

interface SidecarConnectResponse {
  sidecarSessionId?: string | null;
  sessionId?: string | null;
  calibrationId?: string | null;
}

const SIDECAR_RELEVANT_TRACKED_KEYPOINTS = 13;

export class FreemocapSidecarSource implements PoseCaptureSource {
  private closeStream: (() => void) | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private uploadBuffer: PoseStreamUploadBuffer | null = null;
  private sourceStatus: PoseCaptureSourceStatus = "idle";
  private framesEncoded = 0;
  private capturing = false;
  private sidecarStarted = false;
  private firstSidecarTimestampMs: number | null = null;
  private readonly port: number;
  private readonly uploadPoseStream: boolean;
  readonly cameraCount: number;
  sidecarSessionId: string | null = null;
  calibrationId: string | null = null;

  constructor(private readonly opts: FreemocapSidecarSourceOptions) {
    this.port = opts.port ?? SIDECAR_DEFAULT_PORT;
    this.cameraCount = opts.cameraCount ?? 1;
    this.uploadPoseStream = opts.uploadPoseStream ?? true;
    if (this.uploadPoseStream) {
      this.uploadBuffer = new PoseStreamUploadBuffer({
        sessionId: opts.sessionId,
        flushBytes: opts.flushBytes ?? BYTES_PER_FRAME_V2 * 12,
        onError: opts.onError,
      });
    }
  }

  get status(): PoseCaptureSourceStatus {
    return this.sourceStatus;
  }

  get framesCaptured(): number {
    return this.framesEncoded;
  }

  async init(): Promise<void> {
    this.setStatus("ready");
  }

  async start(): Promise<void> {
    if (this.capturing) return;
    this.setStatus("loading");
    try {
      this.firstSidecarTimestampMs = null;
      const session = await this.startSidecarSession();
      this.sidecarStarted = true;
      this.sidecarSessionId = session.sidecarSessionId ?? session.sessionId ?? null;
      this.calibrationId = session.calibrationId ?? null;
      this.closeStream = connectSidecarStream(
        this.port,
        this.handleStreamFrame,
        this.handleStreamError,
      );
      this.capturing = true;
      this.flushTimer = setInterval(
        () => void this.uploadBuffer?.flush(false),
        this.opts.flushIntervalMs ?? 500,
      );
      this.setStatus("capturing");
    } catch (err) {
      const error = toError(err);
      this.setStatus("error", error.message);
      this.opts.onError?.(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    const shouldStopSidecar = this.sidecarStarted;
    this.sidecarStarted = false;
    this.setStatus("stopping");

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    let stopError: Error | null = null;
    if (shouldStopSidecar) {
      try {
        await stopSidecarSession(this.port);
      } catch (err) {
        stopError = toError(err);
      }
    }

    this.capturing = false;
    this.closeStream?.();
    this.closeStream = null;

    await this.drain();
    this.firstSidecarTimestampMs = null;

    if (stopError) {
      this.setStatus("error", stopError.message);
      this.opts.onError?.(stopError);
      throw stopError;
    }

    this.setStatus("stopped");
  }

  async drain(): Promise<void> {
    await this.uploadBuffer?.drain();
  }

  private async startSidecarSession(): Promise<SidecarConnectResponse> {
    const res = await fetch(
      `/api/mocap/sessions/${this.opts.sessionId}/sidecar/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: this.port }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as unknown;
      throw new Error(sidecarConnectFailureMessage(res.status, body));
    }
    const body = (await res.json().catch(() => ({}))) as unknown;
    if (!isRecord(body)) return {};
    return {
      sidecarSessionId: optionalString(body.sidecarSessionId),
      sessionId: optionalString(body.sessionId),
      calibrationId: optionalString(body.calibrationId),
    };
  }

  private handleStreamFrame = (message: unknown) => {
    if (!this.capturing) return;
    try {
      const frame = validateSidecarKeypointFrame(message);
      this.firstSidecarTimestampMs ??= frame.timestampMs;
      const poseFrameBytes = encodeSidecarPoseFrame(
        frame,
        this.firstSidecarTimestampMs,
      );
      this.framesEncoded += 1;
      this.uploadBuffer?.enqueue(poseFrameBytes);
      this.opts.onFrame?.({
        framesEncoded: this.framesEncoded,
        landmarkCount: KEYPOINTS_PER_FRAME_V2,
        trackedKeypointCount: sidecarTrackedCountForPoseQuality(
          frame.quality.trackedCount,
        ),
        meanConfidence: frame.quality.meanConfidence,
        qualityFlags: sidecarQualityFlags(frame),
        poseFrameBytes,
        poseFrameBase64: bytesToBase64(poseFrameBytes),
      });
    } catch (err) {
      const error = toError(err);
      this.setStatus("error", error.message);
      this.opts.onError?.(error);
    }
  };

  private handleStreamError = (err: Error) => {
    if (!this.capturing) return;
    this.setStatus("error", err.message);
    this.opts.onError?.(err);
  };

  private setStatus(status: PoseCaptureSourceStatus, detail?: string): void {
    this.sourceStatus = status;
    this.opts.onStatus?.(status, detail);
  }
}

function sidecarConnectFailureMessage(status: number, body: unknown): string {
  if (!isRecord(body)) return `Sidecar session/start failed: ${status}`;
  const statusText = optionalString(body.status) ?? optionalString(body.error);
  const diagnostics = Array.isArray(body.diagnostics)
    ? body.diagnostics.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  const details = [statusText, ...diagnostics].filter(Boolean).join(": ");
  return details
    ? `Sidecar session/start failed: ${status} (${details})`
    : `Sidecar session/start failed: ${status}`;
}

export function encodeSidecarPoseFrame(
  frame: SidecarKeypointFrame,
  timestampOriginMs = frame.timestampMs,
): Uint8Array {
  const poseFrame: PoseFrame = {
    timestampMs: Math.max(0, frame.timestampMs - timestampOriginMs),
    keypoints: sidecarKeypointsToQuads(frame),
    qualityFlags: sidecarQualityFlags(frame),
  };
  return encodeFrameV2(poseFrame);
}

export function validateSidecarKeypointFrame(
  message: unknown,
): SidecarKeypointFrame {
  if (!isRecord(message)) {
    throw new Error("Sidecar frame must be an object");
  }

  const schemaVersion = optionalNumber(
    pickField(message, "schemaVersion", "schema_version"),
  );
  if (schemaVersion !== undefined && schemaVersion !== KEYPOINT_SCHEMA_V2) {
    throw new Error("Sidecar frame schemaVersion must be 2");
  }
  const source = optionalString(message.source);
  if (source !== undefined && source !== "sidecar-3d") {
    throw new Error("Sidecar frame source must be sidecar-3d");
  }

  const frameIndex = requiredInteger(
    pickField(message, "frameIndex", "frame_index"),
    "frameIndex",
    { min: 0 },
  );
  const timestampMs = requiredNumber(
    pickField(message, "timestampMs", "timestamp_ms"),
    "timestampMs",
    { min: 0 },
  );
  const keypoints = message.keypoints;
  if (!Array.isArray(keypoints)) {
    throw new Error("Sidecar frame keypoints must be an array");
  }
  if (keypoints.length !== KEYPOINTS_PER_FRAME_V2) {
    throw new Error(
      `Sidecar frame must contain ${KEYPOINTS_PER_FRAME_V2} keypoints`,
    );
  }

  const seen = new Set<number>();
  const normalizedKeypoints = keypoints.map((keypoint, offset) => {
    if (!isRecord(keypoint)) {
      throw new Error(`Sidecar keypoint ${offset} must be an object`);
    }
    const index = requiredInteger(keypoint.index, `keypoints[${offset}].index`, {
      min: 0,
      max: KEYPOINTS_PER_FRAME_V2 - 1,
    });
    if (seen.has(index)) {
      throw new Error(`Duplicate sidecar keypoint index ${index}`);
    }
    seen.add(index);
    return {
      index,
      x: requiredNumber(keypoint.x, `keypoints[${offset}].x`),
      y: requiredNumber(keypoint.y, `keypoints[${offset}].y`),
      z: requiredNumber(keypoint.z, `keypoints[${offset}].z`),
      confidence: requiredNumber(
        keypoint.confidence,
        `keypoints[${offset}].confidence`,
        { min: 0, max: 1 },
      ),
    };
  });

  const quality = message.quality;
  if (!isRecord(quality)) {
    throw new Error("Sidecar frame quality must be an object");
  }
  return {
    frameIndex,
    timestampMs,
    keypoints: normalizedKeypoints,
    quality: {
      trackedCount: requiredInteger(
        pickField(quality, "trackedCount", "tracked_count"),
        "quality.trackedCount",
        { min: 0, max: KEYPOINTS_PER_FRAME_V2 },
      ),
      meanConfidence: requiredNumber(
        pickField(quality, "meanConfidence", "mean_confidence"),
        "quality.meanConfidence",
        { min: 0, max: 1 },
      ),
      reprojectionErrorMm: optionalNumber(
        pickField(quality, "reprojectionErrorMm", "reprojection_error_mm"),
        { min: 0 },
      ),
      cameraCount: optionalInteger(
        pickField(quality, "cameraCount", "camera_count"),
        { min: 1 },
      ),
    },
  };
}

function sidecarKeypointsToQuads(frame: SidecarKeypointFrame): Float32Array {
  const out = new Float32Array(KEYPOINTS_PER_FRAME_V2 * 4);
  for (const point of frame.keypoints) {
    const offset = point.index * 4;
    out[offset] = point.x;
    out[offset + 1] = point.y;
    out[offset + 2] = point.z;
    out[offset + 3] = point.confidence;
  }
  return out;
}

function sidecarQualityFlags(frame: SidecarKeypointFrame): number {
  if (
    frame.quality.meanConfidence < 0.6 ||
    frame.quality.trackedCount < 13
  ) {
    return QUALITY_FLAG.LOW_CONFIDENCE;
  }
  return 0;
}

function sidecarTrackedCountForPoseQuality(trackedCount: number): number {
  return Math.min(
    KEYPOINTS_PER_FRAME_V2,
    Math.round(
      (trackedCount / SIDECAR_RELEVANT_TRACKED_KEYPOINTS) *
        KEYPOINTS_PER_FRAME_V2,
    ),
  );
}

function requiredNumber(
  value: unknown,
  field: string,
  bounds: { min?: number; max?: number } = {},
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Sidecar ${field} must be a finite number`);
  }
  if (bounds.min !== undefined && value < bounds.min) {
    throw new Error(`Sidecar ${field} must be >= ${bounds.min}`);
  }
  if (bounds.max !== undefined && value > bounds.max) {
    throw new Error(`Sidecar ${field} must be <= ${bounds.max}`);
  }
  return value;
}

function requiredInteger(
  value: unknown,
  field: string,
  bounds: { min?: number; max?: number } = {},
): number {
  const number = requiredNumber(value, field, bounds);
  if (!Number.isInteger(number)) {
    throw new Error(`Sidecar ${field} must be an integer`);
  }
  return number;
}

function optionalNumber(
  value: unknown,
  bounds: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredNumber(value, "optional field", bounds);
}

function optionalInteger(
  value: unknown,
  bounds: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredInteger(value, "optional field", bounds);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pickField(
  value: Record<string, unknown>,
  camelCase: string,
  snakeCase: string,
): unknown {
  return value[camelCase] ?? value[snakeCase];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
