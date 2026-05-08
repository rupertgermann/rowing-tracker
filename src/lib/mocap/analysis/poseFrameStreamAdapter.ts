import {
  BYTES_PER_FRAME_V1,
  HEADER_SIZE,
  KEYPOINTS_PER_FRAME_V1,
  OPEN_FRAME_COUNT,
  PoseStreamFormatError,
  decodeFrame,
  decodeHeader,
} from "../poseFrameStream";
import type {
  CapturePerspective,
  PoseAnalysisFrame,
  PoseFrameStream,
  PosePoint,
} from "./types";

export function adaptPoseFrameStreamBlob(
  blob: Uint8Array,
  capturePerspective: CapturePerspective,
): PoseFrameStream {
  return adaptPoseFrameStreamBytes(
    blob.subarray(0, HEADER_SIZE),
    blob.subarray(HEADER_SIZE),
    capturePerspective,
  );
}

export function adaptPoseFrameStreamBytes(
  headerBytes: Uint8Array,
  packedFrames: Uint8Array,
  capturePerspective: CapturePerspective,
): PoseFrameStream {
  const header = decodeHeader(headerBytes);
  if (
    header.keypointsPerFrame !== KEYPOINTS_PER_FRAME_V1 ||
    header.bytesPerFrame !== BYTES_PER_FRAME_V1
  ) {
    throw new PoseStreamFormatError("PoseFrameStream header does not match v1 frame layout");
  }

  if (packedFrames.byteLength % header.bytesPerFrame !== 0) {
    throw new PoseStreamFormatError(
      `Packed frames length ${packedFrames.byteLength} is not a multiple of frame size ${header.bytesPerFrame}`,
    );
  }

  const frameCount = packedFrames.byteLength / header.bytesPerFrame;
  if (header.frameCount !== OPEN_FRAME_COUNT && header.frameCount !== frameCount) {
    throw new PoseStreamFormatError(
      `Header frameCount ${header.frameCount} does not match packed frame count ${frameCount}`,
    );
  }

  return {
    fps: header.fps,
    capturePerspective,
    frames: Array.from({ length: frameCount }, (_, frameIndex) =>
      adaptFrame(packedFrames, frameIndex * header.bytesPerFrame),
    ),
  };
}

function adaptFrame(bytes: Uint8Array, offset: number): PoseAnalysisFrame {
  const frame = decodeFrame(bytes, offset);
  return {
    timestampMs: frame.timestampMs,
    keypoints: keypointTripletsToPosePoints(frame.keypoints),
    qualityFlags: frame.qualityFlags,
  };
}

export function keypointTripletsToPosePoints(keypoints: Float32Array): PosePoint[] {
  const points: PosePoint[] = [];
  for (let i = 0; i < keypoints.length; i += 3) {
    points.push({
      x: keypoints[i],
      y: keypoints[i + 1],
      confidence: keypoints[i + 2],
    });
  }
  return points;
}
