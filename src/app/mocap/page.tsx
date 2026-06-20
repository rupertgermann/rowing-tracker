"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrowserPoseSource } from "@/lib/mocap/browserPoseSource";
import { FreemocapSidecarSource } from "@/lib/mocap/freemocapSidecarSource";
import type {
  PoseCaptureSource,
  PoseCaptureSourceStatus,
} from "@/lib/mocap/poseCaptureSource";
import {
  cameraQualityFlagLabel,
  evaluateCameraReadiness,
  type CameraReadinessFrame,
  type CameraReadinessResult,
} from "@/lib/mocap/cameraReadiness";
import {
  evaluateMocapCaptureSupport,
  hasSustainedLowEffectiveFps,
  lowFpsRecordOnlySupport,
  readBrowserMocapCapabilities,
  recordOnlyQualityFlag,
  type EffectiveFpsSample,
  type MocapCaptureSupport,
  type RecordOnlyReason,
} from "@/lib/mocap/degradedMode";
import {
  BYTES_PER_FRAME_V1,
  BYTES_PER_FRAME_V2,
  KEYPOINT_SCHEMA_V2,
  decodeFrame,
} from "@/lib/mocap/poseFrameStream";
import { VideoUploader } from "@/lib/mocap/videoUploader";
import {
  getCoachingCues,
  type CoachingCue,
} from "@/lib/mocap/coaching/coachingAdvisor";
import { LiveCoachingEngine } from "@/lib/mocap/coaching/liveCoachingEngine";
import {
  cancelSpokenCues,
  speakCue,
} from "@/lib/mocap/coaching/cueAudio";
import {
  keypointQuadsToPosePoints,
  keypointTripletsToPosePoints,
} from "@/lib/mocap/analysis/poseFrameStreamAdapter";
import type {
  Calibration,
  PoseAnalysisFrame,
  PostureFault,
} from "@/lib/mocap/analysis/types";
import { settings } from "@/lib/settings";
import {
  checkSidecarHealth,
  SIDECAR_DEFAULT_PORT,
  type SidecarHealth,
} from "@/lib/mocap/sidecarClient";

const CAPTURE_FPS = 30;
const CAPTURE_MODEL_VERSION = "mediapipe-pose-landmarker-lite@0.10.35";
const VIDEO_TIMESLICE_MS = 1000;
const QUALITY_HISTORY_MS = 5000;

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

type CaptureSource = "browser" | "sidecar";

