import {
  BYTES_PER_FRAME_V1,
  BYTES_PER_FRAME_V2,
  HEADER_SIZE,
  KEYPOINT_SCHEMA_V1,
  KEYPOINT_SCHEMA_V2,
  KEYPOINTS_PER_FRAME_V1,
  KEYPOINTS_PER_FRAME_V2,
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
  const isV2 = header.keypointSchemaVersion === KEYPOINT_SCHEMA_V2;
  const expectedKeypoints = isV2 ? KEYPOINTS_PER_FRAME_V2 : KEYPOINTS_PER_FRAME_V1;
  const expectedBytesPerFrame = isV2 ? BYTES_PER_FRAME_V2 : BYTES_PER_FRAME_V1;

  if (
    header.keypointsPerFrame !== expectedKeypoints ||
    header.bytesPerFrame !== expectedBytesPerFrame
  ) {
    throw new PoseStreamFormatError(
      `PoseFrameStream header does not match v${header.keypointSchemaVersion} frame layout`,
    );
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

  const schema = header.keypointSchemaVersion;
  return {
    fps: header.fps,
    capturePerspective,
    coordinateSpace: header.coordinateSpace,
    cameraCount: header.cameraCount,
    frames: Array.from({ length: frameCount }, (_, frameIndex) =>
      adaptFrame(packedFrames, frameIndex * header.bytesPerFrame, schema),
    ),
  };
}

function adaptFrame(
  bytes: Uint8Array,
  offset: number,
  schema: number,
): PoseAnalysisFrame {
  const frame = decodeFrame(bytes, offset, schema);
  return {
    timestampMs: frame.timestampMs,
    keypoints:
      schema === KEYPOINT_SCHEMA_V2
        ? keypointQuadsToPosePoints(frame.keypoints)
        : keypointTripletsToPosePoints(frame.keypoints),
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

export function keypointQuadsToPosePoints(keypoints: Float32Array): PosePoint[] {
  const points: PosePoint[] = [];
  for (let i = 0; i < keypoints.length; i += 4) {
    points.push({
      x: keypoints[i],
      y: keypoints[i + 1],
      z: keypoints[i + 2],
      confidence: keypoints[i + 3],
    });
  }
  return points;
}
