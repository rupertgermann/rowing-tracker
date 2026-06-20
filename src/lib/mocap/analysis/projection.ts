import type { PoseFrameStream, PosePoint } from "./types";

const MIN_CONFIDENCE = 0.25;

interface SessionBounds {
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export function toProjectedStream(stream: PoseFrameStream): PoseFrameStream {
  if (stream.coordinateSpace !== "world-mm-3d") return stream;
  const bounds = computeSessionBounds(stream);
  const projectedFrames = stream.frames.map((frame) => {
    const kps = frame.keypoints;
    const projected = Array.isArray(kps)
      ? (kps as PosePoint[]).map((kp) => projectToNormalized(kp, bounds))
      : Object.fromEntries(
          Object.entries(kps as Record<string, PosePoint>).map(([k, v]) => [
            k,
            projectToNormalized(v, bounds),
          ]),
        );
    return { ...frame, keypoints: projected };
  });
  return { ...stream, frames: projectedFrames as PoseFrameStream["frames"] };
}

function computeSessionBounds(stream: PoseFrameStream): SessionBounds {
  let yMin = Infinity;
  let yMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const frame of stream.frames) {
    const kps = Array.isArray(frame.keypoints)
      ? frame.keypoints
      : Object.values(frame.keypoints);
    for (const kp of kps) {
      if (!kp || kp.confidence < MIN_CONFIDENCE) continue;
      if (kp.y < yMin) yMin = kp.y;
      if (kp.y > yMax) yMax = kp.y;
      if (kp.z === undefined) continue;
      if (kp.z < zMin) zMin = kp.z;
      if (kp.z > zMax) zMax = kp.z;
    }
  }
  return { yMin, yMax, zMin, zMax };
}

function projectToNormalized(point: PosePoint, bounds: SessionBounds): PosePoint {
  if (point.z === undefined) return point;
  const yRange = bounds.yMax - bounds.yMin;
  const zRange = bounds.zMax - bounds.zMin;
  return {
    x: zRange > 0 ? (point.z - bounds.zMin) / zRange : 0.5,
    y: yRange > 0 ? (point.y - bounds.yMin) / yRange : 0.5,
    confidence: point.confidence,
  };
}
