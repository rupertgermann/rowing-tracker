"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HEADER_SIZE,
  BYTES_PER_FRAME_V1,
  KEYPOINTS_PER_FRAME_V1,
  decodeHeader,
  decodeFrame,
  frameByteOffset,
  type PoseStreamHeader,
} from "@/lib/mocap/poseFrameStream";

// MediaPipe 33-keypoint skeleton connections for side-view rowing
const SKELETON_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
  [27, 29], [27, 31], // left foot
  [28, 30], [28, 32], // right foot
];

interface PhaseBoundaries {
  catchFrameIndex: number;
  driveStartFrameIndex: number;
  finishFrameIndex: number;
  recoveryStartFrameIndex: number;
  nextCatchFrameIndex: number;
  confidence: number;
}

interface SessionStrokeMetric {
  id: string;
  strokeIndex: number;
  phaseBoundariesJson: PhaseBoundaries;
  segmentationSource: string;
}

interface FaultEvidence {
  metric: string;
  value: number;
  threshold: number;
  frameIndex?: number;
}

interface SessionFault {
  id: string;
  strokeIndex: number;
  faultType: string;
  severity: string;
  phase: string;
  evidenceJson: FaultEvidence;
}

interface MocapSessionDetail {
  id: string;
  status: string;
  capturePerspective: string;
  captureFps: number;
  durationSec: number;
  qualityScore: number | null;
  qualityFlags: string[];
  createdAt: string;
  strokePostureMetrics: SessionStrokeMetric[];
  postureFaults: SessionFault[];
}

