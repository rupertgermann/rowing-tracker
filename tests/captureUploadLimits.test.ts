import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadModule } from './helpers/loadModule';
import { LocalDiskStorage } from '../src/lib/mocap/storage';

async function setup(kind: 'video' | 'pose-stream' = 'video') {
  const root = await mkdtemp(join(tmpdir(), 'capture-limits-'));
  const storage = new LocalDiskStorage(root);
  const row = { id: 'recording', userId: 'owner', status: 'capturing', videoStoragePath: 'video', poseStreamPath: 'pose', captureFps: 30 };
  const db = { mocapSession: { findFirst: async () => row }, $queryRaw: async () => [row] };
  const prisma = { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) };
  const upload = loadModule('src/lib/mocap/captureUpload.ts', {
    '@/lib/db/prisma': { prisma }, './storage': { getMocapStorage: () => storage },
  });
  const api = loadModule<{ POST(req: Request, ctx: unknown): Promise<Response>; GET(req: Request, ctx: unknown): Promise<Response> }>(`src/app/api/mocap/sessions/[id]/${kind}/route.ts`, {
    'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/db/prisma': { prisma },
    '@/lib/mocap/captureUpload': upload,
    '@/lib/mocap/storage': { getMocapStorage: () => storage },
  });
  return { root, storage, row, get: (req: Request) => api.GET(req, { params: Promise.resolve({ id: row.id }) }), post: (req: Request) => api.POST(req, { params: Promise.resolve({ id: row.id }) }), cleanup: () => rm(root, { recursive: true, force: true }) };
}
const request = (body: BodyInit) => new Request('http://local/upload', { method: 'POST', body });

test('video upload rejects oversized request without altering previous video', async () => {
  const api = await setup();
  try {
    await api.storage.appendBytes('video', new Uint8Array([1, 2]));
    assert.equal((await api.post(request(new Uint8Array(8 * 1024 * 1024 + 1)))).status, 413);
    assert.deepEqual(await api.storage.read('video'), new Uint8Array([1, 2]));
  } finally { await api.cleanup(); }
});

test('pose upload rejects malformed frames and preserves the readable header', async () => {
  const api = await setup('pose-stream');
  try {
    const { encodeHeader, BYTES_PER_FRAME_V1 } = await import('../src/lib/mocap/poseFrameStream');
    const header = encodeHeader({ fps: 30 });
    await api.storage.appendBytes('pose', header);
    assert.equal((await api.post(request(new Uint8Array(3)))).status, 400);
    const invalid = new Uint8Array(BYTES_PER_FRAME_V1);
    new DataView(invalid.buffer).setFloat32(4, NaN, true);
    assert.equal((await api.post(request(invalid))).status, 400);
    assert.deepEqual(await api.storage.read('pose'), header);
    assert.equal((await api.post(request(new Uint8Array(BYTES_PER_FRAME_V1)))).status, 200);
  } finally { await api.cleanup(); }
});

test('recording quotas count already persisted bytes across separate uploads', async () => {
  const api = await setup();
  try {
    const { truncate } = await import('node:fs/promises');
    await api.storage.appendBytes('video', new Uint8Array([1]));
    // Sparse file exercises the real metadata boundary without allocating a 10 GiB buffer.
    await truncate(join(api.root, 'video'), 10 * 1024 ** 3 - 1);
    assert.equal((await api.post(request(new Uint8Array([2])))).status, 200);
    assert.equal((await api.post(request(new Uint8Array([3])))).status, 413);
    assert.equal(await api.storage.size('video'), 10 * 1024 ** 3);
  } finally { await api.cleanup(); }
});

test('interrupted video body leaves stored bytes unchanged', async () => {
  const api = await setup();
  try {
    await api.storage.appendBytes('video', Uint8Array.of(4));
    const body = new ReadableStream({ start(c) { c.enqueue(Uint8Array.of(5)); c.error(new Error('disconnected')); } });
    const response = await api.post(new Request('http://local/upload', { method: 'POST', body, duplex: 'half' } as RequestInit));
    assert.equal(response.status, 400);
    assert.deepEqual(await api.storage.read('video'), Uint8Array.of(4));
  } finally { await api.cleanup(); }
});

test('pose quota enforces both absolute size and capture duration before append', async () => {
  const api = await setup('pose-stream');
  try {
    const { encodeHeader, BYTES_PER_FRAME_V1 } = await import('../src/lib/mocap/poseFrameStream');
    const { truncate } = await import('node:fs/promises');
    await api.storage.appendBytes('pose', encodeHeader({ fps: 240 }));
    await truncate(join(api.root, 'pose'), 256 * 1024 ** 2);
    assert.equal((await api.post(request(new Uint8Array(BYTES_PER_FRAME_V1)))).status, 413);
    await api.storage.delete('pose');
    await api.storage.appendBytes('pose', encodeHeader({ fps: 1 }));
    await truncate(join(api.root, 'pose'), 32 + 28800 * BYTES_PER_FRAME_V1);
    assert.equal((await api.post(request(new Uint8Array(BYTES_PER_FRAME_V1)))).status, 413);
  } finally { await api.cleanup(); }
});

test('video replay streams bounded ranges and supports cancellation', async () => {
  const api = await setup();
  try {
    const { truncate } = await import('node:fs/promises');
    await api.storage.appendBytes('video', Uint8Array.of(1, 2, 3, 4));
    await truncate(join(api.root, 'video'), 9 * 1024 ** 2);
    api.row.status = 'ready';
    const response = await api.get(new Request('http://local/video'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-length'), String(9 * 1024 ** 2));
    const reader = response.body!.getReader();
    const first = await reader.read();
    assert.ok(first.value!.length <= 8 * 1024 ** 2);
    assert.deepEqual(first.value!.slice(0, 4), Uint8Array.of(1, 2, 3, 4));
    await reader.cancel();
    const range = await api.get(new Request('http://local/video', { headers: { range: 'bytes=1-2' } }));
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-length'), '2');
    assert.deepEqual(new Uint8Array(await range.arrayBuffer()), Uint8Array.of(2, 3));
  } finally { await api.cleanup(); }
});
