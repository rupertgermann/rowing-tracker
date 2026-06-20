import {
  checkSidecarHealth,
  SIDECAR_DEFAULT_PORT,
  startSidecarSession,
  stopSidecarSession,
  type SidecarHealth,
  type SidecarSessionInfo,
} from "./sidecarClient";
import type {
  PoseCaptureSource,
  PoseCaptureSourceStatus,
} from "./poseCaptureSource";

export interface SidecarPoseSourceOptions {
  port?: number | null;
  onStatus?: (status: PoseCaptureSourceStatus, detail?: string) => void;
  onError?: (err: Error) => void;
}

export function resolveSidecarPort(port: number | null | undefined): number {
  return typeof port === "number" && Number.isInteger(port) && port > 0
    ? port
    : SIDECAR_DEFAULT_PORT;
}

export class FreemocapSidecarSource implements PoseCaptureSource {
  private sourceStatus: PoseCaptureSourceStatus = "idle";
  private frameCount = 0;
  private currentHealth: SidecarHealth | null = null;
  private currentSession: SidecarSessionInfo | null = null;
  readonly port: number;

  constructor(private readonly opts: SidecarPoseSourceOptions = {}) {
    this.port = resolveSidecarPort(opts.port);
  }

  get status(): PoseCaptureSourceStatus {
    return this.sourceStatus;
  }

  get framesCaptured(): number {
    return this.frameCount;
  }

  get health(): SidecarHealth | null {
    return this.currentHealth;
  }

  get sidecarSession(): SidecarSessionInfo | null {
    return this.currentSession;
  }

  async init(): Promise<void> {
    this.setStatus("loading");
    try {
      const health = await checkSidecarHealth(this.port);
      if (health.status !== "ready") {
        throw new Error(`Sidecar not ready: ${health.status}`);
      }
      this.currentHealth = health;
      this.setStatus("ready");
    } catch (err) {
      const error =
        err instanceof Error && err.message.startsWith("Sidecar not ready:")
          ? err
          : new Error(`Sidecar not reachable on port ${this.port}`);
      this.reportError(error);
      throw error;
    }
  }

  async connect(sessionId: string): Promise<void> {
    try {
      const res = await fetch(`/api/mocap/sessions/${sessionId}/sidecar/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: this.port }),
      });
      if (!res.ok) {
        throw new Error(`Sidecar connect failed: ${res.status}`);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.reportError(error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.sourceStatus !== "ready") {
      await this.init();
    }

    try {
      this.currentSession = await startSidecarSession(this.port);
      this.setStatus("capturing");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.reportError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.sourceStatus === "idle" || this.sourceStatus === "stopped") {
      return;
    }

    this.setStatus("stopping");
    if (!this.currentSession) {
      this.setStatus("stopped");
      return;
    }

    try {
      await stopSidecarSession(this.port);
      this.setStatus("stopped");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.reportError(error);
      throw error;
    }
  }

  async drain(): Promise<void> {
    // Sidecar frames are owned by the sidecar process in this record-only path.
  }

  private setStatus(s: PoseCaptureSourceStatus, detail?: string): void {
    this.sourceStatus = s;
    this.opts.onStatus?.(s, detail);
  }

  private reportError(err: Error): void {
    this.setStatus("error", err.message);
    this.opts.onError?.(err);
  }
}
