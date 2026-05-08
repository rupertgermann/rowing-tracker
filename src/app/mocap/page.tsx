"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BrowserPoseSource,
  type PoseSourceStatus,
} from "@/lib/mocap/browserPoseSource";
import { QUALITY_FLAG } from "@/lib/mocap/poseFrameStream";
import { VideoUploader } from "@/lib/mocap/videoUploader";

const CAPTURE_FPS = 30;
const CAPTURE_MODEL_VERSION = "mediapipe-pose-landmarker-lite@0.10.35";
const VIDEO_TIMESLICE_MS = 1000;
const MIN_TRACKED_KEYPOINTS = 20;
const MIN_MEAN_CONFIDENCE = 0.5;
const DEGRADED_FRAME_MS = 2000;

type CaptureState =
  | { kind: "idle" }
  | { kind: "starting" }
  | {
      kind: "capturing";
      sessionId: string;
      startedAt: number;
    }
  | {
      kind: "stopping";
      sessionId: string;
    }
  | {
      kind: "done";
      sessionId: string;
      durationSec: number;
      frameCount: number;
  }
  | { kind: "error"; message: string };

type CalibrationPose = "catch" | "finish";

type CalibrationFrame = {
  pose: CalibrationPose;
  capturedAt: string;
  capturePerspective: "side-left" | "side-right";
  videoWidth: number;
  videoHeight: number;
  meanKeypointConfidence: number;
  trackedKeypointCount: number;
  qualityFlags: number;
  poseFrameBase64: string;
};

type CalibrationState =
  | { kind: "idle"; hint?: string }
  | {
      kind: "starting";
      catchFrame?: CalibrationFrame;
      finishFrame?: CalibrationFrame;
      hint?: string;
    }
  | {
      kind: "ready";
      catchFrame?: CalibrationFrame;
      finishFrame?: CalibrationFrame;
      hint?: string;
    };

type PoseQuality = {
  trackedKeypointCount: number;
  meanConfidence: number;
  qualityFlags: number;
  landmarkCount: number;
  poseFrameBase64: string;
};

const EMPTY_QUALITY: PoseQuality = {
  trackedKeypointCount: 0,
  meanConfidence: 0,
  qualityFlags: 0,
  landmarkCount: 0,
  poseFrameBase64: "",
};

