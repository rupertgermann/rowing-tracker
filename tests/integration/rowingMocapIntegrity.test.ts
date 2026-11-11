import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadModule } from '../helpers/loadModule';
import * as analysis from '../../src/lib/mocap/analysis';
import { encodeHeader, encodeFrame } from '../../src/lib/mocap/poseFrameStream';
import type { MocapStorage } from '../../src/lib/mocap/storage';

const target = new URL(process.env.TEST_DATABASE_URL ?? '');
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/rowing_ticket123', 'only the disposable ticket database');
const pool = new Pool({ connectionString: target.href });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
after(async () => { await prisma.$disconnect(); await pool.end(); });
let userId = '';
const boundaries = { '@/lib/db/prisma': { prisma }, '@/lib/auth': { authOptions: {} }, 'next-auth': { getServerSession: async () => ({ user: { id: userId } }) } };
const settings = loadModule<typeof import('../../src/lib/server/userSettings')>('src/lib/server/userSettings.ts', boundaries);
const imports = { ...boundaries, '@/lib/server/userSettings': settings };
const routes = loadModule<typeof import('../../src/app/api/sessions/route')>('src/app/api/sessions/route.ts', imports);
const captureRoutes = loadModule<typeof import('../../src/app/api/mocap/sessions/[id]/route')>('src/app/api/mocap/sessions/[id]/route.ts', imports);
const service = loadModule<typeof import('../../src/lib/mocap/sessionAnalysis')>('src/lib/mocap/sessionAnalysis.ts', imports);
const lifecycleModule = loadModule<typeof import('../../src/lib/mocap/lifecyclePrisma')>('src/lib/mocap/lifecyclePrisma.ts', { ...imports, '@/lib/mocap/sessionAnalysis': service });
const frames = Array.from({ length: 361 }, (_, i) => {
  const keypoints = new Float32Array(99);
  for (const [name, x, y] of [['rightHip', .5, .5], ['rightKnee', .6 + .15 * (1 - Math.cos(2 * Math.PI * i / 90)), .5], ['rightShoulder', .75, .25], ['rightElbow', .7, .4], ['rightWrist', .8, .5]] as const) {
    keypoints.set([x, y, 1], analysis.POSE_LANDMARK_INDEX[name] * 3);
  }
  return encodeFrame({ timestampMs: i * 1000 / 30, keypoints, qualityFlags: 0 });
});
const blob = Buffer.concat([encodeHeader({ fps: 30, frameCount: frames.length }), ...frames]);
const storage: MocapStorage = { read: async () => blob, videoPath: () => '', poseStreamPath: () => '', appendBytes: async () => {}, writeAt: async () => {}, size: async () => blob.length, exists: async () => true, delete: async () => {} };
const lifecycle = lifecycleModule.createPrismaMocapSessionLifecycle({ storage });
const strokeData = [0, 3.3, 6, 9].map((time, strokeIndex) => ({ strokeIndex, time, timestamp: String(time), distance: time * 5, work: 100, power: 100, avgPower: 100, split: 120, avgSplit: 120, strokeRate: 20 }));
const input = { timestamp: '2026-01-01T12:00:00.000Z', distance: 60, duration: 12, strokeData };
const post = (sessions: unknown[]) => routes.POST(new Request('http://test/api/sessions', { method: 'POST', body: JSON.stringify({ sessions }) }));
const remove = (id: string) => routes.DELETE(new Request(`http://test/api/sessions?id=${id}`, { method: 'DELETE' }));
async function readCapture(id: string) {
  const response = await captureRoutes.GET(new Request('http://test'), { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  return (await response.json()).session;
}
async function readSessions() { return (await (await routes.GET(new Request('http://test/api/sessions'))).json()).sessions; }
async function fixture() {
  userId = (await prisma.user.create({ data: { email: `${crypto.randomUUID()}@example.invalid` } })).id;
  const saved = await post([input]);
  assert.equal(saved.status, 200);
  const row = (await saved.json()).sessions[0];
  const capture = await prisma.mocapSession.create({ data: { userId, status: 'ready', videoStoragePath: 'video', poseStreamPath: 'pose', source: 'browser', captureModelVersion: 'test', capturePerspective: 'side-right', captureFps: 30 } });
  assert.equal((await lifecycle.reanalyze(userId, capture.id)).ok, true);
  return { row, capture };
}

test('linked rowing data requires explicit unlink before replacement, clear, or deletion', async () => {
  const { row, capture } = await fixture();
  assert.equal((await lifecycle.link(userId, capture.id, row.id)).ok, true);
  const before = await readCapture(capture.id);
  const sessions = await readSessions();
  for (const mutate of [() => post([{ ...input, id: row.id }]), () => post([{ ...input, id: row.id, strokeData: [] }]), () => remove(row.id)]) {
    const response = await mutate();
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /unlink/i);
    assert.deepEqual(await readCapture(capture.id), before);
    assert.deepEqual(await readSessions(), sessions);
  }
  assert.equal((await lifecycle.unlink(userId, capture.id)).ok, true);
  assert.equal((await post([{ ...input, id: row.id, strokeData: [] }])).status, 200);
  assert.equal((await readSessions())[0].strokeData.length, 0);
  assert.equal((await readCapture(capture.id)).strokePostureMetrics.every((m: { segmentationSource: string }) => m.segmentationSource === 'pose-segmented'), true);
});

async function failWrites(table: string, run: () => Promise<void>) {
  await pool.query(`CREATE FUNCTION ticket123_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ticket123 injected write failure'; END $$`);
  await pool.query(`CREATE TRIGGER ticket123_fail BEFORE INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION ticket123_fail()`);
  try { await run(); } finally {
    await pool.query(`DROP TRIGGER ticket123_fail ON "${table}"`);
    await pool.query('DROP FUNCTION ticket123_fail()');
  }
}

test('failed writes roll back link, unlink, metrics and every rowing mutation', async () => {
  const { row, capture } = await fixture();
  const pose = await readCapture(capture.id);
  await failWrites('StrokePostureMetric', async () => {
    assert.equal((await lifecycle.link(userId, capture.id, row.id)).ok, false);
    const after = await readCapture(capture.id);
    assert.equal(after.rowingSessionId, null);
    assert.equal(after.status, 'ready');
    assert.deepEqual(after.strokePostureMetrics, pose.strokePostureMetrics);
    assert.deepEqual(after.postureFaults, pose.postureFaults);
  });
  assert.equal((await lifecycle.link(userId, capture.id, row.id)).ok, true);
  const linked = await readCapture(capture.id);
  await failWrites('StrokePostureMetric', async () => {
    assert.equal((await lifecycle.unlink(userId, capture.id)).ok, false);
    const after = await readCapture(capture.id);
    assert.equal(after.rowingSessionId, row.id);
    assert.equal(after.status, 'ready');
    assert.deepEqual(after.strokePostureMetrics, linked.strokePostureMetrics);
    assert.deepEqual(after.postureFaults, linked.postureFaults);
    assert.equal((await remove(row.id)).status, 409);
  });
  assert.equal((await lifecycle.unlink(userId, capture.id)).ok, true);
  const before = await readSessions();
  await failWrites('UserSettings', async () => {
    for (const mutate of [() => post([{ ...input, id: row.id }]), () => post([{ ...input, id: row.id, strokeData: [] }]), () => remove(row.id)]) {
      assert.equal((await mutate()).status, 500);
      assert.deepEqual(await readSessions(), before);
    }
  });
  assert.equal((await post([{ ...input, id: row.id }])).status, 200);
  assert.equal((await remove(row.id)).status, 200);
  assert.equal((await readSessions()).length, 0);
});

async function waitForBlocked(count: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await pool.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`);
    if (result.rows[0].count >= count) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Expected ${count} blocked database operations`);
}

