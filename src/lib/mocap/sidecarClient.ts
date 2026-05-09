export const SIDECAR_DEFAULT_PORT = 8765;

export interface SidecarHealth {
  status: "ready" | "initializing" | "error";
  fps: number;
  cameras: number;
  schemaVersion: number;
}

export interface SidecarSessionInfo {
  sessionId: string;
  calibrationId: string;
}

export interface SidecarKeypointFrame {
  frameIndex: number;
  timestampMs: number;
  keypoints: Array<{
    index: number;
    x: number;
    y: number;
    z: number;
    confidence: number;
  }>;
  quality: {
    trackedCount: number;
    meanConfidence: number;
    reprojectionErrorMm?: number;
    cameraCount?: number;
  };
}

export async function checkSidecarHealth(port = SIDECAR_DEFAULT_PORT): Promise<SidecarHealth> {
  const res = await fetch(`http://localhost:${port}/health`);
  if (!res.ok) throw new Error(`Sidecar health check failed: ${res.status}`);
  return res.json() as Promise<SidecarHealth>;
}

export async function startSidecarSession(port = SIDECAR_DEFAULT_PORT): Promise<SidecarSessionInfo> {
  const res = await fetch(`http://localhost:${port}/session/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Sidecar session/start failed: ${res.status}`);
  return res.json() as Promise<SidecarSessionInfo>;
}

export async function stopSidecarSession(port = SIDECAR_DEFAULT_PORT): Promise<void> {
  await fetch(`http://localhost:${port}/session/stop`, { method: "POST" });
}

export function connectSidecarStream(
  port: number,
  onFrame: (frame: SidecarKeypointFrame) => void,
  onError: (err: Error) => void,
): () => void {
  const ws = new WebSocket(`ws://localhost:${port}/pose-stream`);
  ws.onmessage = (e) => {
    try {
      onFrame(JSON.parse(e.data as string) as SidecarKeypointFrame);
    } catch {
      onError(new Error("Failed to parse sidecar frame"));
    }
  };
  ws.onerror = () => onError(new Error("Sidecar WebSocket error"));
  return () => ws.close();
}
