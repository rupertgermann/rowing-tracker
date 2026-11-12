import type { PoseLandmarkName, DerivedStrokePostureMetric, DerivedPostureFault } from '../src/lib/mocap/analysis';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePoseFrameStream, type PoseFrameStream } from '../src/lib/mocap/analysis';

const stream: PoseFrameStream = {
  fps: 30, capturePerspective: 'side-right',
  frames: Array.from({ length: 361 }, (_, i) => ({ timestampMs: i * 1000 / 30, keypoints: {
    rightHip: { x: .5, y: .5, confidence: 1 },
    rightKnee: { x: .6 + .15 * (1 - Math.cos(2 * Math.PI * i / 90)), y: .5, confidence: 1 },
    rightShoulder: { x: i === 99 ? .5 : .75, y: .25, confidence: 1 },
    rightElbow: { x: .7, y: .4, confidence: 1 },
    rightWrist: { x: .8, y: .5, confidence: 1 },
  } })),
};
const csvStrokes = [0, 3300, 6000, 9000].map((timeMs, strokeIndex) => ({ id: `csv-${strokeIndex}`, strokeIndex, timeMs }));

test('CSV windows replace offset pose catches and recompute metrics and faults; incomplete windows are omitted', () => {
  const pose = analyzePoseFrameStream(stream);
  const linked = analyzePoseFrameStream(stream, { csvStrokes });
  assert.equal(pose.metrics.length, 4);
  assert.equal(linked.metrics.length, 3);
  assert.equal(linked.metrics[1].phaseBoundariesJson.catchFrameIndex, 99);
  assert.equal(linked.metrics[1].phaseBoundariesJson.nextCatchFrameIndex, 180);
  assert.equal(linked.metrics[1].metricsJson.backAngleAtCatchDeg, 90);
  assert.equal(pose.metrics[1].metricsJson.backAngleAtCatchDeg, 45);
  assert.equal(linked.metrics[1].metricsJson.recoveryDriveRatio, 44 / 36);
  assert.equal(linked.metrics[1].strokeDataId, 'csv-1');
  assert.equal(linked.metrics[1].segmentationSource, 'csv-aligned');
  assert.notDeepEqual(linked.faults.filter(f => f.strokeIndex === 1), pose.faults.filter(f => f.strokeIndex === 1));
  assert.equal(analyzePoseFrameStream(stream, { csvStrokes: [] }).metrics.length, 0);
});