test('concurrent link reads replacement strokes and cannot publish after clear or deletion', async () => {
  for (const mutation of ['replace', 'clear', 'delete']) {
    const { row, capture } = await fixture();
    const blocker = await pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM "RowingSession" WHERE id = $1 FOR UPDATE', [row.id]);
    const changed = mutation === 'delete' ? remove(row.id) : post([{ ...input, id: row.id, strokeData: mutation === 'clear' ? [] : strokeData.map(s => ({ ...s, time: s.strokeIndex === 1 ? 3.6 : s.time })) }]);
    let linked: ReturnType<typeof lifecycle.link> | undefined;
    try {
      await waitForBlocked(1);
      linked = lifecycle.link(userId, capture.id, row.id);
      await waitForBlocked(2);
    } finally { await blocker.query('COMMIT'); blocker.release(); }
    assert.equal((await changed).status, 200);
    const result = await linked!;
    const replay = await readCapture(capture.id);
    assert.equal(replay.status, 'ready');
    if (mutation === 'replace') {
      assert.equal(result.ok, true);
      assert.equal(replay.rowingSessionId, row.id);
      assert.equal(replay.strokePostureMetrics[1].phaseBoundariesJson.catchFrameIndex, 108);
      const ids = new Set((await readSessions())[0].strokeData.map((s: { id: string }) => s.id));
      assert.equal(replay.strokePostureMetrics.every((m: { strokeDataId: string }) => ids.has(m.strokeDataId)), true);
    } else {
      assert.equal(result.ok, false);
      assert.equal(replay.rowingSessionId, null);
      assert.equal(replay.strokePostureMetrics.every((m: { segmentationSource: string }) => m.segmentationSource === 'pose-segmented'), true);
    }
  }
});

