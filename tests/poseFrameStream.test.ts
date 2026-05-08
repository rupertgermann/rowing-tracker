/**
 * Unit tests for the PoseFrameStream binary codec.
 *
 * Run with: npx tsx --test tests/poseFrameStream.test.ts
 *
 * Covers issue #9 acceptance: pose stream blob round-trips (random access by
 * frame index = byte-range read at frameByteOffset(i)) and reader rejects
 * unknown keypointSchemaVersion explicitly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BYTES_PER_FRAME_V1,
  HEADER_SIZE,
  KEYPOINTS_PER_FRAME_V1,
  PoseStreamFormatError,
  QUALITY_FLAG,
  decodeFrame,
  decodeHeader,
  encodeFrame,
  encodeHeader,
  frameByteOffset,
  framesFromBlobSize,
  type PoseFrame,
} from "../src/lib/mocap/poseFrameStream";

function makeFrame(seed: number, qualityFlags = 0): PoseFrame {
  const kp = new Float32Array(KEYPOINTS_PER_FRAME_V1 * 3);
  for (let i = 0; i < kp.length; i++) {
    kp[i] = Math.fround(Math.sin((seed + i) * 0.1));
  }
  return {
    timestampMs: seed * 33.333,
    keypoints: kp,
    qualityFlags,
  };
}

function buildBlob(fps: number, frames: PoseFrame[]): Uint8Array {
  const header = encodeHeader({ fps, frameCount: frames.length });
  const buf = new Uint8Array(HEADER_SIZE + frames.length * BYTES_PER_FRAME_V1);
  buf.set(header, 0);
  for (let i = 0; i < frames.length; i++) {
    buf.set(encodeFrame(frames[i]), HEADER_SIZE + i * BYTES_PER_FRAME_V1);
  }
  return buf;
}

test("header round-trips fps + frameCount + schema version", () => {
  const buf = encodeHeader({ fps: 30, frameCount: 1234 });
  const h = decodeHeader(buf);
  assert.equal(h.fps, 30);
  assert.equal(h.frameCount, 1234);
  assert.equal(h.keypointsPerFrame, KEYPOINTS_PER_FRAME_V1);
  assert.equal(h.bytesPerFrame, BYTES_PER_FRAME_V1);
});

test("frame round-trips bit-exact", () => {
  const f = makeFrame(7, QUALITY_FLAG.LOW_CONFIDENCE | QUALITY_FLAG.LOW_LIGHT);
  const bytes = encodeFrame(f);
  assert.equal(bytes.byteLength, BYTES_PER_FRAME_V1);
  const decoded = decodeFrame(bytes);
  assert.equal(decoded.timestampMs, Math.fround(f.timestampMs));
  assert.equal(decoded.qualityFlags, f.qualityFlags);
  for (let i = 0; i < f.keypoints.length; i++) {
    assert.equal(decoded.keypoints[i], f.keypoints[i]);
  }
});

test("byte-range read by frame index returns identical frame data", () => {
  const N = 50;
  const frames = Array.from({ length: N }, (_, i) => makeFrame(i));
  const blob = buildBlob(24, frames);

  for (const idx of [0, 1, 17, N - 1]) {
    const start = frameByteOffset(idx);
    const slice = blob.subarray(start, start + BYTES_PER_FRAME_V1);
    const decoded = decodeFrame(slice);
    const expected = frames[idx];
    assert.equal(decoded.timestampMs, Math.fround(expected.timestampMs));
    for (let i = 0; i < expected.keypoints.length; i++) {
      assert.equal(decoded.keypoints[i], expected.keypoints[i]);
    }
  }
});

test("framesFromBlobSize derives count from open-ended blob", () => {
  const frames = Array.from({ length: 7 }, (_, i) => makeFrame(i));
  const blob = buildBlob(30, frames);
  assert.equal(framesFromBlobSize(blob.byteLength), 7);
  assert.equal(framesFromBlobSize(HEADER_SIZE), 0);
  assert.equal(framesFromBlobSize(0), 0);
});

test("reader rejects unknown keypointSchemaVersion", () => {
  const buf = encodeHeader({ fps: 30, frameCount: 0 });
  // Corrupt schema version field (bytes 6-7 LE)
  buf[6] = 99;
  buf[7] = 0;
  assert.throws(() => decodeHeader(buf), PoseStreamFormatError);
});

test("reader rejects bad magic bytes", () => {
  const buf = encodeHeader({ fps: 30, frameCount: 0 });
  buf[0] = 0x00;
  assert.throws(() => decodeHeader(buf), PoseStreamFormatError);
});

test("encodeFrame rejects wrong-length keypoint array", () => {
  const bad: PoseFrame = {
    timestampMs: 0,
    keypoints: new Float32Array(10),
    qualityFlags: 0,
  };
  assert.throws(() => encodeFrame(bad), PoseStreamFormatError);
});
