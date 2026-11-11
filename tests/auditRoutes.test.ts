import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './helpers/loadModule';
import { settingsUpdateSchema } from '../src/lib/validations/settings';

type Route = { POST: (req: Request) => Promise<Response>; DELETE: (req: Request) => Promise<Response> };
const imports = {
  'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
  'next-auth': { getServerSession: async () => ({ user: { id: 'alice' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/rateLimit': { applyRateLimit: async () => null },
};
const request = (body: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });

test('first settings save retains the same supplied fields as later saves', async () => {
  let saved: { create: Record<string, unknown>; update: Record<string, unknown> } | undefined;
  const prisma = { userSettings: { upsert: async (args: NonNullable<typeof saved>) => { saved = args; return args.create; } } };
  const serverSettings = loadModule('src/lib/server/userSettings.ts', { '@/lib/db/prisma': { prisma } });
  const route = loadModule<Route>('src/app/api/settings/route.ts', {
    ...imports,
    '@/lib/db/prisma': { prisma },
    '@/lib/server/userSettings': serverSettings,
    '@/lib/validations/settings': { settingsUpdateSchema },
  });
  const body = {
    timeZone: 'Europe/Berlin', weeklyGoalType: 'distance', weeklyGoalTarget: 20,
    restDayAlerts: false, achievementAlerts: false, showPromptSuggestions: false,
    mocapDetailedAIShare: true, mocapPreferences: { verbosity: 'verbose', audioEnabled: true },
    aiConfig: { chat: { model: 'gpt-5.5', reasoning: 'low', verbosity: 'low' } },
    chartSettings: { smoothing: 10 },
  };
  assert.equal((await route.POST(request(body))).status, 200);
  assert.ok(saved);
  assert.equal(saved.create.userId, 'alice');
  for (const [key, value] of Object.entries(body)) {
    assert.deepEqual(saved.create[key], value, key);
    assert.deepEqual(saved.update[key], value, key);
  }
  saved = undefined;
  assert.equal((await route.POST(request({ timeZone: 'not/a-zone' }))).status, 400);
  assert.equal(saved, undefined);
});

test('password reset consumes a valid token and updates credentials atomically', async () => {
  let tokenPresent = true;
  let password = 'old';
  let failUpdate = true;
  let loseClaim = false;
  let transactionCount = 0;
  const prisma = {
    passwordResetToken: { findUnique: async () => tokenPresent
      ? { email: 'alice@example.com', expires: new Date(Date.now() + 60_000) } : null },
    user: { findUnique: async () => ({ id: 'alice' }) },
    $transaction: async (fn: (db: typeof tx) => Promise<boolean>) => {
      transactionCount++;
      const snapshot = { tokenPresent, password };
      try { return await fn(tx); }
      catch (error) { ({ tokenPresent, password } = snapshot); throw error; }
    },
  };
  const tx = {
    passwordResetToken: { deleteMany: async ({ where }: { where: { token?: string; expires?: { gt: Date }; email?: string } }) => {
      if (where.token) {
        assert.equal(where.token, 'reset-token');
        assert.ok(where.expires?.gt);
        if (!tokenPresent || loseClaim) return { count: 0 };
        tokenPresent = false;
      } else assert.equal(where.email, 'alice@example.com');
      return { count: 1 };
    } },
    user: { update: async ({ data }: { data: { passwordHash: string } }) => {
      if (failUpdate) throw new Error('write failed');
      password = data.passwordHash;
    } },
  };
  const route = loadModule<Route>('src/app/api/auth/reset-password/route.ts', {
    ...imports, '@/lib/db/prisma': { prisma },
    bcryptjs: { hash: async () => 'new-hash' },
  }, { console: { error: () => {} } });
  const reset = () => route.POST(request({ token: 'reset-token', password: 'long-enough' }));
  assert.equal((await reset()).status, 500);
  assert.equal(tokenPresent, true, 'failed password write must not consume the reset link');
  assert.equal(password, 'old');
  failUpdate = false;
  loseClaim = true;
  assert.equal((await reset()).status, 400, 'a token consumed concurrently cannot update the password');
  assert.equal(password, 'old');
  loseClaim = false;
  assert.equal((await reset()).status, 200);
  assert.equal(password, 'new-hash');
  assert.equal(tokenPresent, false);
  assert.equal((await reset()).status, 400);
  assert.equal(transactionCount, 3);
});

test('password reset honors rate limits before reading tokens or hashing', async () => {
  const route = loadModule<Route>('src/app/api/auth/reset-password/route.ts', {
    ...imports, '@/lib/db/prisma': { prisma: {} },
    '@/lib/rateLimit': { applyRateLimit: async (_req: Request, user: unknown, type: string) => {
      assert.equal(user, null);
      assert.equal(type, 'auth');
      return Response.json({}, { status: 429 });
    } },
  });
  assert.equal((await route.POST(request({}))).status, 429);
});

test('session deletion and revision updates commit or roll back together', async () => {
  let deleted = false;
  let revision = 0;
  let failRevision = true;
  const tx = { rowingSession: { delete: async () => { deleted = true; } } };
  const route = loadModule<Route>('src/app/api/sessions/route.ts', {
    ...imports,
    '@/lib/analysisUtils': {},
    '@/lib/db/prisma': { prisma: {
      rowingSession: { findFirst: async () => ({ id: 'session' }) },
      $transaction: async (fn: (db: typeof tx) => Promise<void>) => {
        const snapshot = { deleted, revision };
        try { return await fn(tx); }
        catch (error) { ({ deleted, revision } = snapshot); throw error; }
      },
    } },
    '@/lib/server/userSettings': { bumpUserSessionsRevision: async (userId: string, db: unknown) => {
      assert.equal(userId, 'alice');
      assert.equal(db, tx);
      if (failRevision) throw new Error('revision write failed');
      revision++;
    } },
  }, { console: { error: () => {}, log: () => {} } });
  const remove = () => route.DELETE(new Request('http://localhost/api/sessions?id=session', { method: 'DELETE' }));
  assert.equal((await remove()).status, 500);
  assert.equal(deleted, false);
  assert.equal(revision, 0);
  failRevision = false;
  assert.equal((await remove()).status, 200);
  assert.equal(deleted, true);
  assert.equal(revision, 1);
});

test('personal records reject foreign session IDs before any record writes', async () => {
  let ownedCount = 0;
  let writes = 0;
  const route = loadModule<Route>('src/app/api/prs/route.ts', {
    ...imports, '@/lib/db/prisma': { prisma: {
      rowingSession: { count: async ({ where }: { where: { userId: string; id: { in: string[] } } }) => {
        assert.equal(where.userId, 'alice');
        assert.equal(where.id.in.join(','), 'session');
        return ownedCount;
      } },
      personalRecord: { findFirst: async () => null, create: async () => { writes++; return {}; } },
    } },
  });
  const save = () => route.POST(request({ prs: [{ sessionId: 'session', distance: 1000, value: 300, achievedAt: '2026-11-11' }] }));
  assert.equal((await save()).status, 400);
  assert.equal(writes, 0);
  assert.equal((await route.POST(request({ prs: [{ sessionId: { set: 'foreign-session' } }] }))).status, 400);
  assert.equal(writes, 0);
  ownedCount = 1;
  assert.equal((await save()).status, 200);
  assert.equal(writes, 1);
});

for (const endpoint of ['achievements/story', 'achievements/image', 'achievements/suggestions', 'smartrow/sync']) {
  test(`${endpoint} rejects anonymous and rate-limited requests before expensive work`, async () => {
    for (const authenticated of [false, true]) {
      let rateChecks = 0;
      const route = loadModule<Route>(`src/app/api/${endpoint}/route.ts`, {
        ...imports,
        'next-auth': { getServerSession: async () => authenticated ? { user: { id: 'alice' } } : null },
        '@/lib/rateLimit': { applyRateLimit: async (_req: Request, userId: string, type: string) => {
          assert.equal(userId, 'alice');
          assert.equal(type, endpoint === 'smartrow/sync' ? 'sensitive' : 'ai');
          rateChecks++;
          return Response.json({}, { status: 429 });
        } },
        '@/lib/settings': {}, '@/lib/awards': {}, '@/lib/achievementColors': {},
        playwright: { chromium: { launch: () => { throw new Error('Browser must not launch'); } } },
      }, { fetch: () => { throw new Error('AI must not be called'); } });
      const response = await route.POST(new Request(`http://localhost/api/${endpoint}`, { method: 'POST', body: 'invalid JSON' }));
      assert.equal(response.status, authenticated ? 429 : 401);
      assert.equal(rateChecks, authenticated ? 1 : 0);
    }
  });
}

for (const mailConfigured of [false, true]) {
  test(`production forgot-password never logs reset links when mail is ${mailConfigured ? 'failing' : 'unconfigured'}`, async () => {
    const logs: string[] = [];
    const route = loadModule<Route>('src/app/api/auth/forgot-password/route.ts', {
      ...imports,
      '@/lib/db/prisma': { prisma: {
        user: { findUnique: async () => ({ name: 'Rower' }) },
        passwordResetToken: { deleteMany: async () => {}, create: async () => {} },
      } },
      nodemailer: { createTransport: () => ({ sendMail: async () => { throw new Error('mail unavailable'); } }) },
    }, {
      process: { env: { NODE_ENV: 'production', NEXTAUTH_URL: 'https://example.test',
        ...(mailConfigured ? { EMAIL_SERVER: 'smtp://localhost', EMAIL_FROM: 'rower@example.test' } : {}) } },
      console: { log: (...args: unknown[]) => logs.push(args.join(' ')), error: () => {} },
    });
    const response = await route.POST(request({ email: 'rower@example.test' }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.resetUrl, undefined);
    assert.equal(body.warning, undefined);
    assert.equal(logs.length, 0);
  });
}
