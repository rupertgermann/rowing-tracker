import {
  BYTES_PER_FRAME_V1,
  HEADER_SIZE,
  framesFromBlobSize,
  encodeHeader,
} from "./poseFrameStream";
import type { MocapStorage } from "./storage";

const FRAME_COUNT_OFFSET = 16;

export interface FinalizedPoseStream {
  frameCount: number;
  poseStreamBytes: number;
}

export function validatePoseFrameChunk(bytes: Uint8Array): number {
  if (bytes.byteLength === 0) return 0;
  if (bytes.byteLength % BYTES_PER_FRAME_V1 !== 0) {
    throw new Error(
      `Body length ${bytes.byteLength} not multiple of frame size ${BYTES_PER_FRAME_V1}`,
    );
  }
  return bytes.byteLength / BYTES_PER_FRAME_V1;
}

export async function initializePoseStreamBlob(
  storage: MocapStorage,
  poseStreamPath: string,
  fps: number,
): Promise<void> {
  await storage.appendBytes(poseStreamPath, encodeHeader({ fps }));
}

export async function appendPoseFrames(
  storage: MocapStorage,
  poseStreamPath: string,
  bytes: Uint8Array,
): Promise<number> {
  const framesAppended = validatePoseFrameChunk(bytes);
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

  const trailing = (poseStreamBytes - HEADER_SIZE) % BYTES_PER_FRAME_V1;
  if (trailing !== 0) {
    throw new Error(`Pose stream has ${trailing} trailing bytes (corrupt)`);
  }

  const frameCount = framesFromBlobSize(poseStreamBytes);
  const headerPatch = new Uint8Array(4);
  new DataView(headerPatch.buffer).setUint32(0, frameCount, true);
  await storage.writeAt(poseStreamPath, headerPatch, FRAME_COUNT_OFFSET);

  return { frameCount, poseStreamBytes };
}