async function fetchPoseHeader(id: string): Promise<PoseStreamHeader | null> {
  try {
    const res = await fetch(`/api/mocap/sessions/${id}/pose-stream`, {
      headers: { Range: `bytes=0-${HEADER_SIZE - 1}` },
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return decodeHeader(buf);
  } catch {
    return null;
  }
}

async function fetchPoseFrameAtIndex(
  id: string,
  frameIndex: number,
): Promise<Float32Array | null> {
  try {
    const start = frameByteOffset(frameIndex);
    const end = start + BYTES_PER_FRAME_V1 - 1;
    const res = await fetch(`/api/mocap/sessions/${id}/pose-stream`, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const frame = decodeFrame(buf, 0);
    return frame.keypoints;
  } catch {
    return null;
  }
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: Float32Array,
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number,
) {
  // Compute letterbox bounds (object-contain)
  const videoAspect = videoW / videoH;
  const canvasAspect = canvasW / canvasH;
  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (videoAspect > canvasAspect) {
    drawW = canvasW;
    drawH = canvasW / videoAspect;
    drawX = 0;
    drawY = (canvasH - drawH) / 2;
  } else {
    drawH = canvasH;
    drawW = canvasH * videoAspect;
    drawX = (canvasW - drawW) / 2;
    drawY = 0;
  }

  ctx.clearRect(0, 0, canvasW, canvasH);

  // Connections
  ctx.strokeStyle = "rgba(0, 220, 120, 0.85)";
  ctx.lineWidth = 2;
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const confA = keypoints[a * 3 + 2];
    const confB = keypoints[b * 3 + 2];
    if (confA < 0.3 || confB < 0.3) continue;
    const ax = drawX + keypoints[a * 3] * drawW;
    const ay = drawY + keypoints[a * 3 + 1] * drawH;
    const bx = drawX + keypoints[b * 3] * drawW;
    const by = drawY + keypoints[b * 3 + 1] * drawH;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // Keypoints
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  for (let i = 0; i < KEYPOINTS_PER_FRAME_V1; i++) {
    const conf = keypoints[i * 3 + 2];
    if (conf < 0.3) continue;
    const x = drawX + keypoints[i * 3] * drawW;
    const y = drawY + keypoints[i * 3 + 1] * drawH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function severityColor(severity: string) {
  if (severity === "critical") return "bg-red-500";
  if (severity === "warning") return "bg-yellow-500";
  return "bg-blue-400";
}

function faultLabel(faultType: string): string {
  return faultType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MocapReplayPage() {
  const { id } = useParams<{ id: string }>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const fetchingRef = useRef(false);
  const lastFrameIndexRef = useRef(-1);

  const [session, setSession] = useState<MocapSessionDetail | null>(null);
  const [poseHeader, setPoseHeader] = useState<PoseStreamHeader | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedFault, setSelectedFault] = useState<SessionFault | null>(null);
  const [selectedStroke, setSelectedStroke] = useState<number | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);

  // Load session data
  useEffect(() => {
    fetch(`/api/mocap/sessions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => setSession(data.session))
      .catch((e) => setLoadError(e.message));
  }, [id]);

  // Load pose stream header
  useEffect(() => {
    if (!session || session.status !== "ready") return;
    fetchPoseHeader(id).then(setPoseHeader);
  }, [id, session]);

  // Resize canvas to match video display dimensions
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const onMeta = () => {
      canvas.width = video.clientWidth || 1280;
      canvas.height = video.clientHeight || 720;
    };
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, []);

  const renderFrame = useCallback(
    async (frameIndex: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || fetchingRef.current) return;
      if (frameIndex === lastFrameIndexRef.current) return;

      fetchingRef.current = true;
      try {
        const keypoints = await fetchPoseFrameAtIndex(id, frameIndex);
        if (keypoints && canvas) {
          lastFrameIndexRef.current = frameIndex;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            drawSkeleton(
              ctx,
              keypoints,
              canvas.width,
              canvas.height,
              video.videoWidth || 1280,
              video.videoHeight || 720,
            );
          }
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [id],
  );

  // rAF loop during playback + seeked handler
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !poseHeader) return;

    const fps = poseHeader.fps;

    const loop = () => {
      if (!video.paused) {
        const fi = Math.floor(video.currentTime * fps);
        renderFrame(fi);
        animRef.current = requestAnimationFrame(loop);
      }
    };

    const onPlay = () => {
      animRef.current = requestAnimationFrame(loop);
    };
    const onPause = () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
    const onSeeked = () => {
      if (video.paused) {
        renderFrame(Math.floor(video.currentTime * fps));
      }
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [poseHeader, renderFrame]);

  const seekToFrame = useCallback(
    (frameIndex: number) => {
      const video = videoRef.current;
      if (!video || !poseHeader) return;
      video.currentTime = frameIndex / poseHeader.fps;
    },
    [poseHeader],
  );

  const seekToTime = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
  }, []);

  const runAnalysis = useCallback(async () => {
    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      const res = await fetch(`/api/mocap/sessions/${id}/reanalyze`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      // Refetch full session to get the new derived rows
      const dataRes = await fetch(`/api/mocap/sessions/${id}`);
      if (!dataRes.ok) throw new Error(`${dataRes.status}`);
      const data = await dataRes.json();
      setSession(data.session);
    } catch (e) {
      setReanalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setReanalyzing(false);
    }
  }, [id]);

  const freezeAtCatch = useCallback(() => {
    if (!selectedStroke || !session || !poseHeader) return;
    const metric = session.strokePostureMetrics.find(
      (m) => m.strokeIndex === selectedStroke,
    );
    if (metric) seekToFrame(metric.phaseBoundariesJson.catchFrameIndex);
  }, [selectedStroke, session, poseHeader, seekToFrame]);

  const freezeAtFinish = useCallback(() => {
    if (!selectedStroke || !session || !poseHeader) return;
    const metric = session.strokePostureMetrics.find(
      (m) => m.strokeIndex === selectedStroke,
    );
    if (metric) seekToFrame(metric.phaseBoundariesJson.finishFrameIndex);
  }, [selectedStroke, session, poseHeader, seekToFrame]);

  if (loadError) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <p className="text-red-600 text-sm">Failed to load session: {loadError}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/mocap/sessions">Back to sessions</Link>
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto max-w-4xl py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const duration = session.durationSec;
  const fps = poseHeader?.fps ?? session.captureFps;
  const hasMetrics = session.strokePostureMetrics.length > 0;
  const faultsByStroke = new Map<number, SessionFault[]>();
  for (const f of session.postureFaults) {
    if (!faultsByStroke.has(f.strokeIndex)) faultsByStroke.set(f.strokeIndex, []);
    faultsByStroke.get(f.strokeIndex)!.push(f);
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/mocap/sessions">← Sessions</Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{fmtDate(session.createdAt)}</h1>
            <p className="text-xs text-muted-foreground">
              {session.capturePerspective} · {fmtTime(duration)}
              {session.qualityScore !== null
                ? ` · quality ${Math.round(session.qualityScore * 100)}%`
                : ""}
            </p>
          </div>
        </div>
        <Badge variant={session.status === "ready" ? "default" : "secondary"}>
          {session.status}
        </Badge>
      </div>

      {/* Video + skeleton overlay */}
      <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          src={`/api/mocap/sessions/${id}/video`}
          controls
          playsInline
          preload="metadata"
          data-testid="mocap-replay-video"
        />
        {poseHeader ? (
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            data-testid="mocap-skeleton-canvas"
          />
        ) : null}
      </div>

      {/* Freeze controls + stroke selector */}
      {hasMetrics ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Stroke:{" "}
          </span>
          <select
            className="rounded border px-2 py-1 text-sm bg-transparent"
            value={selectedStroke ?? ""}
            onChange={(e) =>
              setSelectedStroke(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">— select stroke —</option>
            {session.strokePostureMetrics.map((m) => (
              <option key={m.strokeIndex} value={m.strokeIndex}>
                Stroke {m.strokeIndex + 1}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedStroke === null}
            onClick={freezeAtCatch}
            data-testid="mocap-freeze-catch"
          >
            Freeze at catch
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedStroke === null}
            onClick={freezeAtFinish}
            data-testid="mocap-freeze-finish"
          >
            Freeze at finish
          </Button>
          <span className="ml-auto font-mono text-sm text-muted-foreground">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>
        </div>
      ) : null}

      {/* Timeline */}
      {hasMetrics && duration > 0 ? (
        <div
          className="relative h-10 w-full cursor-pointer rounded bg-muted select-none"
          data-testid="mocap-timeline"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekToTime(((e.clientX - rect.left) / rect.width) * duration);
          }}
        >
          {/* Stroke markers */}
          {session.strokePostureMetrics.map((m) => {
            const t = m.phaseBoundariesJson.catchFrameIndex / fps;
            const pct = Math.min(100, (t / duration) * 100);
            return (
              <div
                key={m.strokeIndex}
                className="absolute top-0 h-full w-px bg-blue-400/60"
                style={{ left: `${pct}%` }}
              />
            );
          })}
          {/* Fault dots */}
          {session.postureFaults.map((f, i) => {
            const metric = session.strokePostureMetrics.find(
              (m) => m.strokeIndex === f.strokeIndex,
            );
            if (!metric) return null;
            const t = metric.phaseBoundariesJson.catchFrameIndex / fps;
            const pct = Math.min(100, (t / duration) * 100);
            return (
              <div
                key={i}
                className={`absolute top-1 h-2 w-2 -translate-x-1 cursor-pointer rounded-full ${severityColor(f.severity)}`}
                style={{ left: `${pct}%` }}
                title={`${faultLabel(f.faultType)} (${f.severity})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFault(f);
                  setSelectedStroke(f.strokeIndex);
                  const frameIndex = metric.phaseBoundariesJson.catchFrameIndex;
                  seekToFrame(frameIndex);
                }}
              />
            );
          })}
          {/* Playhead */}
          {duration > 0 ? (
            <div
              className="pointer-events-none absolute top-0 h-full w-0.5 bg-red-500"
              style={{ left: `${Math.min(100, (currentTime / duration) * 100)}%` }}
            />
          ) : null}
        </div>
      ) : null}

      {/* Not-yet-analyzed state */}
      {!hasMetrics && session.status === "ready" ? (
        <Card data-testid="mocap-no-analysis">
          <CardContent className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              No posture analysis for this session.
            </p>
            {reanalyzeError ? (
              <p className="text-sm text-red-600">Analysis failed: {reanalyzeError}</p>
            ) : null}
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={reanalyzing}
              data-testid="mocap-run-analysis"
            >
              {reanalyzing ? "Analyzing…" : "Run analysis"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      {hasMetrics ? (
        <div className="grid grid-cols-3 gap-3 text-sm sm:grid-cols-4">
          <StatBox label="Strokes" value={String(session.strokePostureMetrics.length)} />
          <StatBox label="Faults" value={String(session.postureFaults.length)} />
          <StatBox
            label="Critical"
            value={String(
              session.postureFaults.filter((f) => f.severity === "critical").length,
            )}
          />
          <StatBox
            label="Quality"
            value={
              session.qualityScore !== null
                ? `${Math.round(session.qualityScore * 100)}%`
                : "—"
            }
          />
        </div>
      ) : null}

      {/* Fault detail panel */}
      {selectedFault ? (
        <Card data-testid="mocap-fault-detail">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {faultLabel(selectedFault.faultType)}
              <Badge
                variant={selectedFault.severity === "critical" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {selectedFault.severity}
              </Badge>
              <span className="text-muted-foreground font-normal text-xs">
                phase: {selectedFault.phase} · stroke {selectedFault.strokeIndex + 1}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div>
              Metric: <code>{selectedFault.evidenceJson.metric}</code>
            </div>
            <div>
              Value: <code>{selectedFault.evidenceJson.value.toFixed(2)}</code> ·
              Threshold: <code>{selectedFault.evidenceJson.threshold.toFixed(2)}</code>
            </div>
            {selectedFault.evidenceJson.frameIndex !== undefined ? (
              <div>Frame: {selectedFault.evidenceJson.frameIndex}</div>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 h-6 px-2 text-xs"
              onClick={() => setSelectedFault(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* All faults list */}
      {hasMetrics && session.postureFaults.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">All faults</h2>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {session.postureFaults.map((f, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left rounded border p-2 text-xs hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelectedFault(f);
                  setSelectedStroke(f.strokeIndex);
                  const metric = session.strokePostureMetrics.find(
                    (m) => m.strokeIndex === f.strokeIndex,
                  );
                  if (metric) seekToFrame(metric.phaseBoundariesJson.catchFrameIndex);
                }}
              >
                <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${severityColor(f.severity)}`} />
                <span className="font-medium">{faultLabel(f.faultType)}</span>
                <span className="text-muted-foreground ml-1">
                  — stroke {f.strokeIndex + 1}, {f.phase}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
