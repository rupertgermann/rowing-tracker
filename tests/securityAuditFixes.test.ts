import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadModule } from './helpers/loadModule';

type Route = { POST: (req: Request) => Promise<Response> };
const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNjcAAAAASUVORK5CYII=', 'base64');
const request = (body: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });
function sharedImports(userId: string | null) {
  const avatar = loadModule('src/lib/userAvatar.ts', {});
  const validation = existsSync('src/lib/uploadValidation.ts') ? loadModule('src/lib/uploadValidation.ts', { '@/lib/userAvatar': avatar }) : {};
  return { 'next/server': { NextResponse: { json } }, 'next-auth': { getServerSession: async () => userId ? { user: { id: userId, role: 'admin' } } : null }, '@/lib/auth': { authOptions: {} }, '@/lib/userAvatar': avatar, '@/lib/uploadValidation': validation, '@/lib/memoryStorage': loadModule('src/lib/memoryStorage.ts', {}) };
}
async function awardFixture(userId: string | null) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'award-security-'));
  const load = (action: string) => loadModule<Route>(`src/app/api/achievements/image/${action}/route.ts`, sharedImports(userId), { process: { ...process, cwd: () => dir } });
  return { dir, load, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
for (const action of ['save', 'delete']) test(`anonymous award ${action} is rejected before filesystem changes`, async () => {
  const fixture = await awardFixture(null);
  try {
    const response = await fixture.load(action).POST(request({ awardId: 'award', imageData: 'data:image/html;base64,PGgxPmhpPC9oMT4=' }));
    assert.equal(response.status, 401);
    assert.equal(existsSync(path.join(fixture.dir, 'public/assets/awards/award.html')), false);
  } finally { await fixture.cleanup(); }
});
test('award save rejects active content and spoofed PNG, isolates a valid PNG by user', async () => {
  const fixture = await awardFixture('alice');
  try {
    const handler = fixture.load('save').POST;
    for (const imageData of ['data:image/html;base64,PGgxPmhpPC9oMT4=', 'data:image/png;base64,PGgxPmhpPC9oMT4=']) {
      assert.equal((await handler(request({ awardId: 'award', imageData }))).status, 400);
    }
    const response = await handler(request({ awardId: 'award', imageData: `data:image/png;base64,${png.toString('base64')}` }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).filePath, '/assets/awards/alice/award.png');
    assert.deepEqual(await readFile(path.join(fixture.dir, 'public/assets/awards/alice/award.png')), png);
  } finally { await fixture.cleanup(); }
});
test('award delete preserves shared defaults and other users', async () => {
  const fixture = await awardFixture('alice');
  try {
    const root = path.join(fixture.dir, 'public/assets/awards');
    for (const sub of ['alice', 'bob']) { await mkdir(path.join(root, sub), { recursive: true }); await writeFile(path.join(root, sub, 'award.png'), png); }
    await writeFile(path.join(root, 'award.png'), png);
    assert.equal((await fixture.load('delete').POST(request({ awardId: 'award' }))).status, 200);
    await assert.rejects(access(path.join(root, 'alice/award.png')));
    await access(path.join(root, 'bob/award.png'));
    await access(path.join(root, 'award.png'));
  } finally { await fixture.cleanup(); }
});
test('admin authorization rechecks demotion and deleted users with an old admin session', async () => {
  for (const user of [{ role: 'user' }, null, { role: 'admin' }]) {
    const helpers = loadModule<{ requireAdmin: () => Promise<Response | null>; isAdmin: () => Promise<boolean> }>('src/lib/adminAuth.ts', { ...sharedImports('alice'), '@/lib/db/prisma': { prisma: { user: { findUnique: async () => user } } } });
    assert.equal((await helpers.requireAdmin())?.status ?? 200, user?.role === 'admin' ? 200 : 403);
    assert.equal(await helpers.isAdmin(), user?.role === 'admin');
  }
});
test('credentials callback and forgot password honor auth limiter before any auth work', async () => {
  for (const file of ['src/app/api/auth/[...nextauth]/route.ts', 'src/app/api/auth/forgot-password/route.ts']) {
    let calls = 0;
    const handler = loadModule<Route>(file, { ...sharedImports(null), 'next-auth': () => () => { throw new Error('Auth must not run'); }, '@/lib/rateLimit': { applyRateLimit: async (_req: Request, _id: unknown, type: string) => { assert.equal(type, 'auth'); calls++; return json({ error: 'Too many requests' }, { status: 429 }); } }, '@/lib/db/prisma': { prisma: { user: { findUnique: () => { throw new Error('DB must not run'); } } } } });
    const response = await handler.POST(new Request('http://localhost/api/auth/callback/credentials', { method: 'POST', body: JSON.stringify({ email: 'alice@example.com' }) }));
    assert.equal(response.status, 429);
    assert.equal(calls, 1);
  }
});
function memoryHandler(totalSize: number, events: string[], failWrite = false, failCleanup: boolean | 'missing' = false, reservation?: { filePath?: string }) {
  const memoryDocument = {
    aggregate: async ({ where }: { where: { userId: string; size: { gt: number } } }) => { assert.equal(where.userId, 'alice'); assert.equal(where.size.gt, 0); events.push('aggregate'); return { _sum: { size: totalSize } }; },
    create: async ({ data }: { data: { filePath?: string } }) => {
      if (reservation) reservation.filePath = data.filePath;
      events.push('create'); return { id: 'doc', ...data };
    },
    update: async ({ data }: { data: object }) => ({ id: 'doc', ...data }),
    delete: async () => { events.push('delete'); },
  };
  const tx = { memoryDocument, $queryRaw: async (sql: TemplateStringsArray, userId: string) => { assert.equal(userId, 'alice'); assert.equal(sql.join('?'), 'SELECT id FROM "User" WHERE id = ? FOR UPDATE'); events.push('lock'); } };
  return loadModule<Route>('src/app/api/memory/upload/route.ts', { ...sharedImports('alice'), '@/lib/db/prisma': { prisma: { ...tx, $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } }, 'fs/promises': { mkdir: async () => {}, writeFile: async () => { events.push('write'); if (failWrite) throw new Error('disk full'); }, unlink: async () => { events.push('unlink'); if (failCleanup === 'missing') throw Object.assign(new Error('no file'), { code: 'ENOENT' }); if (failCleanup) throw new Error('cleanup unavailable'); } } });
}
async function upload(handler: Route, data: Uint8Array, type: string) {
  const form = new FormData(); form.set('file', new File([new Uint8Array(data)], 'upload', { type }));
  return handler.POST(new Request('http://localhost/api/memory/upload', { method: 'POST', body: form }));
}
test('memory upload enforces size and signatures before persistence', async () => {
  const events: string[] = [];
  const handler = memoryHandler(0, events);
  assert.equal((await upload(handler, new Uint8Array(10 * 1024 * 1024 + 1), 'image/png')).status, 413);
  for (const type of ['image/png', 'image/svg+xml', 'text/html', 'application/pdf']) {
    assert.equal((await upload(handler, Buffer.from('<html>bad</html>'), type)).status, 400);
  }
  assert.deepEqual(events, []);
});
test('memory quota reserves storage under a user lock before writing', async () => {
  const events: string[] = [];
  const blocked = await upload(memoryHandler(50 * 1024 * 1024, events), png, 'image/png');
  assert.equal(blocked.status, 413);
  assert.deepEqual(events, ['lock', 'aggregate']);
  events.length = 0;
  assert.equal((await upload(memoryHandler(0, events), png, 'image/png')).status, 200);
  assert.deepEqual(events, ['lock', 'aggregate', 'create', 'write']);
});
test('memory stops oversized multipart streams before buffering the whole request', async () => {
  let produced = 0;
  const events: string[] = [];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('--audit\r\nContent-Disposition: form-data; name="description"\r\n\r\n'));
    },
    pull(controller) {
      if (produced < 20 * 1024 * 1024) {
        produced += 1024 * 1024;
        controller.enqueue(new Uint8Array(1024 * 1024).fill(65));
      } else {
        controller.enqueue(new TextEncoder().encode('\r\n--audit--\r\n'));
        controller.close();
      }
    },
  });
  const init = { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=audit' }, body, duplex: 'half' };
  const response = await memoryHandler(0, events).POST(new Request('http://localhost/api/memory/upload', init));
  assert.equal(response.status, 413);
  assert.ok(produced < 20 * 1024 * 1024);
  assert.deepEqual(events, []);
});
test('award lookup prefers the current user and preserves shared fallback', async () => {
  const fixture = await awardFixture('alice');
  try {
    const root = path.join(fixture.dir, 'public/assets/awards');
    await mkdir(path.join(root, 'alice'), { recursive: true });
    await writeFile(path.join(root, 'award.png'), png);
    const handler = loadModule<{ GET: (request: Request) => Promise<Response> }>('src/app/api/achievements/image/route.ts', { ...sharedImports('alice'), '@/lib/achievementColors': {} }, { process: { ...process, cwd: () => fixture.dir } });
    const get = () => handler.GET(new Request('http://localhost/api/achievements/image?awardId=award'));
    assert.equal((await (await get()).json()).filePath, '/assets/awards/award.png');
    await writeFile(path.join(root, 'alice/award.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
    assert.equal((await (await get()).json()).filePath, '/assets/awards/alice/award.jpg');
    const save = fixture.load('save');
    assert.equal((await save.POST(request({ awardId: 'award', imageData: `data:image/png;base64,${png.toString('base64')}` }))).status, 200);
    assert.equal(existsSync(path.join(root, 'alice/award.jpg')), false);
    assert.equal((await (await get()).json()).filePath, '/assets/awards/alice/award.png');
  } finally { await fixture.cleanup(); }
});
test('memory allows its supported image and PDF signatures without the avatar 2 MB limit', async () => {
  for (const [mimeType, bytes] of [
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
    ['image/gif', Buffer.from('GIF89a')],
    ['application/pdf', Buffer.from('%PDF-1.7')],
    ['image/png', Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)])],
  ] as const) {
    assert.equal((await upload(memoryHandler(0, []), bytes, mimeType)).status, 200);
  }
});
test('memory metadata cannot lower stored file sizes or insert negative quota usage', async () => {
  const updates: object[] = [];
  const handler = loadModule<Route>('src/app/api/memory/route.ts', {
    ...sharedImports('alice'),
    '@/lib/db/prisma': { prisma: { memoryDocument: {
      findFirst: async () => ({ id: 'doc', size: 100, filePath: 'memory/alice/doc.png' }),
      update: async ({ data }: { data: object }) => { updates.push(data); return data; },
      create: async () => { throw new Error('Negative size must not be saved'); },
    } } },
  });
  assert.equal((await handler.POST(request({ documents: [{ id: 'doc', size: 0, description: 'updated' }] }))).status, 200);
  assert.equal('size' in updates[0], false);
  assert.equal((await handler.POST(request({ documents: [{ name: 'negative', size: -100 }] }))).status, 400);
});

test('memory upload releases its quota reservation after a disk failure', async () => {
  const events: string[] = [];
  assert.equal((await upload(memoryHandler(0, events, true), png, 'image/png')).status, 500);
  assert.deepEqual(events, ['lock', 'aggregate', 'create', 'write', 'unlink', 'delete']);
});

test('failed upload cleanup retains the file pointer and quota reservation for retry', async () => {
  const events: string[] = [];
  const reservation: { filePath?: string } = {};
  assert.equal((await upload(memoryHandler(0, events, true, true, reservation), png, 'image/png')).status, 500);
  assert.deepEqual(events, ['lock', 'aggregate', 'create', 'write', 'unlink']);
  assert.match(reservation.filePath ?? '', /^memory\/alice\/.+/);
});

test('failed upload releases quota when no partial file exists', async () => {
  const events: string[] = [];
  assert.equal((await upload(memoryHandler(0, events, true, 'missing'), png, 'image/png')).status, 500);
  assert.deepEqual(events, ['lock', 'aggregate', 'create', 'write', 'unlink', 'delete']);
});
