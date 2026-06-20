export type PoseCaptureSourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "capturing"
  | "stopping"
  | "stopped"
  | "error";

export interface PoseCaptureFrame {
  framesEncoded: number;
  landmarkCount: number;
  trackedKeypointCount: number;
  meanConfidence: number;
  qualityFlags: number;
  poseFrameBytes: Uint8Array;
  poseFrameBase64: string;
}

export interface PoseCaptureSourceOptions {
  sessionId?: string;
  videoEl: HTMLVideoElement;
  uploadPoseStream?: boolean;
  flushBytes?: number;
  flushIntervalMs?: number;
  onStatus?: (status: PoseCaptureSourceStatus, detail?: string) => void;
  onFrame?: (frame: PoseCaptureFrame) => void;
  onError?: (err: Error) => void;
}

export interface PoseCaptureSource {
  readonly status: PoseCaptureSourceStatus;
  readonly framesCaptured: number;
  init(): Promise<void>;
  start(): void | Promise<void>;
  stop(): Promise<void>;
  drain(): Promise<void>;
}
