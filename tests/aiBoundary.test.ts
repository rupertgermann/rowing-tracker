import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadModule } from './helpers/loadModule';
import { isPersonalAIEnabled } from '../src/lib/aiMode';
import { cloudAI } from '../src/lib/cloudAI';

const originalMode = process.env.NEXT_PUBLIC_AI_MODE;
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (originalMode === undefined) delete process.env.NEXT_PUBLIC_AI_MODE;
  else process.env.NEXT_PUBLIC_AI_MODE = originalMode;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  cloudAI.initialize();
});

for (const name of ['story', 'image', 'suggestions']) {
  test(`${name} rejects hosted requests without contacting a provider`, async () => {
    delete process.env.NEXT_PUBLIC_AI_MODE;
    process.env.OPENAI_API_KEY = 'synthetic-operator-secret';
    let calls = 0;
    const route = loadModule<{ POST: (request: Request) => Promise<Response> }>(`src/app/api/achievements/${name}/route.ts`, {
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      'next-auth': { getServerSession: async () => ({ user: { id: 'alice' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/rateLimit': { applyRateLimit: async () => null },
      '@/lib/aiMode': { isPersonalAIEnabled },
      '@/lib/settings': { SettingsService: { getInstance: () => ({ getAISettings: () => ({ achievementText: {}, achievementImage: {} }) }) }, normalizeAITextModel: () => 'gpt-5.4-mini' },
      '@/lib/db/prisma': { prisma: {} },
    }, { fetch: async () => { calls++; return Response.json({}); }, console: { error() {} } });
    const response = await route.POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ title: 'A', description: 'B', apiKey: 'personal-key', sessions: [{ timestamp: '2026-01-01', distance: 1000, duration: 300, avgSplit: 150, avgPower: 100, avgStrokeRate: 25 }] }) }));
    assert.equal(response.status, 503);
    assert.equal(calls, 0);
    process.env.NEXT_PUBLIC_AI_MODE = 'personal';
    const missingKey = await route.POST(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ title: 'A', description: 'B', sessions: [{ distance: 1000 }] }) }));
    assert.equal(missingKey.status, 401, 'personal mode must not fall back to an operator key');
    assert.equal(calls, 0);
  });
}

test('browser BYOK requires explicit personal mode and clears a previous configuration', () => {
  process.env.NEXT_PUBLIC_AI_MODE = 'personal';
  assert.equal(cloudAI.initialize('synthetic-personal-key'), true);
  delete process.env.NEXT_PUBLIC_AI_MODE;
  assert.equal(cloudAI.initialize('synthetic-personal-key'), false);
  assert.equal(cloudAI.isConfigured(), false);
});
