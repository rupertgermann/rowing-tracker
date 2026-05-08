import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BYTES_PER_FRAME_V1,
  HEADER_SIZE,
  KEYPOINTS_PER_FRAME_V1,
  OPEN_FRAME_COUNT,
  PoseStreamFormatError,
  QUALITY_FLAG,
  encodeFrame,
  encodeHeader,
  type PoseFrame,
} from "../src/lib/mocap/poseFrameStream";
import {
  adaptPoseFrameStreamBlob,
  adaptPoseFrameStreamBytes,
} from "../src/lib/mocap/analysis/poseFrameStreamAdapter";
import type { PosePoint } from "../src/lib/mocap/analysis/types";

test("adapts a full binary PoseFrameStream blob to the analysis stream shape", () => {
  const frames = [
    makeFrame(0, 100, QUALITY_FLAG.LOW_CONFIDENCE),
    makeFrame(1, 133.333, QUALITY_FLAG.CAMERA_MOTION),
  ];
  const blob = buildBlob(29.97, frames);

  const stream = adaptPoseFrameStreamBlob(blob, "side-left");

  assert.equal(stream.fps, Math.fround(29.97));
  assert.equal(stream.capturePerspective, "side-left");
  assert.equal(stream.frames.length, 2);
  assert.equal(stream.frames[0]?.timestampMs, Math.fround(100));
  assert.equal(stream.frames[0]?.qualityFlags, QUALITY_FLAG.LOW_CONFIDENCE);
  assertFrameKeypoints(stream.frames[0]?.keypoints, frames[0].keypoints);
  assert.equal(stream.frames[1]?.timestampMs, Math.fround(133.333));
  assert.equal(stream.frames[1]?.qualityFlags, QUALITY_FLAG.CAMERA_MOTION);
  assertFrameKeypoints(stream.frames[1]?.keypoints, frames[1].keypoints);
});

test("adapts split header bytes and packed frame bytes with open frame count", () => {
  const frames = [makeFrame(3, 0, 0), makeFrame(4, 33.333, 7)];
  const header = encodeHeader({ fps: 60, frameCount: OPEN_FRAME_COUNT });
  const packedFrames = concat(frames.map(encodeFrame));

  const stream = adaptPoseFrameStreamBytes(header, packedFrames, "side-right");

  assert.equal(stream.fps, 60);
  assert.equal(stream.capturePerspective, "side-right");
  assert.equal(stream.frames.length, frames.length);
  assert.equal(stream.frames[1]?.timestampMs, Math.fround(33.333));
  assertFrameKeypoints(stream.frames[1]?.keypoints, frames[1].keypoints);
});

test("rejects unknown schema through the existing binary header decoder", () => {
  const header = encodeHeader({ fps: 30, frameCount: 0 });
  header[6] = 99;

  assert.throws(
    () => adaptPoseFrameStreamBytes(header, new Uint8Array(), "side-left"),
    PoseStreamFormatError,
  );
});

test("rejects packed frames with trailing partial frame bytes", () => {
  const header = encodeHeader({ fps: 30, frameCount: OPEN_FRAME_COUNT });
  const packedFrames = new Uint8Array(BYTES_PER_FRAME_V1 + 1);

  assert.throws(
    () => adaptPoseFrameStreamBytes(header, packedFrames, "sidecar-3d"),
    /not a multiple of frame size/,
  );
});

function makeFrame(seed: number, timestampMs: number, qualityFlags: number): PoseFrame {
  const keypoints = new Float32Array(KEYPOINTS_PER_FRAME_V1 * 3);
  for (let i = 0; i < KEYPOINTS_PER_FRAME_V1; i++) {
    keypoints[i * 3] = Math.fround(seed + i / 10);
    keypoints[i * 3 + 1] = Math.fround(seed + i / 20);
    keypoints[i * 3 + 2] = Math.fround((i % 10) / 10);
  }
  return { timestampMs, keypoints, qualityFlags };
}

function buildBlob(fps: number, frames: PoseFrame[]): Uint8Array {
  const blob = new Uint8Array(HEADER_SIZE + frames.length * BYTES_PER_FRAME_V1);
  blob.set(encodeHeader({ fps, frameCount: frames.length }), 0);
  blob.set(concat(frames.map(encodeFrame)), HEADER_SIZE);
  return blob;
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

function assertFrameKeypoints(
  actual: unknown,
  expected: Float32Array,
): asserts actual is readonly PosePoint[] {
  assert.ok(Array.isArray(actual));
  assert.equal(actual.length, KEYPOINTS_PER_FRAME_V1);
  for (let i = 0; i < KEYPOINTS_PER_FRAME_V1; i++) {
    assert.equal(actual[i]?.x, expected[i * 3]);
    assert.equal(actual[i]?.y, expected[i * 3 + 1]);
    assert.equal(actual[i]?.confidence, expected[i * 3 + 2]);
  }
}
