import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './helpers/loadModule';

test('finalize rejects invalid, oversized and out-of-range metadata', async () => {
  const { POST } = loadModule<{ POST(req: Request, context: unknown): Promise<Response> }>('src/app/api/mocap/sessions/[id]/finalize/route.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/mocap/lifecyclePrisma': { getPrismaMocapSessionLifecycle: () => ({ finalize: async () => ({ ok: true, id: 'recording', status: 'ready' }) }) },
  });
  const post = (body: string) => POST(new Request('http://local/finalize', { method: 'POST', body }), { params: Promise.resolve({ id: 'recording' }) });
  assert.equal((await post(JSON.stringify({ durationSec: 28800 }))).status, 200);
  for (const body of ['{', JSON.stringify({ durationSec: 28801 }), JSON.stringify({ durationSec: '30' })]) assert.equal((await post(body)).status, 400);
  assert.equal((await post(' '.repeat(16 * 1024 + 1))).status, 413);
});
