/**
 * BrowserPoseSource: main-thread orchestration for the pose worker.
 *
 * Owns the worker, the upload queue, and the per-frame ImageBitmap pipeline.
 * Frames flow: <video> → grabFrame() → postMessage(bitmap) → worker → encoded
 * PoseFrame bytes → upload queue → POST /api/mocap/sessions/:id/pose-stream.
 */

import { BYTES_PER_FRAME_V1 } from "./poseFrameStream";

export const POSE_MODEL_URL =
  process.env.NEXT_PUBLIC_MOCAP_POSE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

export const MEDIAPIPE_WASM_BASE =
  process.env.NEXT_PUBLIC_MOCAP_MEDIAPIPE_WASM_BASE ??
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

export type PoseSourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "capturing"
  | "stopping"
  | "stopped"
  | "error";

export interface PoseSourceOptions {
  sessionId?: string;
  videoEl: HTMLVideoElement;
  uploadPoseStream?: boolean;
  flushBytes?: number;
  flushIntervalMs?: number;
  onStatus?: (s: PoseSourceStatus, detail?: string) => void;
  onFrame?: (info: {
    framesEncoded: number;
    landmarkCount: number;
    trackedKeypointCount: number;
    meanConfidence: number;
    qualityFlags: number;
    poseFrameBase64: string;
  }) => void;
  onError?: (err: Error) => void;
}

export class BrowserPoseSource {
  private worker: Worker | null = null;
  private pendingChunks: Uint8Array[] = [];
  private pendingBytes = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private uploadInflight: Promise<void> = Promise.resolve();
  private framesEncoded = 0;
  private capturing = false;
  private rvfcHandle: number | null = null;
  private status: PoseSourceStatus = "idle";
  private readonly flushBytes: number;
  private readonly flushIntervalMs: number;
  private readonly uploadPoseStream: boolean;

  constructor(private readonly opts: PoseSourceOptions) {
    this.flushBytes = opts.flushBytes ?? BYTES_PER_FRAME_V1 * 12;
    this.flushIntervalMs = opts.flushIntervalMs ?? 500;
    this.uploadPoseStream = opts.uploadPoseStream ?? true;
    if (this.uploadPoseStream && !opts.sessionId) {
      throw new Error("sessionId is required when pose stream upload is enabled");
    }
  }

  get framesCaptured(): number {
    return this.framesEncoded;
  }

  async init(): Promise<void> {
    this.setStatus("loading");
    this.worker = new Worker(new URL("./poseWorker.ts", import.meta.url), {
      type: "module",
    });
    await new Promise<void>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg?.type === "ready") {
          this.worker!.removeEventListener("message", onMessage);
          this.worker!.removeEventListener("error", onError);
          this.worker!.addEventListener("message", this.handleWorkerMessage);
          resolve();
        } else if (msg?.type === "error") {
          this.worker!.removeEventListener("message", onMessage);
          this.worker!.removeEventListener("error", onError);
          reject(new Error(msg.message));
        }
      };
      const onError = (event: ErrorEvent) => {
        this.worker!.removeEventListener("message", onMessage);
        this.worker!.removeEventListener("error", onError);
        reject(new Error(event.message ?? "Worker init failed"));
      };
      this.worker!.addEventListener("message", onMessage);
      this.worker!.addEventListener("error", onError);
      this.worker!.postMessage({
        type: "init",
        wasmBaseUrl: MEDIAPIPE_WASM_BASE,
        modelAssetUrl: POSE_MODEL_URL,
        startTimeMs: performance.now(),
      });
    });
    this.setStatus("ready");
  }

  start(): void {
    if (!this.worker) throw new Error("PoseSource not initialised");
    this.capturing = true;
    this.setStatus("capturing");
    this.flushTimer = setInterval(() => this.flush(false), this.flushIntervalMs);
    this.scheduleFrame();
  }

  async stop(): Promise<void> {
    this.capturing = false;
    this.setStatus("stopping");
    if (this.rvfcHandle !== null && "cancelVideoFrameCallback" in this.opts.videoEl) {
      (this.opts.videoEl as HTMLVideoElement).cancelVideoFrameCallback(
        this.rvfcHandle,
      );
      this.rvfcHandle = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush(true);
    await this.uploadInflight;
    this.worker?.postMessage({ type: "close" });
    this.worker?.terminate();
    this.worker = null;
    this.setStatus("stopped");
  }

  private scheduleFrame(): void {
    if (!this.capturing) return;
    const video = this.opts.videoEl;
    if (typeof video.requestVideoFrameCallback === "function") {
      this.rvfcHandle = video.requestVideoFrameCallback((now) => {
        this.handleFrame(now);
        this.scheduleFrame();
      });
    } else {
      requestAnimationFrame(() => {
        this.handleFrame(performance.now());
        this.scheduleFrame();
      });
    }
  }

  private async handleFrame(timestampMs: number): Promise<void> {
    const video = this.opts.videoEl;
    if (!this.worker || !this.capturing || video.readyState < 2) return;
    try {
      const bitmap = await createImageBitmap(video);
      this.worker.postMessage(
        { type: "frame", bitmap, timestampMs },
        [bitmap],
      );
    } catch (err) {
      this.opts.onError?.(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  private handleWorkerMessage = (event: MessageEvent) => {
    const msg = event.data;
    if (msg?.type === "frame") {
      this.framesEncoded = msg.framesEncoded;
      const bytes = new Uint8Array(msg.bytes);
      if (this.uploadPoseStream) {
        this.pendingChunks.push(bytes);
        this.pendingBytes += bytes.byteLength;
      }
      this.opts.onFrame?.({
        framesEncoded: msg.framesEncoded,
        landmarkCount: msg.landmarkCount,
        trackedKeypointCount: msg.trackedKeypointCount,
        meanConfidence: msg.meanConfidence,
        qualityFlags: msg.qualityFlags,
        poseFrameBase64: bytesToBase64(bytes),
      });
      if (this.uploadPoseStream && this.pendingBytes >= this.flushBytes) {
        this.flush(false);
      }
    } else if (msg?.type === "error") {
      const err = new Error(msg.message);
      this.opts.onError?.(err);
      this.setStatus("error", msg.message);
    }
  };

  private async flush(final: boolean): Promise<void> {
    if (this.pendingChunks.length === 0) {
      if (final) await this.uploadInflight;
      return;
    }
    const chunks = this.pendingChunks;
    const total = this.pendingBytes;
    this.pendingChunks = [];
    this.pendingBytes = 0;
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    this.uploadInflight = this.uploadInflight.then(() =>
      this.upload(buf).catch((err) => {
        this.opts.onError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }),
    );
    if (final) await this.uploadInflight;
  }

  private async upload(buf: Uint8Array): Promise<void> {
    if (!this.opts.sessionId) {
      throw new Error("Cannot upload pose stream without a session id");
    }
    const res = await fetch(
      `/api/mocap/sessions/${this.opts.sessionId}/pose-stream`,
      {
        method: "POST",
        body: new Blob([buf as BlobPart], {
          type: "application/octet-stream",
        }),
        headers: { "Content-Type": "application/octet-stream" },
      },
    );
    if (!res.ok) {
      throw new Error(`Pose upload failed: ${res.status}`);
    }
  }

  private setStatus(s: PoseSourceStatus, detail?: string): void {
    this.status = s;
    this.opts.onStatus?.(s, detail);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