test('link publication is atomic and blocks concurrent mutation; failed unlink keeps the guard active', async () => {
  const { row, capture } = await fixture();
  const pose = await readCapture(capture.id);
  const blocker = await pool.connect();
  await blocker.query('SELECT pg_advisory_lock(123123)');
  await pool.query(`CREATE FUNCTION ticket123_pause() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(123123); RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ticket123_pause BEFORE INSERT ON "StrokePostureMetric" FOR EACH ROW EXECUTE FUNCTION ticket123_pause()`);
  let link: ReturnType<typeof lifecycle.link> | undefined;
  let mutation: Promise<Response> | undefined;
  try {
    link = lifecycle.link(userId, capture.id, row.id);
    await waitForBlocked(1);
    const pending = await readCapture(capture.id);
    assert.equal(pending.rowingSessionId, null);
    assert.equal(pending.status, 'analyzing');
    assert.deepEqual(pending.strokePostureMetrics, pose.strokePostureMetrics);
    mutation = post([{ ...input, id: row.id, strokeData: [] }]);
    await waitForBlocked(2);
  } finally {
    await blocker.query('SELECT pg_advisory_unlock(123123)'); blocker.release();
  }
  try {
    assert.equal((await link!).ok, true);
    assert.equal((await mutation!).status, 409);
    const linked = await readCapture(capture.id);
    assert.equal(linked.rowingSessionId, row.id);
    assert.equal(linked.status, 'ready');
    assert.equal(linked.strokePostureMetrics.length, 3);
    assert.equal(linked.strokePostureMetrics.every((m: { segmentationSource: string }) => m.segmentationSource === 'csv-aligned'), true);
  } finally {
    await pool.query('DROP TRIGGER ticket123_pause ON "StrokePostureMetric"');
    await pool.query('DROP FUNCTION ticket123_pause()');
  }

  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const slow = lifecycleModule.createPrismaMocapSessionLifecycle({ storage: { ...storage, read: async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); throw new Error('storage unavailable'); } } });
  const unlink = slow.unlink(userId, capture.id);
  await waiting;
  try {
    for (const mutate of [() => post([{ ...input, id: row.id }]), () => post([{ ...input, id: row.id, strokeData: [] }]), () => remove(row.id)]) assert.equal((await mutate()).status, 409);
  } finally { release(); }
  assert.equal((await unlink).ok, false);
  assert.equal((await readCapture(capture.id)).rowingSessionId, row.id);
});
