import {
  BYTES_PER_FRAME_V1,
  HEADER_SIZE,
  type CoordinateSpace,
  decodeHeader,
  framesFromBlobSize,
  encodeHeader,
} from "./poseFrameStream";
import type { MocapStorage } from "./storage";

const FRAME_COUNT_OFFSET = 16;

export interface FinalizedPoseStream {
  frameCount: number;
  poseStreamBytes: number;
}

export interface InitializePoseStreamBlobOptions {
  keypointSchemaVersion?: number;
  coordinateSpace?: CoordinateSpace;
  cameraCount?: number;
}

export function validatePoseFrameChunk(
  bytes: Uint8Array,
  bytesPerFrame = BYTES_PER_FRAME_V1,
): number {
  if (bytes.byteLength === 0) return 0;
  if (bytes.byteLength % bytesPerFrame !== 0) {
    throw new Error(
      `Body length ${bytes.byteLength} not multiple of frame size ${bytesPerFrame}`,
    );
  }
  return bytes.byteLength / bytesPerFrame;
}

export async function initializePoseStreamBlob(
  storage: MocapStorage,
  poseStreamPath: string,
  fps: number,
  opts: InitializePoseStreamBlobOptions = {},
): Promise<void> {
  await storage.appendBytes(poseStreamPath, encodeHeader({ fps, ...opts }));
}

export async function appendPoseFrames(
  storage: MocapStorage,
  poseStreamPath: string,
  bytes: Uint8Array,
): Promise<number> {
  let bytesPerFrame = BYTES_PER_FRAME_V1;
  if (bytes.byteLength > 0) {
    const header = decodeHeader(
      await storage.read(poseStreamPath, { start: 0, end: HEADER_SIZE }),
    );
    bytesPerFrame = header.bytesPerFrame;
  }
  const framesAppended = validatePoseFrameChunk(bytes, bytesPerFrame);
  if (framesAppended > 0) {
    await storage.appendBytes(poseStreamPath, bytes);
  }
  return framesAppended;
}

export async function finalizePoseStreamBlob(
  storage: MocapStorage,
  poseStreamPath: string,
): Promise<FinalizedPoseStream> {
  const poseStreamBytes = await storage.size(poseStreamPath);
  if (poseStreamBytes < HEADER_SIZE) {
    throw new Error("Pose stream truncated below header");
  }

  const header = decodeHeader(
    await storage.read(poseStreamPath, { start: 0, end: HEADER_SIZE }),
  );
  const trailing = (poseStreamBytes - HEADER_SIZE) % header.bytesPerFrame;
  if (trailing !== 0) {
    throw new Error(`Pose stream has ${trailing} trailing bytes (corrupt)`);
  }

  const frameCount = framesFromBlobSize(
    poseStreamBytes,
    header.keypointSchemaVersion,
  );
  const headerPatch = new Uint8Array(4);
  new DataView(headerPatch.buffer).setUint32(0, frameCount, true);
  await storage.writeAt(poseStreamPath, headerPatch, FRAME_COUNT_OFFSET);

  return { frameCount, poseStreamBytes };
}
