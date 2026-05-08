/**
 * PoseFrameStream binary blob format (ADR-0001).
 *
 * Layout: [header: 32 bytes][frame 0][frame 1]...[frame N-1]
 *
 * Random access by frame index = byte-range read at
 *   HEADER_SIZE + frameIndex * BYTES_PER_FRAME
 *
 * Header `frameCount` is OPEN_FRAME_COUNT during streaming append and updated
 * to the final count on session finalize. Readers must accept either form: when
 * they see OPEN_FRAME_COUNT, they derive the count from file size.
 */

export const MAGIC = new Uint8Array([0x4d, 0x4f, 0x50, 0x53]); // "MOPS"
export const HEADER_SIZE = 32;
export const FORMAT_VERSION = 1;
export const KEYPOINT_SCHEMA_V1 = 1;
export const KEYPOINTS_PER_FRAME_V1 = 33;
export const BYTES_PER_FRAME_V1 =
  4 /* timestampMs Float32 */ +
  KEYPOINTS_PER_FRAME_V1 * 3 * 4 /* x, y, confidence Float32 */ +
  4; /* qualityFlags Uint32 */
export const OPEN_FRAME_COUNT = 0xffffffff;

export const QUALITY_FLAG = {
  LOW_LIGHT: 1 << 0,
  OCCLUDED: 1 << 1,
  OUT_OF_FRAME: 1 << 2,
  LOW_CONFIDENCE: 1 << 3,
  CAMERA_MOTION: 1 << 4,
} as const;

export interface PoseStreamHeader {
  formatVersion: number;
  keypointSchemaVersion: number;
  fps: number;
  keypointsPerFrame: number;
  bytesPerFrame: number;
  frameCount: number; // OPEN_FRAME_COUNT during streaming
}

export interface PoseFrame {
  timestampMs: number;
  /** Length = keypointsPerFrame * 3 (x, y, confidence interleaved). */
  keypoints: Float32Array;
  qualityFlags: number;
}

export class PoseStreamFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoseStreamFormatError";
  }
}

export function encodeHeader(opts: {
  fps: number;
  keypointSchemaVersion?: number;
  frameCount?: number;
}): Uint8Array {
  const schema = opts.keypointSchemaVersion ?? KEYPOINT_SCHEMA_V1;
  if (schema !== KEYPOINT_SCHEMA_V1) {
    throw new PoseStreamFormatError(
      `Unsupported keypointSchemaVersion ${schema}`,
    );
  }
  const buf = new Uint8Array(HEADER_SIZE);
  const view = new DataView(buf.buffer);
  buf.set(MAGIC, 0);
  view.setUint16(4, FORMAT_VERSION, true);
  view.setUint16(6, schema, true);
  view.setFloat32(8, opts.fps, true);
  view.setUint16(12, KEYPOINTS_PER_FRAME_V1, true);
  view.setUint16(14, BYTES_PER_FRAME_V1, true);
  view.setUint32(16, opts.frameCount ?? OPEN_FRAME_COUNT, true);
  // bytes 20-31 reserved (zero)
  return buf;
}

export function decodeHeader(bytes: Uint8Array): PoseStreamHeader {
  if (bytes.byteLength < HEADER_SIZE) {
    throw new PoseStreamFormatError(
      `Header too short: ${bytes.byteLength} < ${HEADER_SIZE}`,
    );
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new PoseStreamFormatError("Bad magic; not a PoseFrameStream blob");
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_SIZE);
  const formatVersion = view.getUint16(4, true);
  if (formatVersion !== FORMAT_VERSION) {
    throw new PoseStreamFormatError(
      `Unsupported formatVersion ${formatVersion}; reader knows ${FORMAT_VERSION}`,
    );
  }
  const keypointSchemaVersion = view.getUint16(6, true);
  if (keypointSchemaVersion !== KEYPOINT_SCHEMA_V1) {
    throw new PoseStreamFormatError(
      `Unsupported keypointSchemaVersion ${keypointSchemaVersion}; reader knows ${KEYPOINT_SCHEMA_V1}`,
    );
  }
  return {
    formatVersion,
    keypointSchemaVersion,
    fps: view.getFloat32(8, true),
    keypointsPerFrame: view.getUint16(12, true),
    bytesPerFrame: view.getUint16(14, true),
    frameCount: view.getUint32(16, true),
  };
}

export function encodeFrame(frame: PoseFrame): Uint8Array {
  if (frame.keypoints.length !== KEYPOINTS_PER_FRAME_V1 * 3) {
    throw new PoseStreamFormatError(
      `Expected ${KEYPOINTS_PER_FRAME_V1 * 3} keypoint floats, got ${frame.keypoints.length}`,
    );
  }
  const buf = new Uint8Array(BYTES_PER_FRAME_V1);
  const view = new DataView(buf.buffer);
  view.setFloat32(0, frame.timestampMs, true);
  const floats = new Float32Array(buf.buffer, 4, KEYPOINTS_PER_FRAME_V1 * 3);
  floats.set(frame.keypoints);
  view.setUint32(BYTES_PER_FRAME_V1 - 4, frame.qualityFlags >>> 0, true);
  return buf;
}

export function decodeFrame(bytes: Uint8Array, offset = 0): PoseFrame {
  if (bytes.byteLength - offset < BYTES_PER_FRAME_V1) {
    throw new PoseStreamFormatError(
      `Frame slice too short: ${bytes.byteLength - offset} < ${BYTES_PER_FRAME_V1}`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, BYTES_PER_FRAME_V1);
  const timestampMs = view.getFloat32(0, true);
  const keypoints = new Float32Array(KEYPOINTS_PER_FRAME_V1 * 3);
  for (let i = 0; i < keypoints.length; i++) {
    keypoints[i] = view.getFloat32(4 + i * 4, true);
  }
  const qualityFlags = view.getUint32(BYTES_PER_FRAME_V1 - 4, true);
  return { timestampMs, keypoints, qualityFlags };
}

export function frameByteOffset(frameIndex: number): number {
  return HEADER_SIZE + frameIndex * BYTES_PER_FRAME_V1;
}

export function framesFromBlobSize(blobSize: number): number {
  if (blobSize < HEADER_SIZE) return 0;
  return Math.floor((blobSize - HEADER_SIZE) / BYTES_PER_FRAME_V1);
}
