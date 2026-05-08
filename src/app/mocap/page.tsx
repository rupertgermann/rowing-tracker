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
import { VideoUploader } from "@/lib/mocap/videoUploader";

const CAPTURE_FPS = 30;
const CAPTURE_MODEL_VERSION = "mediapipe-pose-landmarker-lite@0.10.35";
const VIDEO_TIMESLICE_MS = 1000;

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

export default function MocapCapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const uploaderRef = useRef<VideoUploader | null>(null);
  const sourceRef = useRef<BrowserPoseSource | null>(null);
  const startedAtRef = useRef<number>(0);

  const [state, setState] = useState<CaptureState>({ kind: "idle" });
  const [framesEncoded, setFramesEncoded] = useState(0);
  const [poseStatus, setPoseStatus] = useState<PoseSourceStatus>("idle");
  const [perspective, setPerspective] = useState<"side-left" | "side-right">(
    "side-right",
  );
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (state.kind !== "capturing") return;
    const t = setInterval(() => {
      setElapsedSec((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    return () => clearInterval(t);
  }, [state.kind]);

  const teardown = useCallback(async () => {
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

  const start = useCallback(async () => {
    setState({ kind: "starting" });
    let sessionId: string | undefined;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: CAPTURE_FPS },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const createRes = await fetch("/api/mocap/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "browser",
          captureModelVersion: CAPTURE_MODEL_VERSION,
          capturePerspective: perspective,
          captureFps: CAPTURE_FPS,
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
        onFrame: (info) => setFramesEncoded(info.framesEncoded),
        onError: (err) => handleError(err, sessionId),
      });
      sourceRef.current = source;
      await source.init();

      recorder.start(VIDEO_TIMESLICE_MS);
      source.start();
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setFramesEncoded(0);
      setState({
        kind: "capturing",
        sessionId,
        startedAt: startedAtRef.current,
      });
    } catch (err) {
      await handleError(err, sessionId);
    }
  }, [handleError, perspective]);

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
          body: JSON.stringify({ durationSec }),
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
      setState({
        kind: "done",
        sessionId: finalized.id,
        durationSec: finalized.durationSec,
        frameCount: finalized.frameCount,
      });
    } catch (err) {
      await handleError(err, sessionId);
    }
  }, [state, handleError, teardown]);

  useEffect(() => {
    return () => {
      sourceRef.current?.stop().catch(() => {});
      recorderRef.current?.stop();
      teardown();
    };
  }, [teardown]);

  useEffect(() => {
    if (state.kind !== "capturing") return;
    const onUnload = () => {
      try {
        recorderRef.current?.requestData?.();
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [state.kind]);

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
                disabled={state.kind !== "idle" && state.kind !== "done"}
              >
                <option value="side-right">Side (right toward camera)</option>
                <option value="side-left">Side (left toward camera)</option>
              </select>
            </label>
            {state.kind === "idle" || state.kind === "done" ? (
              <Button onClick={start} data-testid="mocap-start">
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
          </div>

          {state.kind === "done" ? (
            <div
              className="rounded border border-green-500/40 bg-green-500/10 p-3 text-sm"
              data-testid="mocap-done"
            >
              <div>
                Session <code>{state.sessionId}</code> stored.
              </div>
              <div>
                {state.frameCount} pose frames · {state.durationSec.toFixed(1)}s
                duration
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