type CaptureState =
  | { kind: "idle" }
  | { kind: "starting" }
  | {
      kind: "capturing";
      sessionId: string;
      startedAt: number;
      source: CaptureSource;
    }
  | {
      kind: "stopping";
      sessionId: string;
      source: CaptureSource;
    }
  | {
      kind: "done";
      sessionId: string;
      durationSec: number;
      frameCount: number;
      recordOnly: boolean;
      source: CaptureSource;
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
  const sourceRef = useRef<PoseCaptureSource | null>(null);
  const calibrationSourceRef = useRef<PoseCaptureSource | null>(null);
  const startedAtRef = useRef<number>(0);
  const latestPoseFrameRef = useRef<PoseQuality>(EMPTY_QUALITY);
  const qualityHistoryRef = useRef<CameraReadinessFrame[]>([]);
  const effectiveFpsSamplesRef = useRef<EffectiveFpsSample[]>([]);
  const latestCameraReadinessRef = useRef<CameraReadinessResult | null>(null);
  const engineRef = useRef<LiveCoachingEngine | null>(null);
  const cueDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioEnabledRef = useRef(false);
  const recordOnlyRef = useRef(false);

  const [state, setState] = useState<CaptureState>({ kind: "idle" });
  const [calibration, setCalibration] = useState<CalibrationState>({
    kind: "idle",
  });
  const [framesEncoded, setFramesEncoded] = useState(0);
  const [poseStatus, setPoseStatus] = useState<PoseCaptureSourceStatus>("idle");
  const [perspective, setPerspective] = useState<"side-left" | "side-right">(
    "side-right",
  );
  const [elapsedSec, setElapsedSec] = useState(0);
  const [quality, setQuality] = useState<PoseQuality>(EMPTY_QUALITY);
  const [cameraReadiness, setCameraReadiness] =
    useState<CameraReadinessResult | null>(null);
  const [framingDegraded, setFramingDegraded] = useState(false);
  const [sessionQualityFlags, setSessionQualityFlags] = useState<string[]>([]);
  const [recordOnly, setRecordOnly] = useState(false);
  const [useSidecar, setUseSidecar] = useState(false);
  const [sidecarHealth, setSidecarHealth] = useState<SidecarHealth | null>(null);
  const [sidecarError, setSidecarError] = useState<string | null>(null);
  const [recordOnlyReason, setRecordOnlyReason] =
    useState<RecordOnlyReason | null>(null);
  const [captureSupport, setCaptureSupport] =
    useState<MocapCaptureSupport | null>(null);
  const [activeCue, setActiveCue] = useState<CoachingCue | null>(null);
  const [sessionFaults, setSessionFaults] = useState<PostureFault[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [verbosity, setVerbosity] = useState<"quiet" | "verbose">("quiet");

  // Hydrate live-cue prefs from persisted settings on mount.
  useEffect(() => {
    const prefs = settings.getMocapSettings().mocapPreferences;
    setAudioEnabled(prefs.audioEnabled);
    setVerbosity(prefs.verbosity);
    audioEnabledRef.current = prefs.audioEnabled;

    const support = evaluateMocapCaptureSupport(readBrowserMocapCapabilities());
    setCaptureSupport(support);
    if (support.recordOnlyRecommended) {
      setRecordOnly(true);
      setRecordOnlyReason(support.reason);
    }
  }, []);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    if (!audioEnabled) cancelSpokenCues();
  }, [audioEnabled]);

  useEffect(() => {
    recordOnlyRef.current =
      recordOnly ||
      Boolean(
        captureSupport?.recordOnlyRecommended && !captureSupport.livePoseSupported,
      );
  }, [recordOnly, captureSupport]);

  const updateAudioEnabled = useCallback((next: boolean) => {
    setAudioEnabled(next);
    const current = settings.getMocapSettings().mocapPreferences;
    settings.updateMocapSettings({
      mocapPreferences: { ...current, audioEnabled: next },
    });
  }, []);

  const updateVerbosity = useCallback((next: "quiet" | "verbose") => {
    setVerbosity(next);
    const current = settings.getMocapSettings().mocapPreferences;
    settings.updateMocapSettings({
      mocapPreferences: { ...current, verbosity: next },
    });
  }, []);

  const clearCueDismissTimer = useCallback(() => {
    if (cueDismissTimerRef.current) {
      clearTimeout(cueDismissTimerRef.current);
      cueDismissTimerRef.current = null;
    }
  }, []);

  const dismissCue = useCallback(() => {
    clearCueDismissTimer();
    cancelSpokenCues();
    setActiveCue(null);
  }, [clearCueDismissTimer]);

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

      const nowMs = Date.now();
      const decodedFrame = decodeBase64PoseFrame(info.poseFrameBase64);
      qualityHistoryRef.current = [
        ...qualityHistoryRef.current.filter(
          (frame) => frame.timestampMs >= nowMs - QUALITY_HISTORY_MS,
        ),
        {
          timestampMs: nowMs,
          trackedKeypointCount: info.trackedKeypointCount,
          meanConfidence: info.meanConfidence,
          qualityFlags: info.qualityFlags,
          keypoints: Array.isArray(decodedFrame?.keypoints)
            ? decodedFrame.keypoints
            : undefined,
        },
      ];
      const readiness = evaluateCameraReadiness(qualityHistoryRef.current, {
        capturePerspective: perspective,
        nowMs,
      });
      latestCameraReadinessRef.current = readiness;
      setCameraReadiness(readiness);

      effectiveFpsSamplesRef.current = [
        ...effectiveFpsSamplesRef.current.filter(
          (sample) => sample.timestampMs >= nowMs - 5000,
        ),
        { timestampMs: nowMs, effectiveFps: readiness.effectiveFps },
      ];
      if (
        !monitorDegradedFraming &&
        !recordOnlyRef.current &&
        hasSustainedLowEffectiveFps(effectiveFpsSamplesRef.current, { nowMs })
      ) {
        const support = lowFpsRecordOnlySupport();
        setCaptureSupport(support);
        setRecordOnly(true);
        setRecordOnlyReason(support.reason);
      }

      // Feed the live coaching engine when active.
      if (engineRef.current) {
        if (decodedFrame) engineRef.current.pushFrame(decodedFrame);
      }

      if (!monitorDegradedFraming) return;

      if (!readiness.sustainedDegraded) {
        setFramingDegraded(false);
        return;
      }

      setFramingDegraded(true);
      setSessionQualityFlags((flags) =>
        appendUniqueFlags(flags, [
          "camera-readiness-degraded",
          ...readiness.qualityFlags.filter((flag) => flag !== "ok"),
        ]),
      );
    },
    [perspective],
  );

  const teardown = useCallback(async () => {
    calibrationSourceRef.current = null;
    sourceRef.current = null;
    recorderRef.current = null;
    uploaderRef.current = null;
    engineRef.current = null;
    clearCueDismissTimer();
    cancelSpokenCues();
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [clearCueDismissTimer]);

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
    setCameraReadiness(null);
    qualityHistoryRef.current = [];
    effectiveFpsSamplesRef.current = [];
    latestCameraReadinessRef.current = null;
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
      if (!latestCameraReadinessRef.current?.ready) {
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
    // Sidecar path: skip browser camera/calibration, use sidecar-3d perspective
    if (useSidecar) {
      setState({ kind: "starting" });
      let sessionId: string | undefined;
      try {
        const health = await checkSidecarHealth(SIDECAR_DEFAULT_PORT);
        setSidecarHealth(health);
        setSidecarError(null);
        if (health.status !== "ready") {
          setState({ kind: "error", message: `Sidecar not ready: ${health.status}` });
          return;
        }
        const createRes = await fetch("/api/mocap/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "sidecar",
            captureModelVersion: `freemocap-sidecar@schemaV${health.schemaVersion}`,
            capturePerspective: "sidecar-3d",
            captureFps: health.fps,
            recordOnly: false,
            cameraCount: health.cameras,
          }),
        });
        if (!createRes.ok) throw new Error(`Create session failed: ${createRes.status}`);
        const created: { id: string } = await createRes.json();
        sessionId = created.id;

        const startedAt = Date.now();
        startedAtRef.current = startedAt;
        recordOnlyRef.current = false;
        setElapsedSec(0);
        setFramesEncoded(0);
        setFramingDegraded(false);
        setCameraReadiness(null);
        setSessionQualityFlags([]);
        qualityHistoryRef.current = [];
        effectiveFpsSamplesRef.current = [];
        latestCameraReadinessRef.current = null;
        const source = new FreemocapSidecarSource({
          sessionId: created.id,
          port: SIDECAR_DEFAULT_PORT,
          cameraCount: health.cameras,
          onStatus: (s) => setPoseStatus(s),
          onFrame: (info) => handlePoseFrame(info, false),
          onError: (err) => handleError(err, created.id),
        });
        sourceRef.current = source;
        await source.init();
        await source.start();

        setState({
          kind: "capturing",
          sessionId: created.id,
          startedAt,
          source: "sidecar",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sidecar error";
        setSidecarError(msg);
        await handleError(err, sessionId);
      }
      return;
    }

    const captureRecordOnly =
      recordOnly ||
      Boolean(
        captureSupport?.recordOnlyRecommended && !captureSupport.livePoseSupported,
      );
    if (captureSupport && !captureSupport.videoCaptureSupported) {
      setState({ kind: "error", message: captureSupport.message });
      return;
    }
    recordOnlyRef.current = captureRecordOnly;

    const calibrationFrames = getCalibrationFrames(calibration);
    if (
      !captureRecordOnly &&
      (!calibrationFrames || !latestCameraReadinessRef.current?.ready)
    ) {
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

      // Spin up the live coaching engine (skipped when in record-only mode).
      const calibrationFramesForEngine = buildEngineCalibration(
        perspective,
        calibrationFrames?.catchFrame,
        calibrationFrames?.finishFrame,
      );
      const mocapPrefs = settings.getMocapSettings();
      if (!captureRecordOnly) {
        engineRef.current = new LiveCoachingEngine({
          fps: CAPTURE_FPS,
          capturePerspective: perspective,
          calibration: calibrationFramesForEngine,
          thresholds: mocapPrefs.postureThresholds.thresholds,
          minSeverity:
            mocapPrefs.mocapPreferences.verbosity === "verbose"
              ? "info"
              : "warning",
          onCue: (cue) => {
            clearCueDismissTimer();
            setActiveCue(cue);
            cueDismissTimerRef.current = setTimeout(() => {
              setActiveCue(null);
              cueDismissTimerRef.current = null;
            }, 4000);
            if (audioEnabledRef.current) {
              speakCue(cue.audioHint);
            }
          },
        });
      } else {
        engineRef.current = null;
      }

      const createRes = await fetch("/api/mocap/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "browser",
          captureModelVersion: CAPTURE_MODEL_VERSION,
          capturePerspective: perspective,
          captureFps: CAPTURE_FPS,
          recordOnly: captureRecordOnly,
          calibrationCatchFrame: calibrationFrames?.catchFrame,
          calibrationFinishFrame: calibrationFrames?.finishFrame,
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

      if (!captureRecordOnly) {
        const source = new BrowserPoseSource({
          sessionId,
          videoEl: video,
          onStatus: (s) => setPoseStatus(s),
          onFrame: (info) => handlePoseFrame(info, true),
          onError: (err) => handleError(err, sessionId),
        });
        sourceRef.current = source;
        await source.init();
      } else {
        sourceRef.current = null;
        setPoseStatus("stopped");
      }

      recorder.start(VIDEO_TIMESLICE_MS);
      sourceRef.current?.start();
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setFramesEncoded(0);
      setFramingDegraded(false);
      setSessionQualityFlags(
        captureRecordOnly
          ? recordOnlySessionFlags([], recordOnlyReason)
          : [],
      );
      qualityHistoryRef.current = [];
      effectiveFpsSamplesRef.current = [];
      latestCameraReadinessRef.current = null;
      setCameraReadiness(null);
      setState({
        kind: "capturing",
        sessionId,
        startedAt: startedAtRef.current,
        source: "browser",
      });
    } catch (err) {
      await handleError(err, sessionId);
    }
  }, [
    calibration,
    captureSupport,
    handleError,
    handlePoseFrame,
    perspective,
    recordOnly,
    recordOnlyReason,
    useSidecar,
    clearCueDismissTimer,
  ]);

  const stop = useCallback(async () => {
    if (state.kind !== "capturing") return;
    const sessionId = state.sessionId;
    const captureSource = state.source;
    const captureWasRecordOnly = recordOnlyRef.current;
    setState({ kind: "stopping", sessionId, source: captureSource });
    try {
      if (captureSource === "sidecar") {
        await sourceRef.current?.stop();
      } else {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          await new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
            recorder.stop();
          });
        }
        await sourceRef.current?.stop();
        await uploaderRef.current?.drain();
      }
      // Drain any pending strokes from the live engine before tearing it down.
      try {
        engineRef.current?.flush();
      } catch {
        // non-fatal
      }
      engineRef.current = null;
      clearCueDismissTimer();
      cancelSpokenCues();

      const startedAt = startedAtRef.current || state.startedAt;
      const durationSec = Math.max(0, (Date.now() - startedAt) / 1000);
      const finalizeQualityFlags = captureWasRecordOnly
        ? recordOnlySessionFlags(sessionQualityFlags, recordOnlyReason)
        : sessionQualityFlags;
      const finalizeRes = await fetch(
        `/api/mocap/sessions/${sessionId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            durationSec,
            qualityScore: captureWasRecordOnly
              ? undefined
              : qualityScoreFor(latestPoseFrameRef.current),
            qualityFlags: finalizeQualityFlags,
            skipAnalysis: captureWasRecordOnly,
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

      // Fetch faults for end-of-session summary
      let faults: PostureFault[] = [];
      try {
        const sessionRes = await fetch(`/api/mocap/sessions/${finalized.id}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          faults = (sessionData.session?.postureFaults ?? []) as PostureFault[];
          setSessionFaults(faults);
        }
      } catch {
        // non-fatal — summary just won't show
      }

      setState({
        kind: "done",
        sessionId: finalized.id,
        durationSec: finalized.durationSec,
        frameCount: finalized.frameCount,
        recordOnly: captureWasRecordOnly,
        source: captureSource,
      });
    } catch (err) {
      await handleError(err, sessionId);
    }
  }, [
    state,
    handleError,
    sessionQualityFlags,
    teardown,
    recordOnlyReason,
    clearCueDismissTimer,
  ]);

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
        const startedAt = startedAtRef.current || state.startedAt;
        const durationSec = Math.max(0, (Date.now() - startedAt) / 1000);
        const captureWasRecordOnly = recordOnlyRef.current;
        navigator.sendBeacon?.(
          `/api/mocap/sessions/${sessionId}/finalize`,
          new Blob(
            [
              JSON.stringify({
                durationSec,
                qualityScore: captureWasRecordOnly
                  ? undefined
                  : qualityScoreFor(latestPoseFrameRef.current),
                qualityFlags: captureWasRecordOnly
                  ? recordOnlySessionFlags(sessionQualityFlags, recordOnlyReason)
                  : sessionQualityFlags,
                skipAnalysis: captureWasRecordOnly,
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
  }, [state, sessionQualityFlags, recordOnlyReason]);

  const calibrationFrames = getCalibrationFrames(calibration);
  const nextCalibrationPose: CalibrationPose | null = !(
    "catchFrame" in calibration && calibration.catchFrame
  )
    ? "catch"
    : !("finishFrame" in calibration && calibration.finishFrame)
      ? "finish"
      : null;
  const cameraReady = cameraReadiness?.ready ?? false;
  const videoCaptureSupported = captureSupport?.videoCaptureSupported ?? true;
  const livePoseSupported = captureSupport?.livePoseSupported ?? true;
  const recordOnlyForced = Boolean(
    captureSupport?.recordOnlyRecommended && !captureSupport.livePoseSupported,
  );
  const recordOnlyActive = recordOnly || recordOnlyForced;
  const browserRecordOnlyActive = !useSidecar && recordOnlyActive;
  const sidecarReady =
    useSidecar && sidecarHealth?.status === "ready" && sidecarError === null;
  const captureBusy =
    state.kind === "capturing" ||
    state.kind === "starting" ||
    state.kind === "stopping";
  const canRecord =
    !captureBusy &&
    (useSidecar
      ? sidecarReady
      : videoCaptureSupported &&
        (browserRecordOnlyActive ||
          (livePoseSupported &&
            calibration.kind === "ready" &&
            Boolean(calibrationFrames) &&
            cameraReady)));

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Motion capture session</CardTitle>
              <CardDescription>
                Single-webcam pose capture. Camera permission is requested only when
                you click Start.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/mocap/sessions" data-testid="mocap-view-sessions">
                View sessions
              </Link>
            </Button>
          </div>
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
                checked={recordOnlyActive}
                onChange={(e) => {
                  setRecordOnly(e.target.checked);
                  setRecordOnlyReason(e.target.checked ? null : null);
                }}
                disabled={captureBusy || recordOnlyForced}
                data-testid="mocap-record-only"
              />
              Record-only mode
            </label>
            <label className="flex items-center gap-2 text-sm select-none" data-testid="mocap-audio-label">
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={(e) => updateAudioEnabled(e.target.checked)}
                data-testid="mocap-audio-toggle"
              />
              Audio cues
            </label>
            <label className="flex items-center gap-2 text-sm select-none" data-testid="mocap-sidecar-label">
              <input
                type="checkbox"
                checked={useSidecar}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setUseSidecar(checked);
                  setSidecarError(null);
                  setSidecarHealth(null);
                  if (checked) {
                    try {
                      const h = await checkSidecarHealth(SIDECAR_DEFAULT_PORT);
                      setSidecarHealth(h);
                    } catch {
                      setSidecarError("Sidecar not reachable on port 8765. Install rowing-tracker-sidecar and run it first.");
                    }
                  }
                }}
                disabled={state.kind !== "idle" && state.kind !== "done"}
                data-testid="mocap-sidecar-toggle"
              />
              Multi-camera sidecar
            </label>
            {useSidecar && sidecarHealth && (
              <span className="text-xs text-green-600" data-testid="mocap-sidecar-status">
                Sidecar ready — {sidecarHealth.cameras} camera{sidecarHealth.cameras !== 1 ? "s" : ""}, {sidecarHealth.fps} fps
              </span>
            )}
            {useSidecar && sidecarError && (
              <span className="text-xs text-red-500" data-testid="mocap-sidecar-error">
                {sidecarError}
              </span>
            )}
            <label className="flex items-center gap-2 text-sm select-none" data-testid="mocap-verbosity-label">
              Cues:
              <select
                className="rounded border px-2 py-1 text-sm bg-transparent"
                value={verbosity}
                onChange={(e) =>
                  updateVerbosity(e.target.value as "quiet" | "verbose")
                }
                data-testid="mocap-verbosity"
              >
                <option value="quiet">Quiet</option>
                <option value="verbose">Verbose</option>
              </select>
            </label>
            {calibration.kind === "idle" &&
            (state.kind === "idle" || state.kind === "done") &&
            livePoseSupported &&
            !browserRecordOnlyActive &&
            !useSidecar ? (
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
            {calibration.kind === "ready" && nextCalibrationPose && !useSidecar ? (
              <Button
                onClick={() => captureCalibrationFrame(nextCalibrationPose)}
                disabled={!cameraReady}
                data-testid={`mocap-capture-${nextCalibrationPose}`}
              >
                Capture {nextCalibrationPose}
              </Button>
            ) : null}
            {calibration.kind === "ready" &&
            (state.kind === "idle" || state.kind === "done") &&
            livePoseSupported &&
            !browserRecordOnlyActive &&
            !useSidecar ? (
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
                {useSidecar
                  ? "Start sidecar capture"
                  : browserRecordOnlyActive
                    ? "Start video recording"
                    : "Start mocap session"}
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

          {captureSupport && !captureSupport.videoCaptureSupported ? (
            <div
              className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm"
              data-testid="mocap-capture-unsupported"
            >
              {captureSupport.message}
            </div>
          ) : null}

          {browserRecordOnlyActive && videoCaptureSupported ? (
            <div
              className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm"
              data-testid="mocap-record-only-notice"
            >
              {captureSupport?.recordOnlyRecommended
                ? captureSupport.message
                : "Record-only mode saves video without live posture analysis. You can review the video later, but no posture rows are created during capture."}
            </div>
          ) : null}

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <CalibrationStep
              label="Catch"
              done={
                browserRecordOnlyActive ||
                useSidecar ||
                ("catchFrame" in calibration && Boolean(calibration.catchFrame))
              }
            />
            <CalibrationStep
              label="Finish"
              done={
                browserRecordOnlyActive ||
                useSidecar ||
                ("finishFrame" in calibration && Boolean(calibration.finishFrame))
              }
            />
            <CalibrationStep
              label="Camera check"
              done={browserRecordOnlyActive || useSidecar || cameraReady}
            />
          </div>

          {cameraReadiness && !cameraReady && !browserRecordOnlyActive && !useSidecar ? (
            <div
              className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm"
              data-testid="mocap-camera-readiness-hint"
            >
              {cameraReadiness.message}
            </div>
          ) : null}

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
              Camera readiness degraded for several seconds. Check lighting,
              tracking, and side-view framing before continuing.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="State" value={state.kind} />
            <Stat label="Pose worker" value={poseStatus} />
            <Stat label="Frames encoded" value={framesEncoded.toString()} />
            <Stat
              label="Effective FPS"
              value={(cameraReadiness?.effectiveFps ?? 0).toFixed(1)}
            />
            <Stat
              label="Model confidence"
              value={`${Math.round((cameraReadiness?.modelConfidence ?? quality.meanConfidence) * 100)}%`}
            />
            <Stat
              label="Tracked keypoints"
              value={`${cameraReadiness?.trackedKeypointCount ?? quality.trackedKeypointCount}/33`}
            />
            <Stat
              label="Quality flags"
              value={cameraQualityFlagLabel(cameraReadiness?.qualityFlags ?? ["no-pose"])}
            />
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
                {state.recordOnly
                  ? "Video-only recording"
                  : `${state.frameCount} pose frames`}{" "}
                · {state.durationSec.toFixed(1)}s duration
              </div>
              {!state.recordOnly ? (
                <SessionCoachingSummary faults={sessionFaults} />
              ) : null}
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/mocap/sessions/${state.sessionId}`}
                  className="underline text-green-800 dark:text-green-300"
                  data-testid="mocap-replay-link"
                >
                  View replay →
                </Link>
                <span className="text-green-700/50 dark:text-green-400/50">·</span>
                <Link
                  href="/mocap/sessions"
                  className="underline text-green-800 dark:text-green-300"
                  data-testid="mocap-sessions-link"
                >
                  All sessions
                </Link>
              </div>
            </div>
          ) : null}

          {activeCue ? (
            <div
              className={`rounded border p-3 text-sm space-y-1 ${
                activeCue.severity === "critical"
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-yellow-500/40 bg-yellow-500/10"
              }`}
              data-testid="mocap-coaching-cue"
            >
              <div className="font-medium">
                {activeCue.severity === "critical" ? "⚠ " : "ℹ "}
                {activeCue.message}
              </div>
              {activeCue.drills.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  Drills: {activeCue.drills.join(" · ")}
                </div>
              ) : null}
              <button
                type="button"
                className="text-xs underline opacity-60"
                onClick={dismissCue}
              >
                Dismiss
              </button>
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

function qualityScoreFor(quality: PoseQuality): number {
  const trackedRatio = quality.trackedKeypointCount / 33;
  return Math.max(0, Math.min(1, quality.meanConfidence * trackedRatio));
}

function recordOnlySessionFlags(
  current: readonly string[],
  reason: RecordOnlyReason | null,
): string[] {
  return appendUniqueFlags(current, ["record-only", recordOnlyQualityFlag(reason)]);
}

function appendUniqueFlags(
  current: readonly string[],
  next: readonly string[],
): string[] {
  return [...new Set([...current, ...next])];
}

function SessionCoachingSummary({ faults }: { faults: PostureFault[] }) {
  if (faults.length === 0) return null;

  // Aggregate by fault type: total weight = count × severity weight
  const typeMap = new Map<string, { count: number; weight: number; severity: string }>();
  for (const f of faults) {
    const existing = typeMap.get(f.faultType);
    const w = SEVERITY_WEIGHT[f.severity] ?? 1;
    if (!existing) {
      typeMap.set(f.faultType, { count: 1, weight: w, severity: f.severity });
    } else {
      existing.count++;
      existing.weight += w;
      if ((SEVERITY_WEIGHT[f.severity] ?? 1) > (SEVERITY_WEIGHT[existing.severity] ?? 1)) {
        existing.severity = f.severity;
      }
    }
  }

  const top3 = [...typeMap.entries()]
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 3);

  if (top3.length === 0) return null;

  const cues = getCoachingCues(
    faults.filter((f) => top3.some(([t]) => t === f.faultType)),
    { strokeCount: faults.length },
    { minSeverity: "info" },
  );

  return (
    <div className="border-t border-green-500/30 pt-2 space-y-1" data-testid="mocap-session-summary">
      <div className="font-medium text-xs uppercase tracking-wide opacity-70">Session summary</div>
      {top3.map(([faultType, info]) => {
        const cue = cues.find((c) => c.faultType === faultType);
        const label = faultType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <div key={faultType} className="text-xs space-y-0.5">
            <div className="font-medium">{label} <span className="opacity-60">× {info.count}</span></div>
            {cue?.drills.map((d) => (
              <div key={d} className="opacity-70 pl-2">→ {d}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function decodeBase64PoseFrame(
  base64: string,
): PoseAnalysisFrame | null {
  if (!base64) return null;
  try {
    const binary = atob(base64);
    if (binary.length < BYTES_PER_FRAME_V1) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const isV2 = bytes.byteLength === BYTES_PER_FRAME_V2;
    const decoded = decodeFrame(bytes, 0, isV2 ? KEYPOINT_SCHEMA_V2 : undefined);
    return {
      timestampMs: decoded.timestampMs,
      keypoints: isV2
        ? keypointQuadsToPosePoints(decoded.keypoints)
        : keypointTripletsToPosePoints(decoded.keypoints),
      qualityFlags: decoded.qualityFlags,
    };
  } catch {
    return null;
  }
}

function buildEngineCalibration(
  capturePerspective: "side-left" | "side-right",
  catchFrameBase64: { poseFrameBase64: string } | undefined,
  finishFrameBase64: { poseFrameBase64: string } | undefined,
): Calibration | undefined {
  const catchFrame = catchFrameBase64?.poseFrameBase64
    ? decodeBase64PoseFrame(catchFrameBase64.poseFrameBase64) ?? undefined
    : undefined;
  const finishFrame = finishFrameBase64?.poseFrameBase64
    ? decodeBase64PoseFrame(finishFrameBase64.poseFrameBase64) ?? undefined
    : undefined;
  if (!catchFrame && !finishFrame) return undefined;
  return {
    capturePerspective,
    catchFrame,
    finishFrame,
  };
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
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c;
    }
  }
  return "video/webm";
}
