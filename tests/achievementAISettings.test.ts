import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadModule } from './helpers/loadModule';
import * as settings from '../src/lib/settings';
import { isPersonalAIEnabled } from '../src/lib/aiMode';
import { AWARDS } from '../src/lib/awards';

const originalMode = process.env.NEXT_PUBLIC_AI_MODE;
afterEach(() => {
  if (originalMode === undefined) delete process.env.NEXT_PUBLIC_AI_MODE;
  else process.env.NEXT_PUBLIC_AI_MODE = originalMode;
});

type Payload = { model: string; reasoning: { effort: string }; text: { verbosity: string }; max_output_tokens: number };
type SavedSettings = { aiConfig: unknown; maxTokens: number };

function harness(name: 'story' | 'suggestions', rows: Record<string, SavedSettings | null>) {
  let userId = 'alice';
  const requests: Payload[] = [];
  const reads: string[] = [];
  const prisma = { userSettings: { findUnique: async ({ where }: { where: { userId: string } }) => {
    reads.push(where.userId);
    return rows[where.userId] ?? null;
  } } };
  const serverSettings = loadModule('src/lib/server/userSettings.ts', {
    '@/lib/db/prisma': { prisma }, '@/lib/settings': settings,
  });
  const route = loadModule<{ POST: (request: Request) => Promise<Response> }>(`src/app/api/achievements/${name}/route.ts`, {
    'next/server': { NextResponse: { json: Response.json } },
    'next-auth': { getServerSession: async () => ({ user: { id: userId } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/rateLimit': { applyRateLimit: async () => null },
    '@/lib/aiMode': { isPersonalAIEnabled },
    '@/lib/settings': settings,
    '@/lib/server/userSettings': serverSettings,
    '@/lib/awards': { AWARDS },
  }, { fetch: async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ output_text: name === 'story' ? 'A rowing story.' : '{"suggestions":[]}' });
  } });
  return { requests, reads, post: async (user: string) => {
    userId = user;
    return route.POST(new Request('http://localhost/api/achievements/' + name, { method: 'POST', body: JSON.stringify({
      userId: 'mallory', apiKey: 'synthetic-personal-key', title: 'First row', description: 'First kilometer',
      sessions: [{ timestamp: '2026-01-01', distance: 1000, duration: 300, avgSplit: 150, avgPower: 100, avgStrokeRate: 25 }],
    }) }));
  } };
}

for (const name of ['story', 'suggestions'] as const) {
  test(`${name} uses the authenticated user's saved provider settings`, async () => {
    process.env.NEXT_PUBLIC_AI_MODE = 'personal';
    const app = harness(name, {
      alice: { aiConfig: {
        achievementText: { model: 'gpt-5.5', reasoning: 'high', verbosity: 'low' },
        awardSuggestions: { model: 'gpt-5.4', reasoning: 'low', verbosity: 'high' },
      }, maxTokens: 1600 },
      bob: { aiConfig: {
        achievementText: { model: 'gpt-5.4-nano', reasoning: 'none', verbosity: 'high' },
        awardSuggestions: { model: 'gpt-5.5', reasoning: 'high', verbosity: 'medium' },
      }, maxTokens: 3200 },
    });
    for (const user of ['alice', 'bob']) assert.equal((await app.post(user)).status, 200);
    assert.deepEqual(app.requests.map(p => [p.model, p.reasoning.effort, p.text.verbosity, p.max_output_tokens]), name === 'story'
      ? [['gpt-5.5', 'high', 'low', 500], ['gpt-5.4-nano', 'none', 'high', 500]]
      : [['gpt-5.4', 'low', 'high', 1600], ['gpt-5.5', 'high', 'medium', 3200]]);
    assert.deepEqual(app.reads, ['alice', 'bob']);
  });
}

for (const name of ['story', 'suggestions'] as const) {
  test(`${name} defaults missing fields and normalizes legacy saved models`, async () => {
    process.env.NEXT_PUBLIC_AI_MODE = 'personal';
    const app = harness(name, {
      alice: { aiConfig: {
        achievementText: { model: 'gpt-5-mini', verbosity: 'high' },
        awardSuggestions: { model: 'gpt-5.2', reasoning: 'none' },
      }, maxTokens: 1800 },
      bob: null,
      legacy: { aiConfig: { model: 'gpt-5.1', temperature: 0.8 }, maxTokens: 4000 },
      invalid: { aiConfig: { achievementText: { model: 'unknown', reasoning: null }, awardSuggestions: { model: 7, verbosity: 'invalid' } }, maxTokens: 4000 },
    });
    for (const user of ['alice', 'bob', 'legacy', 'invalid']) assert.equal((await app.post(user)).status, 200);
    const configs = app.requests.map(p => [p.model, p.reasoning.effort, p.text.verbosity]);
    assert.deepEqual(configs, name === 'story'
      ? [['gpt-5.4-mini', 'low', 'high'], ['gpt-5.4-mini', 'low', 'medium'], ['gpt-5.4-mini', 'low', 'medium'], ['gpt-5.4-mini', 'low', 'medium']]
      : [['gpt-5.5', 'none', 'low'], ['gpt-5.4-mini', 'medium', 'low'], ['gpt-5.4-mini', 'medium', 'low'], ['gpt-5.4-mini', 'medium', 'low']]);
    if (name === 'suggestions') assert.deepEqual(app.requests.map(p => p.max_output_tokens), [1800, 4000, 4000, 4000]);
  });

  test(`${name} hosted mode does not read saved settings or send provider requests`, async () => {
    delete process.env.NEXT_PUBLIC_AI_MODE;
    const app = harness(name, {});
    assert.equal((await app.post('alice')).status, 503);
    assert.deepEqual(app.reads, []);
    assert.deepEqual(app.requests, []);
  });
}
