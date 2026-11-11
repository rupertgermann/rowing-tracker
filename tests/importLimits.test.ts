import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './helpers/loadModule';

function route() {
  const rows: unknown[] = [];
  const tx = {
    rowingSession: { findFirst: async () => null, create: async ({ data }: { data: unknown }) => { rows.push(data); return data; } },
    strokeData: { createMany: async () => {} },
    userSettings: { upsert: async () => ({}) },
  };
  const api = loadModule<{ POST(req: Request): Promise<Response> }>('src/app/api/sessions/route.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/db/prisma': { prisma: { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } },
    '@/lib/server/userSettings': { bumpUserSessionsRevision: async () => {} },
  });
  return { ...api, rows };
}
const valid = { timestamp: '2026-01-01T00:00:00Z', distance: 2000, duration: 480 };
function request(body: unknown) {
  return new Request('http://local/api/sessions', { method: 'POST', body: JSON.stringify(body) });
}

test('session import rejects malformed numeric input before saving any session', async () => {
  const api = route();
  assert.equal((await api.POST(request({ sessions: [valid, { ...valid, distance: '2000' }] }))).status, 400);
  assert.equal(api.rows.length, 0);
});

test('session import bounds actual body bytes even with a false Content-Length', async () => {
  const api = route();
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelled = true; },
  });
  const req = new Request('http://local/api/sessions', { method: 'POST', headers: { 'content-length': '1' }, body: stream, duplex: 'half' } as RequestInit);
  assert.equal((await api.POST(req)).status, 413);
  assert.equal(cancelled, true);
  assert.equal(api.rows.length, 0);
});

test('session import accepts supported boundaries and rejects malformed JSON and strokes', async () => {
  const api = route();
  assert.equal((await api.POST(request({ sessions: [{ ...valid, distance: 1_000_000, duration: 604800, avgPower: 10_000, strokeCount: 0 }] }))).status, 200);
  for (const patch of [{ distance: -1 }, { timestamp: 'yesterday' }, { avgPower: null }, { strokeCount: 1.5 }, { duration: 604801 }, { strokeData: [{ power: -1 }] }]) {
    assert.equal((await api.POST(request({ sessions: [{ ...valid, ...patch }] }))).status, 400);
  }
  assert.equal((await api.POST(new Request('http://local/api/sessions', { method: 'POST', body: '{' }))).status, 400);
});
