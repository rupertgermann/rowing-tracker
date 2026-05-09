/**
 * Tests for issue #30: sidecar tracer — v2 blob format, coordinate adapter, fault stubs.
 *
 * Run with: npx tsx --test tests/sidecarTracer.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import {
  BYTES_PER_FRAME_V2,
  HEADER_SIZE,
  KEYPOINT_SCHEMA_V1,
  KEYPOINT_SCHEMA_V2,
  KEYPOINTS_PER_FRAME_V2,
  PoseStreamFormatError,
  decodeFrame,
  decodeHeader,
  encodeFrame,
  encodeFrameV2,
  encodeHeader,
  framesFromBlobSize,
  type PoseFrame,
} from "../src/lib/mocap/poseFrameStream";
import {
  adaptPoseFrameStreamBlob,
  keypointQuadsToPosePoints,
} from "../src/lib/mocap/analysis/poseFrameStreamAdapter";
import { PostureFaultDetector } from "../src/lib/mocap/analysis/postureFaultDetector";
import type { PostureMetrics, Sidecar3DMetrics } from "../src/lib/mocap/analysis/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeV2Frame(seed: number): PoseFrame {
  const kp = new Float32Array(KEYPOINTS_PER_FRAME_V2 * 4);
  for (let i = 0; i < kp.length; i++) {
    kp[i] = Math.fround(100 + Math.sin((seed + i) * 0.1) * 500);
  }
  return { timestampMs: Math.fround(seed * 33.3), keypoints: kp, qualityFlags: 0 };
}

// ---------------------------------------------------------------------------
// v2 blob codec
// ---------------------------------------------------------------------------

test("v2 header encodes coordinateSpace=world-mm-3d and cameraCount", () => {
  const hdr = encodeHeader({
    fps: 30,
    keypointSchemaVersion: KEYPOINT_SCHEMA_V2,
    coordinateSpace: "world-mm-3d",
    cameraCount: 3,
  });
  assert.equal(hdr.byteLength, HEADER_SIZE);
  const parsed = decodeHeader(hdr);
  assert.equal(parsed.keypointSchemaVersion, KEYPOINT_SCHEMA_V2);
  assert.equal(parsed.coordinateSpace, "world-mm-3d");
  assert.equal(parsed.cameraCount, 3);
  assert.equal(parsed.fps, 30);
});

test("v2 header defaults coordinateSpace=normalized-2d for v1 blobs", () => {
  const hdr = encodeHeader({ fps: 30 });
  const parsed = decodeHeader(hdr);
  assert.equal(parsed.keypointSchemaVersion, KEYPOINT_SCHEMA_V1);
  assert.equal(parsed.coordinateSpace, "normalized-2d");
  assert.equal(parsed.cameraCount, 1);
});

test("v2 frame encode/decode round-trips without data loss", () => {
  const frame = makeV2Frame(42);
  const encoded = encodeFrameV2(frame);
  assert.equal(encoded.byteLength, BYTES_PER_FRAME_V2);
  const decoded = decodeFrame(encoded, 0, KEYPOINT_SCHEMA_V2);
  assert.equal(decoded.timestampMs, frame.timestampMs);
  assert.equal(decoded.keypoints.length, frame.keypoints.length);
  for (let i = 0; i < frame.keypoints.length; i++) {
    assert.equal(decoded.keypoints[i], frame.keypoints[i]);
  }
});

test("framesFromBlobSize works for v2 frame size", () => {
  const blobSize = HEADER_SIZE + 5 * BYTES_PER_FRAME_V2;
  assert.equal(framesFromBlobSize(blobSize, KEYPOINT_SCHEMA_V2), 5);
});

test("decodeHeader rejects unknown keypointSchemaVersion", () => {
  const hdr = encodeHeader({ fps: 30 });
  const view = new DataView(hdr.buffer);
  view.setUint16(6, 99, true); // unknown schema
  assert.throws(() => decodeHeader(hdr), PoseStreamFormatError);
});

// ---------------------------------------------------------------------------
// v2 fixture blob
// ---------------------------------------------------------------------------

test("v2 fixture blob round-trips: header + 100 frames", () => {
  const blobPath = join(__dirname, "../src/lib/mocap/__tests__/fixtures/v2-blob-3d.bin");
  const buf = readFileSync(blobPath);
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const header = decodeHeader(bytes.subarray(0, HEADER_SIZE));
  assert.equal(header.keypointSchemaVersion, KEYPOINT_SCHEMA_V2);
  assert.equal(header.coordinateSpace, "world-mm-3d");
  assert.equal(header.cameraCount, 3);
  assert.equal(header.frameCount, 100);
  assert.equal(framesFromBlobSize(bytes.byteLength, KEYPOINT_SCHEMA_V2), 100);
});

test("adaptPoseFrameStreamBlob produces PoseFrameStream with z from v2 fixture", () => {
  const blobPath = join(__dirname, "../src/lib/mocap/__tests__/fixtures/v2-blob-3d.bin");
  const buf = readFileSync(blobPath);
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const stream = adaptPoseFrameStreamBlob(bytes, "sidecar-3d");
  assert.equal(stream.coordinateSpace, "world-mm-3d");
  assert.equal(stream.cameraCount, 3);
  assert.equal(stream.frames.length, 100);
  const frame0 = stream.frames[0]!;
  const kps = Array.isArray(frame0.keypoints) ? frame0.keypoints : Object.values(frame0.keypoints);
  assert.ok(kps.length > 0, "frame should have keypoints");
  const kp0 = kps[0]!;
  assert.ok("z" in kp0 && kp0.z !== undefined, "v2 keypoints must carry z");
});

// ---------------------------------------------------------------------------
// coordinateSpace adapter: toNormalizedProjection via adapter
// ---------------------------------------------------------------------------

test("keypointQuadsToPosePoints produces z field", () => {
  const quads = new Float32Array([10, 20, 30, 0.9]);
  const pts = keypointQuadsToPosePoints(quads);
  assert.equal(pts.length, 1);
  assert.equal(pts[0]!.x, Math.fround(10));
  assert.equal(pts[0]!.y, Math.fround(20));
  assert.equal(pts[0]!.z, Math.fround(30));
  assert.ok(Math.abs(pts[0]!.confidence - 0.9) < 1e-6, "confidence ~0.9");
});

// ---------------------------------------------------------------------------
// v1 blobs still readable unchanged (no regression)
// ---------------------------------------------------------------------------

test("v1 blob still decodes as normalized-2d, z=undefined", () => {
  const hdr = encodeHeader({ fps: 30, keypointSchemaVersion: KEYPOINT_SCHEMA_V1 });
  const hdrParsed = decodeHeader(hdr);
  assert.equal(hdrParsed.keypointSchemaVersion, KEYPOINT_SCHEMA_V1);
  assert.equal(hdrParsed.coordinateSpace, "normalized-2d");

  const v1Kp = new Float32Array(33 * 3);
  for (let i = 0; i < v1Kp.length; i++) v1Kp[i] = Math.fround(i * 0.01);
  const v1Frame = encodeFrame({ timestampMs: 0, keypoints: v1Kp, qualityFlags: 0 });
  const decoded = decodeFrame(v1Frame, 0, KEYPOINT_SCHEMA_V1);
  assert.equal(decoded.keypoints.length, 33 * 3);
});

// ---------------------------------------------------------------------------
// Sidecar-3D fault stubs — return "pending" severity, never null
// ---------------------------------------------------------------------------

function makeMockMetrics(sidecar3D: Sidecar3DMetrics): PostureMetrics {
  return {
    strokeIndex: 0,
    segmentationSource: "pose-segmented",
    backAngleAtCatchDeg: 60,
    backAngleAtFinishDeg: 50,
    laybackAngleDeg: 15,
    hipKneeOpeningOffsetFrames: 2,
    armBendOnsetFrameIndex: 20,
    legExtensionCompleteFrameIndex: 18,
    armBendBeforeLegsCompleteFrames: -2,
    recoveryDriveRatio: 1.5,
    leftRightAsymmetry: { available: false, reason: "insufficient-tracking" },
    shinVerticalAtCatchDeg: { available: false, reason: "insufficient-tracking" },
    kneeTrackDeviation: { available: false, reason: "insufficient-tracking" },
    sidecar3D,
  };
}

test("fault detector emits pending left_right_asymmetry when lateralShoulderSymmetryMm present", () => {
  const metrics = makeMockMetrics({ lateralShoulderSymmetryMm: 45 });
  const faults = PostureFaultDetector(metrics);
  const asymmetry = faults.find((f) => f.faultType === "left_right_asymmetry");
  assert.ok(asymmetry, "should emit left_right_asymmetry fault");
  assert.equal(asymmetry.severity, "pending");
  assert.equal(asymmetry.evidence.value, 45);
});

test("fault detector emits pending knee_track_deviation when knee metrics present", () => {
  const metrics = makeMockMetrics({
    leftKneeTrackDeviationMm: 30,
    rightKneeTrackDeviationMm: 20,
  });
  const faults = PostureFaultDetector(metrics);
  const knee = faults.find((f) => f.faultType === "knee_track_deviation");
  assert.ok(knee, "should emit knee_track_deviation fault");
  assert.equal(knee.severity, "pending");
  assert.equal(knee.evidence.value, 30); // max of left/right
});

test("fault detector emits pending shin_not_vertical_at_catch when nearShinAngleDeg present", () => {
  const metrics = makeMockMetrics({ nearShinAngleDeg: 12 });
  const faults = PostureFaultDetector(metrics);
  const shin = faults.find((f) => f.faultType === "shin_not_vertical_at_catch");
  assert.ok(shin, "should emit shin_not_vertical_at_catch fault");
  assert.equal(shin.severity, "pending");
});

test("fault detector emits no sidecar faults when sidecar3D is undefined", () => {
  const metrics = makeMockMetrics({});
  metrics.sidecar3D = undefined;
  const faults = PostureFaultDetector(metrics);
  const sidecarFaults = faults.filter((f) =>
    ["left_right_asymmetry", "knee_track_deviation", "shin_not_vertical_at_catch"].includes(
      f.faultType,
    ),
  );
  assert.equal(sidecarFaults.length, 0);
});
