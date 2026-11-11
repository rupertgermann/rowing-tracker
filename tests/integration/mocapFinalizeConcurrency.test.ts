import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadModule } from '../helpers/loadModule';
import { LocalDiskStorage } from '../../src/lib/mocap/storage';
import { encodeFrame, encodeHeader } from '../../src/lib/mocap/poseFrameStream';
import { adaptPoseFrameStreamBlob } from '../../src/lib/mocap/analysis/poseFrameStreamAdapter';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('record-only finalize excludes concurrent uploads and keeps a replayable pose blob', { timeout: 30_000 }, async () => {
  const target = new URL(process.env.TEST_DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.pathname, '/rowing_finalize_test', 'disposable finalize database only');
  const adminUrl = new URL(target);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.href });
  const pool = new Pool({ connectionString: target.href });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const root = await mkdtemp(path.join(tmpdir(), 'mocap-finalize-'));
  const storage = new LocalDiskStorage(root);
  let created = false;
  try {
    await admin.query('CREATE DATABASE rowing_finalize_test');
    created = true;
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', DATABASE_URL: target.href, DIRECT_URL: target.href }, stdio: 'pipe',
    });
    const user = await prisma.user.create({ data: { email: 'finalize@example.invalid' } });
    const boundaries = {
      '@/lib/db/prisma': { prisma },
      '@/lib/auth': { authOptions: {} },
      'next-auth': { getServerSession: async () => ({ user: { id: user.id } }) },
      '@/lib/rateLimit': { applyRateLimit: async () => null },
    };
    const settings = loadModule<typeof import('../../src/lib/server/userSettings')>('src/lib/server/userSettings.ts', boundaries);
    const imports = { ...boundaries, '@/lib/server/userSettings': settings };
    const analysis = loadModule<typeof import('../../src/lib/mocap/sessionAnalysis')>('src/lib/mocap/sessionAnalysis.ts', imports);
    const lifecycleModule = loadModule<typeof import('../../src/lib/mocap/lifecyclePrisma')>('src/lib/mocap/lifecyclePrisma.ts', { ...imports, '@/lib/mocap/sessionAnalysis': analysis });
    const lifecycle = lifecycleModule.createPrismaMocapSessionLifecycle({ storage });
    const upload = loadModule<typeof import('../../src/lib/mocap/captureUpload')>('src/lib/mocap/captureUpload.ts', { ...imports, './storage': { getMocapStorage: () => storage } });
    const pose = loadModule<typeof import('../../src/app/api/mocap/sessions/[id]/pose-stream/route')>('src/app/api/mocap/sessions/[id]/pose-stream/route.ts', { ...imports, '@/lib/mocap/captureUpload': upload, '@/lib/mocap/storage': { getMocapStorage: () => storage } });
    const finalize = loadModule<typeof import('../../src/app/api/mocap/sessions/[id]/finalize/route')>('src/app/api/mocap/sessions/[id]/finalize/route.ts', { ...imports, '@/lib/mocap/lifecyclePrisma': { getPrismaMocapSessionLifecycle: () => lifecycle } });
    const createCapture = () => prisma.mocapSession.create({ data: { userId: user.id, status: 'capturing', videoStoragePath: crypto.randomUUID(), poseStreamPath: crypto.randomUUID(), source: 'browser', captureModelVersion: 'test', capturePerspective: 'side-right', captureFps: 30 } });
    const capture = await createCapture();
    const params = { params: Promise.resolve({ id: capture.id }) };
    const frame = encodeFrame({ timestampMs: 0, keypoints: new Float32Array(99), qualityFlags: 0 });
    await storage.appendBytes(capture.poseStreamPath, encodeHeader({ fps: 30 }));
    const append = () => pose.POST(new Request('http://test/pose-stream', { method: 'POST', body: new Uint8Array(frame) }), params);
    const finish = () => finalize.POST(new Request('http://test/finalize', { method: 'POST', body: JSON.stringify({ durationSec: 1, skipAnalysis: true }) }), params);
    assert.equal((await append()).status, 200);
    const measured = gate();
    const resume = gate();
    const size = storage.size.bind(storage);
    let pause = true;
    storage.size = async file => {
      const bytes = await size(file);
      if (pause) {
        pause = false;
        measured.release();
        await resume.promise;
      }
      return bytes;
    };
    const finishing = finish();
    await measured.promise;
    let uploadResponse: Response;
    try {
      uploadResponse = await append();
      assert.equal((await finish()).status, 409, 'a second finalizer cannot claim the capture');
    } finally { resume.release(); }
    const response = await finishing;
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.analysisMode, 'record-only');
    assert.equal(result.frameCount, 1);
    const replay = await pose.GET(new Request('http://test/pose-stream'), params);
    const stream = adaptPoseFrameStreamBlob(new Uint8Array(await replay.arrayBuffer()), 'side-right');
    assert.equal(stream.frames.length, 1);
    assert.equal(uploadResponse.status, 409);

    const retryCapture = await createCapture();
    params.params = Promise.resolve({ id: retryCapture.id });
    await storage.appendBytes(retryCapture.poseStreamPath, encodeHeader({ fps: 30 }));
    assert.equal((await append()).status, 200);
    const writeAt = storage.writeAt.bind(storage);
    storage.writeAt = async () => { throw new Error('temporary storage failure'); };
    assert.equal((await finish()).status, 500);
    storage.writeAt = writeAt;
    assert.equal((await append()).status, 200, 'failed finalization restores capturing');
    const retried = await finish();
    assert.equal(retried.status, 200);
    assert.equal((await retried.json()).frameCount, 2);
    const retryReplay = await pose.GET(new Request('http://test/pose-stream'), params);
    assert.equal(adaptPoseFrameStreamBlob(new Uint8Array(await retryReplay.arrayBuffer()), 'side-right').frames.length, 2);

    const recordOnly = await createCapture();
    params.params = Promise.resolve({ id: recordOnly.id });
    const withoutPose = await finish();
    assert.equal(withoutPose.status, 200);
    const empty = await withoutPose.json();
    assert.equal(empty.status, 'ready');
    assert.equal(empty.analysisMode, 'record-only');
    assert.equal(empty.frameCount, 0);
    assert.equal(empty.strokeMetricCount, 0);
    assert.equal((await append()).status, 409);

  } finally {
    await prisma.$disconnect();
    await pool.end();
    if (created) await admin.query('DROP DATABASE rowing_finalize_test');
    await admin.end();
    await rm(root, { recursive: true, force: true });
  }
});
