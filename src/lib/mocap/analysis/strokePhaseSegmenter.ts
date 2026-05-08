import {
  getPosePoint,
  landmarkSide,
  type PoseFrameStream,
  type PoseLandmarkName,
  type Stroke,
} from "./types";

interface SignalPoint {
  frameIndex: number;
  value: number;
  tracked: boolean;
}

export function StrokePhaseSegmenter(stream: PoseFrameStream): Stroke[] {
  if (stream.frames.length < 3) return [];

  const signal = smoothSignal(buildHipKneeDistanceSignal(stream), stream.fps);
  const catches = findCatchCandidates(signal, stream.fps);
  const strokes: Stroke[] = [];

  for (let i = 0; i < catches.length - 1; i++) {
    const catchFrameIndex = catches[i];
    const nextCatchFrameIndex = catches[i + 1];
    if (nextCatchFrameIndex - catchFrameIndex < 3) continue;

    const finishFrameIndex = maxSignalFrame(
      signal,
      catchFrameIndex,
      nextCatchFrameIndex,
    );
    if (finishFrameIndex <= catchFrameIndex) continue;

    const recoveryStartFrameIndex = Math.min(
      finishFrameIndex + 1,
      nextCatchFrameIndex,
    );
    const trackedFrames = signal
      .slice(catchFrameIndex, nextCatchFrameIndex + 1)
      .filter((p) => p.tracked).length;

    strokes.push({
      strokeIndex: strokes.length,
      segmentationSource: "pose-segmented",
      catchFrameIndex,
      driveStartFrameIndex: catchFrameIndex,
      finishFrameIndex,
      recoveryStartFrameIndex,
      nextCatchFrameIndex,
      confidence: trackedFrames / (nextCatchFrameIndex - catchFrameIndex + 1),
    });
  }

  return strokes;
}

function buildHipKneeDistanceSignal(stream: PoseFrameStream): SignalPoint[] {
  const side = landmarkSide(stream.capturePerspective);
  const hipName = `${side}Hip` as PoseLandmarkName;
  const kneeName = `${side}Knee` as PoseLandmarkName;

  return stream.frames.map((frame, frameIndex) => {
    const hip = getPosePoint(frame, hipName);
    const knee = getPosePoint(frame, kneeName);
    if (!hip || !knee || hip.confidence < 0.25 || knee.confidence < 0.25) {
      return { frameIndex, value: Number.NaN, tracked: false };
    }
    const dx = hip.x - knee.x;
    const dy = hip.y - knee.y;
    return {
      frameIndex,
      value: Math.hypot(dx, dy),
      tracked: true,
    };
  });
}

function smoothSignal(signal: SignalPoint[], fps: number): SignalPoint[] {
  const radius = Math.max(1, Math.round(fps * 0.06));
  return signal.map((point, i) => {
    let total = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - radius);
      j <= Math.min(signal.length - 1, i + radius);
      j++
    ) {
      const value = signal[j].value;
      if (Number.isFinite(value)) {
        total += value;
        count++;
      }
    }
    return {
      frameIndex: point.frameIndex,
      value: count > 0 ? total / count : point.value,
      tracked: point.tracked,
    };
  });
}

function findCatchCandidates(signal: SignalPoint[], fps: number): number[] {
  const values = signal
    .map((p) => p.value)
    .filter((value) => Number.isFinite(value));
  if (values.length < 3) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.0001, max - min);
  const lowThreshold = min + range * 0.35;
  const minGap = Math.max(4, Math.round(fps * 0.4));
  const catches: number[] = [];

  for (let i = 0; i < signal.length; i++) {
    const prev = signal[Math.max(0, i - 1)]?.value;
    const cur = signal[i].value;
    const next = signal[Math.min(signal.length - 1, i + 1)]?.value;
    if (!Number.isFinite(cur) || cur > lowThreshold) continue;

    const isEndpointMinimum =
      (i === 0 && Number.isFinite(next) && cur <= next) ||
      (i === signal.length - 1 && Number.isFinite(prev) && cur <= prev);
    const isInteriorMinimum =
      i > 0 &&
      i < signal.length - 1 &&
      Number.isFinite(prev) &&
      Number.isFinite(next) &&
      cur <= prev &&
      cur <= next &&
      (cur < prev || cur < next);

    if (!isEndpointMinimum && !isInteriorMinimum) continue;
    const last = catches[catches.length - 1];
    if (last === undefined || i - last >= minGap) {
      catches.push(i);
    } else if (cur < signal[last].value) {
      catches[catches.length - 1] = i;
    }
  }

  return catches;
}

function maxSignalFrame(
  signal: SignalPoint[],
  startFrame: number,
  endFrame: number,
): number {
  let maxFrame = startFrame;
  let maxValue = -Infinity;
  for (let i = startFrame; i <= endFrame; i++) {
    const value = signal[i]?.value;
    if (Number.isFinite(value) && value > maxValue) {
      maxValue = value;
      maxFrame = i;
    }
  }
  return maxFrame;
}
