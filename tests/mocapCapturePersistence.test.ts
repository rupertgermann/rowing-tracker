import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BYTES_PER_FRAME_V2,
  decodeFrame,
  decodeHeader,
  encodeFrame,
  encodeFrameV2,
  encodeHeader,
  frameByteOffset,
  KEYPOINT_SCHEMA_V2,
  KEYPOINTS_PER_FRAME_V1,
  KEYPOINTS_PER_FRAME_V2,
  type PoseFrame,
} from "../src/lib/mocap/poseFrameStream";
import {
  appendPoseFrames,
  finalizePoseStreamBlob,
  initializePoseStreamBlob,
  validatePoseFrameChunk,
} from "../src/lib/mocap/capturePersistence";
import { LocalDiskStorage } from "../src/lib/mocap/storage";

test("capture persistence writes, finalizes, and byte-range reads identical pose frames", async () => {
  const { storage, cleanup } = await makeStorage();
  try {
    const posePath = storage.poseStreamPath("user-1", "session-1");
    const frames = [makeFrame(0), makeFrame(1), makeFrame(2)];
    const frameBytes = concat(frames.map(encodeFrame));

    await initializePoseStreamBlob(storage, posePath, 30);
    assert.equal(await appendPoseFrames(storage, posePath, frameBytes), 3);
    const finalized = await finalizePoseStreamBlob(storage, posePath);
    assert.equal(finalized.frameCount, 3);

    const header = decodeHeader(await storage.read(posePath, { start: 0, end: 32 }));
    assert.equal(header.keypointSchemaVersion, 1);
    assert.equal(header.frameCount, 3);

    const secondFrameBytes = await storage.read(posePath, {
      start: frameByteOffset(1),
      end: frameByteOffset(2),
    });
    const secondFrame = decodeFrame(secondFrameBytes);
    assert.equal(secondFrame.timestampMs, Math.fround(frames[1].timestampMs));
    assert.equal(secondFrame.qualityFlags, frames[1].qualityFlags);
    for (let i = 0; i < frames[1].keypoints.length; i++) {
      assert.equal(secondFrame.keypoints[i], frames[1].keypoints[i]);
    }
  } finally {
    await cleanup();
  }
});

test("finalize uses the pose-stream header frame size for v2 sidecar blobs", async () => {
  const { storage, cleanup } = await makeStorage();
  try {
    const posePath = storage.poseStreamPath("user-1", "session-v2");
    const frames = [makeFrameV2(0), makeFrameV2(1)];

    await storage.appendBytes(
      posePath,
      encodeHeader({
        fps: 60,
        keypointSchemaVersion: KEYPOINT_SCHEMA_V2,
        coordinateSpace: "world-mm-3d",
        cameraCount: 3,
      }),
    );
    await storage.appendBytes(posePath, concat(frames.map(encodeFrameV2)));

    const finalized = await finalizePoseStreamBlob(storage, posePath);
    assert.equal(finalized.frameCount, 2);

    const header = decodeHeader(await storage.read(posePath, { start: 0, end: 32 }));
    assert.equal(header.keypointSchemaVersion, KEYPOINT_SCHEMA_V2);
    assert.equal(header.cameraCount, 3);
    assert.equal(header.frameCount, 2);
    assert.equal(header.bytesPerFrame, BYTES_PER_FRAME_V2);
  } finally {
    await cleanup();
  }
});

test("capture persistence rejects partial-frame chunks before storage append", () => {
  const bad = new Uint8Array(17);
  assert.throws(
    () => validatePoseFrameChunk(bad),
    /not multiple of frame size/,
  );
});

test("finalize rejects corrupted blobs with partial trailing frame bytes", async () => {
  const { storage, cleanup } = await makeStorage();
  try {
    const posePath = storage.poseStreamPath("user-1", "session-corrupt");
    await initializePoseStreamBlob(storage, posePath, 30);
    await storage.appendBytes(posePath, new Uint8Array(17));
    await assert.rejects(
      () => finalizePoseStreamBlob(storage, posePath),
      /trailing bytes/,
    );
  } finally {
    await cleanup();
  }
});

async function makeStorage(): Promise<{
  storage: LocalDiskStorage;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mocap-storage-"));
  return {
    storage: new LocalDiskStorage(root),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

function makeFrame(seed: number): PoseFrame {
  const keypoints = new Float32Array(KEYPOINTS_PER_FRAME_V1 * 3);
  for (let i = 0; i < keypoints.length; i++) {
    keypoints[i] = Math.fround(seed + i / 100);
  }
  return {
    timestampMs: seed * 33.333,
    keypoints,
    qualityFlags: seed,
  };
}

function makeFrameV2(seed: number): PoseFrame {
  const keypoints = new Float32Array(KEYPOINTS_PER_FRAME_V2 * 4);
  for (let i = 0; i < keypoints.length; i++) {
    keypoints[i] = Math.fround(seed + i / 100);
  }
  return {
    timestampMs: seed * 16.667,
    keypoints,
    qualityFlags: seed,
  };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