export default function MocapCapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const uploaderRef = useRef<VideoUploader | null>(null);
  const sourceRef = useRef<BrowserPoseSource | null>(null);
  const calibrationSourceRef = useRef<BrowserPoseSource | null>(null);
  const startedAtRef = useRef<number>(0);
  const degradedSinceRef = useRef<number | null>(null);
  const latestPoseFrameRef = useRef<PoseQuality>(EMPTY_QUALITY);

  const [state, setState] = useState<CaptureState>({ kind: "idle" });
  const [calibration, setCalibration] = useState<CalibrationState>({
    kind: "idle",
  });
  const [framesEncoded, setFramesEncoded] = useState(0);
  const [poseStatus, setPoseStatus] = useState<PoseSourceStatus>("idle");
  const [perspective, setPerspective] = useState<"side-left" | "side-right">(
    "side-right",
  );
  const [elapsedSec, setElapsedSec] = useState(0);
  const [quality, setQuality] = useState<PoseQuality>(EMPTY_QUALITY);
  const [framingDegraded, setFramingDegraded] = useState(false);
  const [sessionQualityFlags, setSessionQualityFlags] = useState<string[]>([]);
  const [recordOnly, setRecordOnly] = useState(false);

  useEffect(() => {
    if (state.kind !== "capturing") return;
    const t = setInterval(() => {
      setElapsedSec((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    return () => clearInterval(t);
  }, [state.kind]);

  const handlePoseFrame = useCallback(
    (
      info: PoseQuality & {
        framesEncoded: number;
      },
      monitorDegradedFraming: boolean,
    ) => {
      const nextQuality: PoseQuality = {
        trackedKeypointCount: info.trackedKeypointCount,
        meanConfidence: info.meanConfidence,
        qualityFlags: info.qualityFlags,
        landmarkCount: info.landmarkCount,
        poseFrameBase64: info.poseFrameBase64,
      };
      latestPoseFrameRef.current = nextQuality;
      setFramesEncoded(info.framesEncoded);
      setQuality(nextQuality);

      if (!monitorDegradedFraming) return;

      const degraded = isDegradedFraming(nextQuality);
      if (!degraded) {
        degradedSinceRef.current = null;
        setFramingDegraded(false);
        return;
      }

      const now = Date.now();
      degradedSinceRef.current ??= now;
      if (now - degradedSinceRef.current >= DEGRADED_FRAME_MS) {
        setFramingDegraded(true);
        setSessionQualityFlags((flags) =>
          flags.includes("framing-degraded")
            ? flags
            : [...flags, "framing-degraded"],
        );
      }
    },
    [],
  );

  const teardown = useCallback(async () => {
    calibrationSourceRef.current = null;
    sourceRef.current = null;
    recorderRef.current = null;
    uploaderRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleError = useCallback(
    async (err: unknown, sessionId?: string) => {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message });
      try {
        await sourceRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        await calibrationSourceRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      await uploaderRef.current?.drain();
      await teardown();
      if (sessionId) {
        // Best-effort delete of the abandoned row
        fetch(`/api/mocap/sessions/${sessionId}`, { method: "DELETE" }).catch(
          () => {},
        );
      }
    },
    [teardown],
  );

  const startCalibration = useCallback(async () => {
    setCalibration({ kind: "starting" });
    setPoseStatus("idle");
    setFramesEncoded(0);
    setQuality(EMPTY_QUALITY);
    latestPoseFrameRef.current = EMPTY_QUALITY;
    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, frameRate: CAPTURE_FPS },
          audio: false,
        });
        streamRef.current = stream;
      }
      const video = videoRef.current!;
      video.srcObject = streamRef.current;
      await video.play();

      await calibrationSourceRef.current?.stop().catch(() => {});
      const source = new BrowserPoseSource({
        videoEl: video,
        uploadPoseStream: false,
        onStatus: (s) => setPoseStatus(s),
        onFrame: (info) => handlePoseFrame(info, false),
        onError: (err) => {
          setCalibration({ kind: "idle", hint: err.message });
        },
      });
      calibrationSourceRef.current = source;
      await source.init();
      source.start();
      setCalibration({ kind: "ready" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalibration({ kind: "idle", hint: message });
      await teardown();
    }
  }, [handlePoseFrame, teardown]);

  const captureCalibrationFrame = useCallback(
    (pose: CalibrationPose) => {
      const latest = latestPoseFrameRef.current;
      if (!isCameraReadyForCapture(latest)) {
        setCalibration((current) => ({
          ...current,
          hint:
            "Move the rower and erg fully into the side view, then hold still for a second.",
        }));
        return;
      }

      const video = videoRef.current;
      const frame: CalibrationFrame = {
        pose,
        capturedAt: new Date().toISOString(),
        capturePerspective: perspective,
        videoWidth: video?.videoWidth ?? 0,
        videoHeight: video?.videoHeight ?? 0,
        meanKeypointConfidence: latest.meanConfidence,
        trackedKeypointCount: latest.trackedKeypointCount,
        qualityFlags: latest.qualityFlags,
        poseFrameBase64: latest.poseFrameBase64,
      };

      setCalibration((current) => ({
        kind: "ready",
        catchFrame:
          pose === "catch"
            ? frame
            : "catchFrame" in current
              ? current.catchFrame
              : undefined,
        finishFrame:
          pose === "finish"
            ? frame
            : "finishFrame" in current
              ? current.finishFrame
              : undefined,
      }));
    },
    [perspective],
  );

  const start = useCallback(async () => {
    const calibrationFrames = getCalibrationFrames(calibration);
    if (!calibrationFrames || !isCameraReadyForCapture(latestPoseFrameRef.current)) {
      setCalibration((current) => ({
        ...current,
        hint:
          "Complete catch and finish calibration with the rower and erg fully in frame before recording.",
      }));
      return;
    }

    setState({ kind: "starting" });
    let sessionId: string | undefined;
    try {
      const stream =
        streamRef.current ??
        (await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, frameRate: CAPTURE_FPS },
          audio: false,
        }));
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      await calibrationSourceRef.current?.stop();
      calibrationSourceRef.current = null;

      const createRes = await fetch("/api/mocap/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "browser",
          captureModelVersion: CAPTURE_MODEL_VERSION,
          capturePerspective: perspective,
          captureFps: CAPTURE_FPS,
          calibrationCatchFrame: calibrationFrames.catchFrame,
          calibrationFinishFrame: calibrationFrames.finishFrame,
        }),
      });
      if (!createRes.ok) {
        throw new Error(`Create session failed: ${createRes.status}`);
      }
      const created: { id: string } = await createRes.json();
      sessionId = created.id;

      uploaderRef.current = new VideoUploader(sessionId, (err) =>
        handleError(err, sessionId),
      );

      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          uploaderRef.current?.enqueue(event.data);
        }
      };
      recorder.onerror = (event) => {
        handleError(
          (event as ErrorEvent).error ?? new Error("MediaRecorder error"),
          sessionId,
        );
      };
      recorderRef.current = recorder;

      const source = new BrowserPoseSource({
        sessionId,
        videoEl: video,
        onStatus: (s) => setPoseStatus(s),
        onFrame: (info) => handlePoseFrame(info, true),
        onError: (err) => handleError(err, sessionId),
      });
      sourceRef.current = source;
      await source.init();

      recorder.start(VIDEO_TIMESLICE_MS);
      source.start();
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setFramesEncoded(0);
      setFramingDegraded(false);
      setSessionQualityFlags([]);
      degradedSinceRef.current = null;
      setState({
        kind: "capturing",
        sessionId,
        startedAt: startedAtRef.current,
      });
    } catch (err) {
      await handleError(err, sessionId);
    }
  }, [calibration, handleError, handlePoseFrame, perspective]);

  const stop = useCallback(async () => {
    if (state.kind !== "capturing") return;
    const sessionId = state.sessionId;
    setState({ kind: "stopping", sessionId });
    try {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });
      }
      await sourceRef.current?.stop();
      await uploaderRef.current?.drain();

      const durationSec = (Date.now() - startedAtRef.current) / 1000;
      const finalizeRes = await fetch(
        `/api/mocap/sessions/${sessionId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            durationSec,
            qualityScore: qualityScoreFor(latestPoseFrameRef.current),
            qualityFlags: sessionQualityFlags,
            skipAnalysis: recordOnly,
          }),
        },
      );
      if (!finalizeRes.ok) {
        throw new Error(`Finalize failed: ${finalizeRes.status}`);
      }
      const finalized: {
        id: string;
        durationSec: number;
        frameCount: number;
      } = await finalizeRes.json();
      await teardown();
      setCalibration({ kind: "idle" });
      setState({
        kind: "done",
        sessionId: finalized.id,
        durationSec: finalized.durationSec,
        frameCount: finalized.frameCount,
      });
    } catch (err) {
      await handleError(err, sessionId);
    }
  }, [state, handleError, sessionQualityFlags, teardown]);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop().catch(() => {});
      calibrationSourceRef.current?.stop().catch(() => {});
      recorderRef.current?.stop();
      teardown();
    };
  }, [teardown]);

  useEffect(() => {
    if (state.kind !== "capturing") return;
    const sessionId = state.sessionId;
    const onPageHide = () => {
      try {
        recorderRef.current?.requestData?.();
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        const durationSec = (Date.now() - startedAtRef.current) / 1000;
        navigator.sendBeacon?.(
          `/api/mocap/sessions/${sessionId}/finalize`,
          new Blob(
            [
              JSON.stringify({
                durationSec,
                qualityScore: qualityScoreFor(latestPoseFrameRef.current),
                qualityFlags: sessionQualityFlags,
              }),
            ],
            {
              type: "application/json",
            },
          ),
        );
      } catch {
        // ignore
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [state, sessionQualityFlags]);

  const calibrationFrames = getCalibrationFrames(calibration);
  const nextCalibrationPose: CalibrationPose | null = !(
    "catchFrame" in calibration && calibration.catchFrame
  )
    ? "catch"
    : !("finishFrame" in calibration && calibration.finishFrame)
      ? "finish"
      : null;
  const cameraReady = isCameraReadyForCapture(quality);
  const canRecord =
    state.kind !== "capturing" &&
    state.kind !== "starting" &&
    state.kind !== "stopping" &&
    calibration.kind === "ready" &&
    Boolean(calibrationFrames) &&
    cameraReady;

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Motion capture session</CardTitle>
          <CardDescription>
            Single-webcam pose capture. Camera permission is requested only when
            you click Start.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm">
              Perspective:
              <select
                className="ml-2 rounded border px-2 py-1 text-sm bg-transparent"
                value={perspective}
                onChange={(e) =>
                  setPerspective(e.target.value as "side-left" | "side-right")
                }
                disabled={
                  calibration.kind !== "idle" ||
                  (state.kind !== "idle" && state.kind !== "done")
                }
              >
                <option value="side-right">Side (right toward camera)</option>
                <option value="side-left">Side (left toward camera)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm select-none" data-testid="mocap-record-only-label">
              <input
                type="checkbox"
                checked={recordOnly}
                onChange={(e) => setRecordOnly(e.target.checked)}
                disabled={state.kind === "capturing" || state.kind === "starting" || state.kind === "stopping"}
                data-testid="mocap-record-only"
              />
              Record only (skip analysis)
            </label>
            {calibration.kind === "idle" &&
            (state.kind === "idle" || state.kind === "done") ? (
              <Button
                onClick={startCalibration}
                data-testid="mocap-start-calibration"
              >
                Start calibration
              </Button>
            ) : null}
            {calibration.kind === "starting" ? (
              <Button disabled data-testid="mocap-calibration-starting">
                Calibrating…
              </Button>
            ) : null}
            {calibration.kind === "ready" && nextCalibrationPose ? (
              <Button
                onClick={() => captureCalibrationFrame(nextCalibrationPose)}
                disabled={!cameraReady}
                data-testid={`mocap-capture-${nextCalibrationPose}`}
              >
                Capture {nextCalibrationPose}
              </Button>
            ) : null}
            {calibration.kind === "ready" &&
            (state.kind === "idle" || state.kind === "done") ? (
              <Button
                variant="outline"
                onClick={startCalibration}
                data-testid="mocap-recalibrate"
              >
                Recalibrate
              </Button>
            ) : null}
            {state.kind === "idle" || state.kind === "done" ? (
              <Button
                onClick={start}
                disabled={!canRecord}
                data-testid="mocap-start"
              >
                Start mocap session
              </Button>
            ) : null}
            {state.kind === "starting" ? (
              <Button disabled data-testid="mocap-starting">
                Starting…
              </Button>
            ) : null}
            {state.kind === "capturing" ? (
              <Button
                variant="destructive"
                onClick={stop}
                data-testid="mocap-stop"
              >
                Stop
              </Button>
            ) : null}
            {state.kind === "stopping" ? (
              <Button disabled data-testid="mocap-stopping">
                Finalising…
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <CalibrationStep
              label="Catch"
              done={"catchFrame" in calibration && Boolean(calibration.catchFrame)}
            />
            <CalibrationStep
              label="Finish"
              done={
                "finishFrame" in calibration && Boolean(calibration.finishFrame)
              }
            />
            <CalibrationStep label="Camera check" done={cameraReady} />
          </div>

          {calibration.hint ? (
            <div
              className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm"
              data-testid="mocap-calibration-hint"
            >
              {calibration.hint}
            </div>
          ) : null}

          <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              playsInline
              muted
              data-testid="mocap-video"
            />
            {state.kind === "capturing" ? (
              <div
                className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-medium text-white"
                data-testid="mocap-recording-indicator"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                REC {elapsedSec.toFixed(1)}s
              </div>
            ) : null}
          </div>

          {framingDegraded ? (
            <div
              className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm"
              data-testid="mocap-framing-degraded"
            >
              Framing degraded. Check lighting and keep the rower fully in the
              side view.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="State" value={state.kind} />
            <Stat label="Pose worker" value={poseStatus} />
            <Stat label="Frames encoded" value={framesEncoded.toString()} />
            <Stat
              label="Effective FPS"
              value={
                elapsedSec > 0
                  ? (framesEncoded / elapsedSec).toFixed(1)
                  : "0.0"
              }
            />
            <Stat
              label="Mean confidence"
              value={`${Math.round(quality.meanConfidence * 100)}%`}
            />
            <Stat
              label="Tracked keypoints"
              value={`${quality.trackedKeypointCount}/33`}
            />
            <Stat label="Quality flags" value={qualityFlagLabel(quality)} />
          </div>

          {state.kind === "done" ? (
            <div
              className="rounded border border-green-500/40 bg-green-500/10 p-3 text-sm space-y-2"
              data-testid="mocap-done"
            >
              <div>
                Session <code>{state.sessionId}</code> stored.
              </div>
              <div>
                {state.frameCount} pose frames · {state.durationSec.toFixed(1)}s
                duration
              </div>
              <div className="flex gap-2 pt-1">
                <a
                  href={`/mocap/sessions/${state.sessionId}`}
                  className="underline text-green-800 dark:text-green-300"
                  data-testid="mocap-replay-link"
                >
                  View replay →
                </a>
                <span className="text-green-700/50 dark:text-green-400/50">·</span>
                <a
                  href="/mocap/sessions"
                  className="underline text-green-800 dark:text-green-300"
                  data-testid="mocap-sessions-link"
                >
                  All sessions
                </a>
              </div>
            </div>
          ) : null}

          {state.kind === "error" ? (
            <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
              Error: {state.message}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}

function CalibrationStep({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="rounded border p-2" data-testid={`mocap-calibration-${label.toLowerCase().replace(" ", "-")}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={done ? "text-sm text-green-600" : "text-sm text-muted-foreground"}>
        {done ? "Ready" : "Needed"}
      </div>
    </div>
  );
}

