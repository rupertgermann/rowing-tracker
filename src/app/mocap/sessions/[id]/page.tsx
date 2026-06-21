"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRowingStore } from "@/lib/store";
import { clearSessionsCache } from "@/lib/services/sessionsCache";
import {
  HEADER_SIZE,
  KEYPOINT_SCHEMA_V2,
  KEYPOINTS_PER_FRAME_V1,
  decodeHeader,
  decodeFrame,
  type PoseStreamHeader,
} from "@/lib/mocap/poseFrameStream";
import {
  buildReplayComparisonOptions,
  countFaultsForStroke,
} from "@/lib/mocap/replayComparison";
import {
  buildNonOverlapConfirmationMessage,
  buildUnlinkConfirmationMessage,
  formatGap,
  isMocapAssignmentActionBusy,
  MOCAP_RECORD_ONLY_FLAG,
  type ManualAssignmentCandidate,
} from "@/lib/mocap/assignment";
import {
  applyMocapLinkToSessions,
  applyMocapUnlinkToSessions,
  confirmMocapSessionLink,
  confirmMocapSessionUnlink,
} from "@/lib/mocap/linking";
import { readMocapLifecycleActionResponse } from "@/lib/mocap/lifecycleResponse";

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
  csvMatchOffsetMs?: number | null;
}

interface SessionStrokeMetric {
  id: string;
  strokeIndex: number;
  phaseBoundariesJson: PhaseBoundaries;
  metricsJson: SessionPostureMetrics;
  segmentationSource: string;
}

interface SessionPostureMetrics {
  backAngleAtCatchDeg?: number;
  backAngleAtFinishDeg?: number;
  laybackAngleDeg?: number;
  hipKneeOpeningOffsetFrames?: number | null;
  armBendBeforeLegsCompleteFrames?: number | null;
  recoveryDriveRatio?: number;
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
  rowingSessionId: string | null;
  rowingSession: {
    id: string;
    timestamp: string;
    distance: number;
    duration: number;
    avgPower: number;
    strokeCount: number;
  } | null;
  capturePerspective: string;
  captureFps: number;
  durationSec: number;
  qualityScore: number | null;
  qualityFlags: string[];
  createdAt: string;
  strokePostureMetrics: SessionStrokeMetric[];
  postureFaults: SessionFault[];
}