test('tracking loss remains unavailable without inventing angles or aborting CSV reanalysis', () => {
  const frames = structuredClone(stream.frames);
  const points = frames[99].keypoints as Record<string, { x: number; y: number; confidence: number }>;
  points.rightShoulder.confidence = 0;
  const result = analyzePoseFrameStream({ ...stream, frames }, { csvStrokes, calibration: { capturePerspective: 'side-right', catchFrame: stream.frames[0] } });
  assert.equal(result.metrics[1].metricsJson.backAngleAtCatchDeg, null);
  assert.deepEqual(result.metrics[1].metricsJson.catchReferenceDeltaDeg, { available: false, reason: 'insufficient-tracking' });
  assert.equal(result.faults.some(f => f.strokeIndex === 1 && f.faultType === 'rounded_back_at_catch'), false);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('linked service publishes CSV metrics with the link and preserves existing analysis when CSV is unusable', async () => {
  const { loadModule } = await import('./helpers/loadModule');
  const analysis = await import('../src/lib/mocap/analysis');
  const { encodeHeader, encodeFrame } = await import('../src/lib/mocap/poseFrameStream');
  const blob = Buffer.concat([encodeHeader({ fps: 30, frameCount: stream.frames.length }), ...stream.frames.map(frame => {
    const keypoints = new Float32Array(99);
    for (const [name, point] of Object.entries(frame.keypoints)) {
      const index = analysis.POSE_LANDMARK_INDEX[name as PoseLandmarkName];
      keypoints.set([point.x, point.y, point.confidence], index * 3);
    }
    return encodeFrame({ timestampMs: frame.timestampMs, keypoints, qualityFlags: 0 });
  })]);
  let csv = csvStrokes;
  let failWrite = false;
  let state = { status: "analyzing", link: null as string | null, metrics: [] as DerivedStrokePostureMetric[], faults: [] as DerivedPostureFault[] };
  const service = loadModule<typeof import('../src/lib/mocap/sessionAnalysis')>('src/lib/mocap/sessionAnalysis.ts', {
    '@/lib/mocap/analysis': analysis,
    '@/lib/db/prisma': { prisma: {
      userSettings: { findUnique: async () => null },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const pending = structuredClone(state);
        const publishedLink = state.link;
        const result = await fn({
          $queryRaw: async () => [{ id: 'rowing' }],
          strokeData: { findMany: async () => csv.map(c => ({ id: c.id, strokeIndex: c.strokeIndex, time: c.timeMs / 1000 })) },
          mocapSession: { updateMany: async ({ data }: { data: { rowingSessionId: string; status: string } }) => { pending.link = data.rowingSessionId; pending.status = data.status; return { count: 1 }; } },
          strokePostureMetric: { deleteMany: async () => { pending.metrics = []; }, createMany: async ({ data }: { data: typeof pending.metrics }) => { assert.equal(state.link, publishedLink); pending.metrics = data; if (failWrite) throw new Error("database write failed"); } },
          postureFault: { deleteMany: async () => { pending.faults = []; }, createMany: async ({ data }: { data: typeof pending.faults }) => { pending.faults = data; } },
        });
        state = pending;
        return result;
      },
    } },
  });
  const storage = { read: async () => blob, videoPath: () => '', poseStreamPath: () => '', appendBytes: async () => {}, writeAt: async () => {}, size: async () => blob.length, exists: async () => true, delete: async () => {} };
  const session = { id: 'capture', userId: 'user', poseStreamPath: 'pose', capturePerspective: 'side-right' };
  const summary = await service.analyzeAndPersistMocapSessionLinked(storage, session, 'rowing');
  assert.equal(summary.strokeMetricCount, 3);
  assert.equal(summary.faultCount, state.faults.length);
  assert.equal(state.link, 'rowing');
  assert.equal(state.status, 'ready');
  assert.equal(summary.status, 'ready');
  assert.equal(state.metrics[1].phaseBoundariesJson.catchFrameIndex, 99);
  assert.equal(state.metrics[1].metricsJson.backAngleAtCatchDeg, 90);
  const previous = structuredClone(state);
  failWrite = true;
  await assert.rejects(service.analyzeAndPersistMocapSessionLinked(storage, session, 'other'), /database write failed/);
  assert.equal(JSON.stringify(state), JSON.stringify(previous));
  csv = [];
  await assert.rejects(service.analyzeAndPersistMocapSessionLinked(storage, session, 'other'), /No complete CSV-aligned/);
  assert.equal(JSON.stringify(state), JSON.stringify(previous));
});

test('unmatched CSV gaps and untracked windows never receive CSV-derived metric rows', () => {
  assert.equal(analyzePoseFrameStream(stream, { csvStrokes: csvStrokes.map(c => ({ ...c, strokeIndex: c.strokeIndex * 2 })) }).metrics.length, 0);
  const frames = structuredClone(stream.frames).map(frame => ({ ...frame, keypoints: {} }));
  assert.equal(analyzePoseFrameStream({ ...stream, frames }, { csvStrokes }).metrics.length, 0);
});


test('CSV windows retain CSV stroke numbers on both metrics and faults when pose indexes differ', () => {
  const csv = csvStrokes.map(row => ({ ...row, strokeIndex: row.strokeIndex + 11 }));
  const result = analyzePoseFrameStream(stream, { csvStrokes: csv });
  assert.deepEqual(result.metrics.map(row => row.strokeIndex), [11, 12, 13]);
  for (const metric of result.metrics) {
    assert.equal(metric.strokeDataId, csv.find(row => row.strokeIndex === metric.strokeIndex)?.id);
  }
  assert.ok(result.faults.length > 0);
  assert.ok(result.faults.every(fault => [11, 12, 13].includes(fault.strokeIndex)));
  const baseline = analyzePoseFrameStream(stream, { csvStrokes });
  assert.deepEqual(result.faults, baseline.faults.map(fault => ({ ...fault, strokeIndex: fault.strokeIndex + 11 })));
});