function getCalibrationFrames(
  calibration: CalibrationState,
): { catchFrame: CalibrationFrame; finishFrame: CalibrationFrame } | null {
  if (
    "catchFrame" in calibration &&
    calibration.catchFrame &&
    "finishFrame" in calibration &&
    calibration.finishFrame
  ) {
    return {
      catchFrame: calibration.catchFrame,
      finishFrame: calibration.finishFrame,
    };
  }
  return null;
}

function isCameraReadyForCapture(quality: PoseQuality): boolean {
  return (
    quality.trackedKeypointCount >= MIN_TRACKED_KEYPOINTS &&
    quality.meanConfidence >= MIN_MEAN_CONFIDENCE &&
    (quality.qualityFlags & QUALITY_FLAG.OUT_OF_FRAME) === 0
  );
}

function isDegradedFraming(quality: PoseQuality): boolean {
  return (
    quality.trackedKeypointCount < MIN_TRACKED_KEYPOINTS ||
    quality.meanConfidence < MIN_MEAN_CONFIDENCE ||
    (quality.qualityFlags &
      (QUALITY_FLAG.OUT_OF_FRAME | QUALITY_FLAG.LOW_CONFIDENCE)) !==
      0
  );
}

function qualityScoreFor(quality: PoseQuality): number {
  const trackedRatio = quality.trackedKeypointCount / 33;
  return Math.max(0, Math.min(1, quality.meanConfidence * trackedRatio));
}

function qualityFlagLabel(quality: PoseQuality): string {
  const labels = [];
  if ((quality.qualityFlags & QUALITY_FLAG.OUT_OF_FRAME) !== 0) {
    labels.push("out");
  }
  if ((quality.qualityFlags & QUALITY_FLAG.LOW_CONFIDENCE) !== 0) {
    labels.push("low");
  }
  return labels.length > 0 ? labels.join(", ") : "ok";
}

function pickRecorderMime(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c;
    }
  }
  return "video/webm";
}