type AssignmentCandidatesResponse =
  | {
      linkable: true;
      candidates: ManualAssignmentCandidate[];
    }
  | {
      linkable: false;
      reason: string;
      message: string;
      candidates: [];
    };

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
  header: PoseStreamHeader,
): Promise<Float32Array | null> {
  try {
    const start = HEADER_SIZE + frameIndex * header.bytesPerFrame;
    const end = start + header.bytesPerFrame - 1;
    const res = await fetch(`/api/mocap/sessions/${id}/pose-stream`, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const frame = decodeFrame(buf, 0, header.keypointSchemaVersion);
    return drawingKeypointsFromFrame(frame.keypoints, header);
  } catch {
    return null;
  }
}

function drawingKeypointsFromFrame(
  keypoints: Float32Array,
  header: PoseStreamHeader,
): Float32Array {
  if (header.keypointSchemaVersion !== KEYPOINT_SCHEMA_V2) return keypoints;

  const out = new Float32Array(KEYPOINTS_PER_FRAME_V1 * 3);
  let yMin = Infinity;
  let yMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < KEYPOINTS_PER_FRAME_V1; i++) {
    const offset = i * 4;
    const confidence = keypoints[offset + 3];
    if (confidence < 0.25) continue;
    const y = keypoints[offset + 1];
    const z = keypoints[offset + 2];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }

  const yRange = yMax - yMin;
  const zRange = zMax - zMin;
  for (let i = 0; i < KEYPOINTS_PER_FRAME_V1; i++) {
    const sourceOffset = i * 4;
    const targetOffset = i * 3;
    out[targetOffset] =
      zRange > 0 ? (keypoints[sourceOffset + 2] - zMin) / zRange : 0.5;
    out[targetOffset + 1] =
      yRange > 0 ? (keypoints[sourceOffset + 1] - yMin) / yRange : 0.5;
    out[targetOffset + 2] = keypoints[sourceOffset + 3];
  }
  return out;
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

type CompareRole = "fault" | "comparison";
type ComparePhase = "catch" | "finish";

function comparisonFrameKey(role: CompareRole, phase: ComparePhase): string {
  return `${role}-${phase}`;
}

export default function MocapReplayPage() {
  const { id } = useParams<{ id: string }>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const fetchingRef = useRef(false);
  const lastFrameIndexRef = useRef(-1);
  const getStoreSessions = useRowingStore((state) => state.getSessions);
  const updateSessionsInStore = useRowingStore(
    (state) => state.updateSessionsInStore,
  );

  const [session, setSession] = useState<MocapSessionDetail | null>(null);
  const [poseHeader, setPoseHeader] = useState<PoseStreamHeader | null>(null);
  const [poseHeaderChecked, setPoseHeaderChecked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedFault, setSelectedFault] = useState<SessionFault | null>(null);
  const [selectedStroke, setSelectedStroke] = useState<number | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [compareFaultStroke, setCompareFaultStroke] = useState<number | null>(null);
  const [compareStroke, setCompareStroke] = useState<number | null>(null);
  const [comparisonFrames, setComparisonFrames] = useState<
    Record<string, Float32Array | null>
  >({});
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [assignmentCandidates, setAssignmentCandidates] = useState<
    ManualAssignmentCandidate[] | null
  >(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [linkingRowingSessionId, setLinkingRowingSessionId] = useState<string | null>(
    null,
  );
  const [linkError, setLinkError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const isSidecarReplay = session?.capturePerspective === "sidecar-3d";

  const comparisonOptions = useMemo(
    () =>
      session
        ? buildReplayComparisonOptions(
            session.strokePostureMetrics,
            session.postureFaults,
            compareFaultStroke,
          )
        : {
            faultStrokeOptions: [],
            cleanStrokeOptions: [],
            defaultFaultStrokeIndex: null,
            defaultComparisonStrokeIndex: null,
          },
    [compareFaultStroke, session],
  );

  const metricsByStroke = useMemo(() => {
    const map = new Map<number, SessionStrokeMetric>();
    for (const metric of session?.strokePostureMetrics ?? []) {
      map.set(metric.strokeIndex, metric);
    }
    return map;
  }, [session]);

  const faultsByStroke = useMemo(() => {
    const map = new Map<number, SessionFault[]>();
    for (const fault of session?.postureFaults ?? []) {
      if (!map.has(fault.strokeIndex)) map.set(fault.strokeIndex, []);
      map.get(fault.strokeIndex)!.push(fault);
    }
    return map;
  }, [session]);

  const loadSession = useCallback(async () => {
    setLoadError(null);
    const response = await fetch(`/api/mocap/sessions/${id}`);
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json();
    setSession(data.session);
  }, [id]);

  const loadAssignmentCandidates = useCallback(async () => {
    setAssignmentError(null);
    setAssignmentMessage(null);
    const response = await fetch(`/api/mocap/sessions/${id}/assignment-candidates`);
    const data: AssignmentCandidatesResponse = await response.json();
    if (!response.ok) {
      throw new Error("message" in data ? data.message : `${response.status}`);
    }
    if (data.linkable) {
      setAssignmentCandidates(data.candidates);
    } else {
      setAssignmentCandidates([]);
      setAssignmentMessage(data.message);
    }
  }, [id]);

  // Load session data
  useEffect(() => {
    loadSession().catch((e) =>
      setLoadError(e instanceof Error ? e.message : String(e)),
    );
  }, [loadSession]);

  // Load pose stream header
  useEffect(() => {
    if (!session || session.status !== "ready") return;
    setPoseHeaderChecked(false);
    fetchPoseHeader(id).then((header) => {
      setPoseHeader(header);
      setPoseHeaderChecked(true);
    });
  }, [id, session]);

  useEffect(() => {
    if (
      !session ||
      session.status !== "ready" ||
      session.rowingSessionId !== null ||
      session.qualityFlags.includes(MOCAP_RECORD_ONLY_FLAG)
    ) {
      setAssignmentCandidates(null);
      setAssignmentMessage(null);
      setAssignmentError(null);
      setAssignmentLoading(false);
      return;
    }

    let cancelled = false;
    setAssignmentLoading(true);
    loadAssignmentCandidates()
      .catch((e) => {
        if (!cancelled) {
          setAssignmentCandidates([]);
          setAssignmentError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setAssignmentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadAssignmentCandidates, session]);

  useEffect(() => {
    if (!session || session.strokePostureMetrics.length === 0) return;
    const isValidFaultStroke = comparisonOptions.faultStrokeOptions.some(
      (option) => option.strokeIndex === compareFaultStroke,
    );
    if (!isValidFaultStroke) {
      setCompareFaultStroke(comparisonOptions.defaultFaultStrokeIndex);
    }
  }, [compareFaultStroke, comparisonOptions, session]);

  useEffect(() => {
    if (!session || session.strokePostureMetrics.length === 0) return;
    const isValidComparisonStroke =
      compareStroke !== null &&
      compareStroke !== compareFaultStroke &&
      comparisonOptions.cleanStrokeOptions.includes(compareStroke);

    if (!isValidComparisonStroke) {
      setCompareStroke(comparisonOptions.defaultComparisonStrokeIndex);
    }
  }, [compareFaultStroke, compareStroke, comparisonOptions, session]);

  useEffect(() => {
    if (
      !session ||
      !poseHeader ||
      compareFaultStroke === null ||
      compareStroke === null
    ) {
      setComparisonFrames({});
      return;
    }

    const faultMetric = metricsByStroke.get(compareFaultStroke);
    const comparisonMetric = metricsByStroke.get(compareStroke);
    if (!faultMetric || !comparisonMetric) {
      setComparisonFrames({});
      return;
    }

    let cancelled = false;
    setComparisonLoading(true);

    const frameRequests: Array<[string, number]> = [
      [
        comparisonFrameKey("fault", "catch"),
        faultMetric.phaseBoundariesJson.catchFrameIndex,
      ],
      [
        comparisonFrameKey("fault", "finish"),
        faultMetric.phaseBoundariesJson.finishFrameIndex,
      ],
      [
        comparisonFrameKey("comparison", "catch"),
        comparisonMetric.phaseBoundariesJson.catchFrameIndex,
      ],
      [
        comparisonFrameKey("comparison", "finish"),
        comparisonMetric.phaseBoundariesJson.finishFrameIndex,
      ],
    ];

    Promise.all(
      frameRequests.map(async ([key, frameIndex]) => [
        key,
        await fetchPoseFrameAtIndex(id, frameIndex, poseHeader),
      ] as const),
    )
      .then((entries) => {
        if (cancelled) return;
        setComparisonFrames(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setComparisonLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [compareFaultStroke, compareStroke, id, metricsByStroke, poseHeader, session]);

  // Resize canvas to match video display dimensions or the sidecar canvas surface
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isSidecarReplay) {
      canvas.width = canvas.clientWidth || 1280;
      canvas.height = canvas.clientHeight || 720;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => {
      canvas.width = video.clientWidth || 1280;
      canvas.height = video.clientHeight || 720;
    };
    video.addEventListener("loadedmetadata", onMeta);
    onMeta();
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [isSidecarReplay, poseHeader]);

  const renderFrame = useCallback(
    async (frameIndex: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !poseHeader || fetchingRef.current) return;
      if (!isSidecarReplay && !video) return;
      if (frameIndex === lastFrameIndexRef.current) return;

      fetchingRef.current = true;
      try {
        const keypoints = await fetchPoseFrameAtIndex(id, frameIndex, poseHeader);
        if (keypoints && canvas) {
          lastFrameIndexRef.current = frameIndex;
          canvas.width = canvas.width || canvas.clientWidth || 1280;
          canvas.height = canvas.height || canvas.clientHeight || 720;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            drawSkeleton(
              ctx,
              keypoints,
              canvas.width,
              canvas.height,
              isSidecarReplay ? 1280 : video?.videoWidth || 1280,
              isSidecarReplay ? 720 : video?.videoHeight || 720,
            );
          }
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [id, isSidecarReplay, poseHeader],
  );

  useEffect(() => {
    if (!isSidecarReplay || !poseHeader) return;
    setCurrentTime(0);
    void renderFrame(0);
  }, [isSidecarReplay, poseHeader, renderFrame]);

  // rAF loop during playback + seeked handler
  useEffect(() => {
    if (isSidecarReplay) return;
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
  }, [isSidecarReplay, poseHeader, renderFrame]);

  const seekToFrame = useCallback(
    (frameIndex: number) => {
      if (!poseHeader) return;
      if (isSidecarReplay) {
        setCurrentTime(frameIndex / poseHeader.fps);
        void renderFrame(frameIndex);
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = frameIndex / poseHeader.fps;
    },
    [isSidecarReplay, poseHeader, renderFrame],
  );

  const seekToTime = useCallback(
    (time: number) => {
      if (isSidecarReplay && poseHeader) {
        const clamped = Math.max(0, Math.min(time, session?.durationSec ?? 0));
        setCurrentTime(clamped);
        void renderFrame(Math.floor(clamped * poseHeader.fps));
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
    },
    [isSidecarReplay, poseHeader, renderFrame, session?.durationSec],
  );

  const runAnalysis = useCallback(async () => {
    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      const res = await fetch(`/api/mocap/sessions/${id}/reanalyze`, {
        method: "POST",
      });
      const result = await readMocapLifecycleActionResponse(
        res,
        { id, analysisMode: session?.rowingSessionId ? "csv-aligned" : "pose-segmented" },
        "Failed to re-analyze mocap session",
      );
      if (!result.ok) {
        setReanalyzeError(result.message);
        return;
      }
      await loadSession();
    } catch (e) {
      setReanalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setReanalyzing(false);
    }
  }, [id, loadSession, session?.rowingSessionId]);

  const assignCandidate = useCallback(
    async (candidate: ManualAssignmentCandidate) => {
      if (
        isMocapAssignmentActionBusy({
          linkingRowingSessionId,
          unlinking,
          reanalyzing,
        })
      ) {
        return;
      }

      if (
        !candidate.overlap.overlaps &&
        !window.confirm(buildNonOverlapConfirmationMessage(candidate))
      ) {
        return;
      }

      setLinkingRowingSessionId(candidate.id);
      setLinkError(null);
      setUnlinkError(null);
      try {
        const result = await confirmMocapSessionLink({
          mocapSessionId: id,
          rowingSessionId: candidate.id,
        });
        if (!result.ok) {
          setLinkError(result.message);
          return;
        }
        updateSessionsInStore(
          applyMocapLinkToSessions(getStoreSessions(), {
            rowingSessionId: result.rowingSessionId,
            mocapSessionId: result.mocapSessionId,
          }),
        );
        clearSessionsCache();
        setAssignmentCandidates(null);
        await loadSession();
      } catch (e) {
        setLinkError(e instanceof Error ? e.message : String(e));
      } finally {
        setLinkingRowingSessionId(null);
      }
    },
    [
      getStoreSessions,
      id,
      linkingRowingSessionId,
      loadSession,
      reanalyzing,
      unlinking,
      updateSessionsInStore,
    ],
  );

  const unlinkSession = useCallback(async () => {
    if (
      isMocapAssignmentActionBusy({
        linkingRowingSessionId,
        unlinking,
        reanalyzing,
      })
    ) {
      return;
    }

    if (!window.confirm(buildUnlinkConfirmationMessage())) return;

    setUnlinking(true);
    setUnlinkError(null);
    setLinkError(null);
    try {
      const result = await confirmMocapSessionUnlink(id);
      if (!result.ok) {
        setUnlinkError(result.message);
        return;
      }
      updateSessionsInStore(
        applyMocapUnlinkToSessions(getStoreSessions(), result.mocapSessionId),
      );
      clearSessionsCache();
      await loadSession();
    } catch (e) {
      setUnlinkError(e instanceof Error ? e.message : String(e));
    } finally {
      setUnlinking(false);
    }
  }, [
    getStoreSessions,
    id,
    linkingRowingSessionId,
    loadSession,
    reanalyzing,
    unlinking,
    updateSessionsInStore,
  ]);

  const freezeAtCatch = useCallback(() => {
    if (selectedStroke === null || !session || !poseHeader) return;
    const metric = session.strokePostureMetrics.find(
      (m) => m.strokeIndex === selectedStroke,
    );
    if (metric) seekToFrame(metric.phaseBoundariesJson.catchFrameIndex);
  }, [selectedStroke, session, poseHeader, seekToFrame]);

  const freezeAtFinish = useCallback(() => {
    if (selectedStroke === null || !session || !poseHeader) return;
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
  const hasPoseStream = Boolean(poseHeader);
  const segmentationSource = session.strokePostureMetrics[0]?.segmentationSource ?? null;
  const isRecordOnly = session.qualityFlags.includes(MOCAP_RECORD_ONLY_FLAG);
  const actionBusy = isMocapAssignmentActionBusy({
    linkingRowingSessionId,
    unlinking,
    reanalyzing,
  });
  const showAssignmentWorkflow =
    session.status === "ready" && session.rowingSessionId === null && !isRecordOnly;
  const compareFaultMetric =
    compareFaultStroke === null ? null : metricsByStroke.get(compareFaultStroke) ?? null;
  const compareMetric =
    compareStroke === null ? null : metricsByStroke.get(compareStroke) ?? null;

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
              {segmentationSource
                ? ` · ${segmentationSource === "csv-aligned" ? "CSV-aligned" : "pose-segmented"}`
                : ""}
            </p>
          </div>
        </div>
        <Badge variant={session.status === "ready" ? "default" : "secondary"}>
          {session.status}
        </Badge>
      </div>

      {/* Video + skeleton overlay */}
      {isSidecarReplay ? (
        <div
          className="relative aspect-video w-full overflow-hidden rounded bg-black"
          data-testid="mocap-replay-sidecar"
        >
          {poseHeader ? (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
              data-testid="mocap-skeleton-canvas"
            />
          ) : null}
        </div>
      ) : (
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
      )}

      {session.rowingSession ? (
        <Card data-testid="mocap-linked-session">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-3 text-sm font-medium">
              <span>Linked rowing session</span>
              <Badge variant="secondary">CSV-aligned</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {fmtDate(session.rowingSession.timestamp)} ·{" "}
                {session.rowingSession.distance}m ·{" "}
                {fmtTime(session.rowingSession.duration)} ·{" "}
                {Math.round(session.rowingSession.avgPower)}W
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href={`/sessions/${session.rowingSession.id}`}
                    data-testid="mocap-linked-rowing-session-link"
                  >
                    View rowing session
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={unlinkSession}
                  disabled={actionBusy}
                  data-testid="mocap-unlink"
                >
                  {unlinking ? "Analyzing…" : "Unlink"}
                </Button>
              </div>
            </div>
            {unlinking ? (
              <Alert>
                <AlertDescription>
                  Unlinking and re-analyzing as pose-segmented data.
                </AlertDescription>
              </Alert>
            ) : null}
            {unlinkError ? (
              <Alert variant="destructive" data-testid="mocap-unlink-error">
                <AlertDescription>{unlinkError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showAssignmentWorkflow ? (
        <Card data-testid="mocap-assignment">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Assign rowing session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkingRowingSessionId ? (
              <Alert>
                <AlertDescription>
                  Linking and re-analyzing as CSV-aligned data.
                </AlertDescription>
              </Alert>
            ) : null}
            {linkError ? (
              <Alert variant="destructive" data-testid="mocap-link-error">
                <AlertDescription>{linkError}</AlertDescription>
              </Alert>
            ) : null}
            {assignmentError ? (
              <Alert variant="destructive">
                <AlertDescription>{assignmentError}</AlertDescription>
              </Alert>
            ) : null}
            {assignmentMessage ? (
              <p className="text-sm text-muted-foreground">{assignmentMessage}</p>
            ) : assignmentLoading || assignmentCandidates === null ? (
              <p className="text-sm text-muted-foreground">Loading candidates…</p>
            ) : assignmentCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No unlinked rowing sessions are available.
              </p>
            ) : (
              <div className="space-y-2">
                {assignmentCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">{fmtDate(candidate.timestamp)}</div>
                      <div className="text-muted-foreground">
                        {candidate.distance}m · {fmtTime(candidate.duration)} ·{" "}
                        {Math.round(candidate.avgPower)}W · {candidate.strokeCount} strokes
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {candidate.overlap.overlaps ? (
                          <Badge variant="secondary">Overlaps capture</Badge>
                        ) : (
                          <Badge variant="outline">
                            Gap {formatGap(candidate.overlap.timeGapMs)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => assignCandidate(candidate)}
                      disabled={actionBusy}
                      data-testid={`mocap-assign-${candidate.id}`}
                    >
                      {linkingRowingSessionId === candidate.id
                        ? "Analyzing…"
                        : candidate.overlap.overlaps
                          ? "Assign"
                          : "Review assign"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

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
      {!hasMetrics && session.status === "ready" && poseHeaderChecked ? (
        <Card data-testid="mocap-no-analysis">
          <CardContent className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {hasPoseStream
                ? "No posture analysis for this session."
                : isRecordOnly
                  ? "This is a record-only video. Live pose analysis was unavailable during capture, so there is no pose stream to re-analyze."
                  : "Posture analysis is unavailable because this session has no pose stream."}
            </p>
            {reanalyzeError ? (
              <p className="text-sm text-red-600">Analysis failed: {reanalyzeError}</p>
            ) : null}
            {hasPoseStream ? (
              <Button
                size="sm"
                onClick={runAnalysis}
                disabled={reanalyzing}
                data-testid="mocap-run-analysis"
              >
                {reanalyzing ? "Analyzing…" : "Run analysis"}
              </Button>
            ) : null}
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

      {hasMetrics ? (
        <Card data-testid="mocap-stroke-compare">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Side-by-side stroke compare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comparisonOptions.faultStrokeOptions.length === 0 ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid="mocap-compare-no-faults"
              >
                No fault-heavy strokes yet. Once analysis detects a posture fault,
                comparison mode can pair that stroke with a clean stroke from this
                mocap session.
              </p>
            ) : comparisonOptions.cleanStrokeOptions.length === 0 ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid="mocap-compare-no-clean"
              >
                No clean comparison stroke exists in this mocap session. Every
                analyzed stroke currently has at least one detected fault.
              </p>
            ) : (
              <>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Fault-heavy stroke
                    </span>
                    <select
                      className="w-full rounded border bg-transparent px-2 py-1 text-sm"
                      value={compareFaultStroke ?? ""}
                      onChange={(e) =>
                        setCompareFaultStroke(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      data-testid="mocap-compare-fault-stroke"
                    >
                      {comparisonOptions.faultStrokeOptions.map((option) => (
                        <option key={option.strokeIndex} value={option.strokeIndex}>
                          Stroke {option.strokeIndex + 1} · {option.faultCount}{" "}
                          {option.faultCount === 1 ? "fault" : "faults"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Clean comparison stroke
                    </span>
                    <select
                      className="w-full rounded border bg-transparent px-2 py-1 text-sm"
                      value={compareStroke ?? ""}
                      onChange={(e) =>
                        setCompareStroke(e.target.value ? Number(e.target.value) : null)
                      }
                      data-testid="mocap-compare-clean-stroke"
                    >
                      {comparisonOptions.cleanStrokeOptions
                        .filter((strokeIndex) => strokeIndex !== compareFaultStroke)
                        .map((strokeIndex) => (
                          <option key={strokeIndex} value={strokeIndex}>
                            Stroke {strokeIndex + 1}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                {compareFaultMetric && compareMetric ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <CompareStrokePanel
                      title="Fault-heavy"
                      metric={compareFaultMetric}
                      faults={faultsByStroke.get(compareFaultMetric.strokeIndex) ?? []}
                      catchFrame={
                        comparisonFrames[comparisonFrameKey("fault", "catch")] ?? null
                      }
                      finishFrame={
                        comparisonFrames[comparisonFrameKey("fault", "finish")] ?? null
                      }
                      loading={comparisonLoading}
                    />
                    <CompareStrokePanel
                      title="Clean comparison"
                      metric={compareMetric}
                      faults={faultsByStroke.get(compareMetric.strokeIndex) ?? []}
                      catchFrame={
                        comparisonFrames[
                          comparisonFrameKey("comparison", "catch")
                        ] ?? null
                      }
                      finishFrame={
                        comparisonFrames[
                          comparisonFrameKey("comparison", "finish")
                        ] ?? null
                      }
                      loading={comparisonLoading}
                    />
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
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

function CompareStrokePanel({
  title,
  metric,
  faults,
  catchFrame,
  finishFrame,
  loading,
}: {
  title: string;
  metric: SessionStrokeMetric;
  faults: SessionFault[];
  catchFrame: Float32Array | null;
  finishFrame: Float32Array | null;
  loading: boolean;
}) {
  const faultCount = countFaultsForStroke(faults, metric.strokeIndex);

  return (
    <div className="rounded border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">
            Stroke {metric.strokeIndex + 1}
          </div>
        </div>
        <Badge variant={faultCount > 0 ? "destructive" : "secondary"}>
          {faultCount > 0
            ? `${faultCount} ${faultCount === 1 ? "fault" : "faults"}`
            : "clean"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PhaseSkeletonCanvas
          label="Catch"
          keypoints={catchFrame}
          loading={loading}
        />
        <PhaseSkeletonCanvas
          label="Finish"
          keypoints={finishFrame}
          loading={loading}
        />
      </div>

      <div className="grid gap-1 text-xs">
        {metricRows(metric.metricsJson).map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-mono text-right">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1 text-xs">
        <div className="text-muted-foreground">Fault summary</div>
        {faults.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {faults.map((fault) => (
              <Badge
                key={fault.id}
                variant={fault.severity === "critical" ? "destructive" : "secondary"}
                className="text-[11px]"
              >
                {faultLabel(fault.faultType)}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">No detected faults.</div>
        )}
      </div>
    </div>
  );
}

function PhaseSkeletonCanvas({
  label,
  keypoints,
  loading,
}: {
  label: string;
  keypoints: Float32Array | null;
  loading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.clientWidth || 320;
    canvas.height = canvas.clientHeight || 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (keypoints) {
      drawSkeleton(ctx, keypoints, canvas.width, canvas.height, 1280, 720);
    }
  }, [keypoints]);

  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="relative aspect-video overflow-hidden rounded bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          data-testid={`mocap-compare-${label.toLowerCase()}-canvas`}
        />
        {loading ? (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] text-white">
            Loading
          </div>
        ) : !keypoints ? (
          <div className="absolute inset-0 grid place-items-center px-2 text-center text-[11px] text-white/70">
            Frame unavailable
          </div>
        ) : null}
      </div>
    </div>
  );
}

function metricRows(metrics: SessionPostureMetrics): Array<{
  label: string;
  value: string;
}> {
  return [
    {
      label: "Back angle at catch",
      value: formatMetric(metrics.backAngleAtCatchDeg, "deg"),
    },
    {
      label: "Back angle at finish",
      value: formatMetric(metrics.backAngleAtFinishDeg, "deg"),
    },
    {
      label: "Layback angle",
      value: formatMetric(metrics.laybackAngleDeg, "deg"),
    },
    {
      label: "Hip-knee timing offset",
      value: formatMetric(metrics.hipKneeOpeningOffsetFrames, "frames"),
    },
    {
      label: "Arm bend before legs",
      value: formatMetric(metrics.armBendBeforeLegsCompleteFrames, "frames"),
    },
    {
      label: "Recovery / drive ratio",
      value: formatMetric(metrics.recoveryDriveRatio, "ratio"),
    },
  ];
}

function formatMetric(
  value: number | null | undefined,
  unit: "deg" | "frames" | "ratio",
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  if (unit === "ratio") return value.toFixed(2);
  if (unit === "frames") return `${value.toFixed(0)} fr`;
  return `${value.toFixed(1)} deg`;
}
