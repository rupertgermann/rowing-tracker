/**
 * Generates a synthetic v2 (sidecar-3d) PoseFrameStream blob for tests.
 * Run: node generate-v2-blob.mjs
 * Writes: v2-blob-3d.bin
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

const MAGIC = new Uint8Array([0x4d, 0x4f, 0x50, 0x53]);
const HEADER_SIZE = 32;
const FORMAT_VERSION = 1;
const KEYPOINT_SCHEMA_V2 = 2;
const KEYPOINTS_PER_FRAME_V2 = 33;
const BYTES_PER_FRAME_V2 = 4 + KEYPOINTS_PER_FRAME_V2 * 4 * 4 + 4;
const COORDINATE_SPACE_WORLD_MM_3D = 1;
const FPS = 30;
const FRAME_COUNT = 100;
const CAMERA_COUNT = 3;

// Build header
const header = new Uint8Array(HEADER_SIZE);
const hv = new DataView(header.buffer);
header.set(MAGIC, 0);
hv.setUint16(4, FORMAT_VERSION, true);
hv.setUint16(6, KEYPOINT_SCHEMA_V2, true);
hv.setFloat32(8, FPS, true);
hv.setUint16(12, KEYPOINTS_PER_FRAME_V2, true);
hv.setUint16(14, BYTES_PER_FRAME_V2, true);
hv.setUint32(16, FRAME_COUNT, true);
hv.setUint8(20, COORDINATE_SPACE_WORLD_MM_3D);
hv.setUint8(21, CAMERA_COUNT);

// Build 100 frames simulating one rowing stroke in world-mm-3d
// Rowing motion: catch at frame 0, finish at frame 35, recovery frames 36-99
const frames = new Uint8Array(FRAME_COUNT * BYTES_PER_FRAME_V2);

for (let f = 0; f < FRAME_COUNT; f++) {
  const offset = f * BYTES_PER_FRAME_V2;
  const fv = new DataView(frames.buffer, offset, BYTES_PER_FRAME_V2);
  const t = f / FPS;
  const phase = f < 35 ? f / 35 : (f - 35) / 65; // 0→1 in drive, 0→1 in recovery

  // timestampMs
  fv.setFloat32(0, 1700000000000 + t * 1000, true);

  // Write 33 keypoints as [x, y, z, confidence]
  for (let k = 0; k < KEYPOINTS_PER_FRAME_V2; k++) {
    const base = 4 + k * 16;
    // Approximate world-mm-3d positions (simplified rowing skeleton)
    const x = 50 + Math.sin(k * 0.5) * 200; // lateral position mm
    const y = 500 + Math.cos(k * 0.3) * 300 + phase * 100; // vertical mm
    const z = 1000 + Math.sin(f * 0.1 + k) * 50; // forward/back mm
    const conf = 0.8 + 0.15 * Math.sin(k + f * 0.05);
    fv.setFloat32(base, x, true);
    fv.setFloat32(base + 4, y, true);
    fv.setFloat32(base + 8, z, true);
    fv.setFloat32(base + 12, conf, true);
  }

  // qualityFlags
  fv.setUint32(BYTES_PER_FRAME_V2 - 4, 0, true);
}

const blob = new Uint8Array(HEADER_SIZE + FRAME_COUNT * BYTES_PER_FRAME_V2);
blob.set(header, 0);
blob.set(frames, HEADER_SIZE);

writeFileSync(join(__dir, "v2-blob-3d.bin"), blob);
console.log(`Written ${blob.byteLength} bytes → v2-blob-3d.bin`);
