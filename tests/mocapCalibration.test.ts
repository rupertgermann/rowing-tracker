import { test } from "node:test";
import assert from "node:assert/strict";
import * as analysis from "../src/lib/mocap/analysis";
import { encodeFrame, encodeHeader } from "../src/lib/mocap/poseFrameStream";
import { loadModule } from "./helpers/loadModule";

function frame(index: number, vertical = false, confidence = 1): analysis.PoseAnalysisFrame {
  const keypoints = Array.from({ length: 33 }, () => ({ x: 0, y: 0, confidence: 0 }));
  for (const side of [0, 1]) {
    keypoints[11 + side] = { x: vertical ? 0.5 : 0.75, y: 0.25, confidence };
    keypoints[13 + side] = { x: 0.7, y: 0.4, confidence: 1 };
    keypoints[15 + side] = { x: 0.8, y: 0.5, confidence: 1 };
    keypoints[23 + side] = { x: 0.5, y: 0.5, confidence: 1 };
    keypoints[25 + side] = { x: 0.5 + 0.1 + 0.15 * (1 - Math.cos(2 * Math.PI * index / 90)), y: 0.5, confidence: 1 };
  }
  return { timestampMs: index * 1000 / 30, keypoints };
}
const frames = Array.from({ length: 181 }, (_, index) => frame(index));
function packed(f: analysis.PoseAnalysisFrame) {
  return encodeFrame({ timestampMs: f.timestampMs, qualityFlags: 0, keypoints: new Float32Array((f.keypoints as analysis.PosePoint[]).flatMap(p => [p.x, p.y, p.confidence])) });
}
const blob = Buffer.concat([encodeHeader({ fps: 30, frameCount: frames.length }), ...frames.map(packed)]);
const stored = (f: analysis.PoseAnalysisFrame) => ({ capturePerspective: "side-right", poseFrameBase64: Buffer.from(packed(f)).toString("base64") });

test("persisted analysis reports catch/finish reference deltas for standalone and linked sessions", async () => {
  const rows: Array<{ metricsJson: Record<string, unknown> }> = [];
  const tx = { $queryRaw: async () => [{ id: "rowing" }], strokeData: { findMany: async () => [0, 3, 6].map((time, strokeIndex) => ({ id: `csv-${strokeIndex}`, time, strokeIndex })) }, mocapSession: { updateMany: async () => ({ count: 1 }) }, postureFault: { deleteMany: async () => {}, createMany: async () => {} }, strokePostureMetric: { deleteMany: async () => { rows.length = 0; }, createMany: async ({ data }: { data: typeof rows }) => rows.push(...data) } };
  const service = loadModule<typeof import("../src/lib/mocap/sessionAnalysis")>("src/lib/mocap/sessionAnalysis.ts", {
    "@/lib/db/prisma": { prisma: { userSettings: { findUnique: async () => null }, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } },
    "@/lib/mocap/analysis": analysis,
  });
  const session = { id: "capture", userId: "rower", poseStreamPath: "pose", capturePerspective: "side-right", calibrationCatchFrame: stored(frame(0)), calibrationFinishFrame: stored(frame(0, true)) };
  const storage = { read: async () => blob, videoPath: () => "video", poseStreamPath: () => "pose", appendBytes: async () => {}, writeAt: async () => {}, size: async () => blob.length, exists: async () => true, delete: async () => {} };
  for (const linked of [false, true]) {
    const result = linked ? await service.analyzeAndPersistMocapSessionLinked(storage, session, "rowing") : await service.analyzeAndPersistMocapSession(storage, session);
    assert.equal(result.strokeMetricCount, 2);
    for (const { metricsJson: m } of rows) {
      assert.deepEqual(m.catchReferenceDeltaDeg, { available: true, value: 0 });
      assert.deepEqual(m.finishReferenceDeltaDeg, { available: true, value: -45 });
      assert.equal(m.backAngleAtCatchDeg, 45);
    }
  }
});

test("live completed strokes expose calibration comparisons, including unavailable references", async () => {
  const { LiveCoachingEngine } = await import("../src/lib/mocap/coaching/liveCoachingEngine");
  for (const perspective of ["side-left", "side-right"] as const) {
    for (const reference of [undefined, frame(0, false, 0.1), frame(0, true)]) {
      const metrics: analysis.PostureMetrics[] = [];
      const engine = new LiveCoachingEngine({ fps: 30, capturePerspective: perspective, calibration: { capturePerspective: perspective, catchFrame: frame(0), finishFrame: reference }, segmenterIntervalMs: Infinity, trailingFrameMargin: 0, onCue: () => {}, onMetrics: (m) => metrics.push(m) });
      frames.forEach(f => engine.pushFrame(f));
      engine.flush();
      assert.equal(metrics.length, 2);
      for (const m of metrics) {
        assert.deepEqual(m.catchReferenceDeltaDeg, { available: true, value: 0 });
        assert.deepEqual(m.finishReferenceDeltaDeg, reference === undefined ? { available: false, reason: "missing-calibration" } : analysis.getPosePoint(reference, "rightShoulder")!.confidence < 0.25 ? { available: false, reason: "unusable-calibration" } : { available: true, value: -45 });
      }
    }
  }
});

test("unusable calibration never changes absolute measurements or fault severity", () => {
  const stream: analysis.PoseFrameStream = { fps: 30, capturePerspective: "side-right", frames };
  const original = JSON.stringify(stream);
  const baseline = analysis.analyzePoseFrameStream(stream);
  const invalid = frame(0);
  (invalid.keypoints as analysis.PosePoint[])[12].x = NaN;
  const coincident = frame(0);
  (coincident.keypoints as analysis.PosePoint[])[12] = { x: 0.5, y: 0.5, confidence: 1 };
  for (const reference of [frame(0), frame(0, true), frame(0, false, 0.1), invalid, coincident]) {
    const result = analysis.analyzePoseFrameStream(stream, { calibration: { capturePerspective: "side-right", catchFrame: reference } });
    assert.deepEqual(result.faults, baseline.faults);
    assert.deepEqual(result.metrics.map(m => m.metricsJson.backAngleAtCatchDeg), [45, 45]);
    if ([invalid, coincident].includes(reference)) assert.deepEqual(result.metrics[0].metricsJson.catchReferenceDeltaDeg, { available: false, reason: "unusable-calibration" });
  }
  const mismatched = analysis.analyzePoseFrameStream(stream, { calibration: { capturePerspective: "side-left", catchFrame: frame(0) } });
  assert.deepEqual(mismatched.metrics[0].metricsJson.catchReferenceDeltaDeg, { available: false, reason: "unusable-calibration" });
  const sidecar = analysis.analyzePoseFrameStream({ ...stream, capturePerspective: "sidecar-3d" }, { calibration: { capturePerspective: "side-right", catchFrame: frame(0) } });
  assert.deepEqual(sidecar.metrics[0].metricsJson.catchReferenceDeltaDeg, { available: false, reason: "browser-calibration-only" });
  assert.equal(JSON.stringify(stream), original);
});
