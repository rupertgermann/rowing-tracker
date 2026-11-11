import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './helpers/loadModule';
import { settingsUpdateSchema } from '../src/lib/validations/settings';
import * as prompts from '../src/lib/aiPromptDefaults';
import * as thresholds from '../src/lib/mocap/analysis/postureThresholds';
import type * as SettingsModule from '../src/lib/settings';

test('settings API rejects unsupported data-management preferences with the field name', async () => {
  const prisma = { userSettings: { upsert: async () => ({}) } };
  const route = loadModule<{ POST(req: Request): Promise<Response> }>('src/app/api/settings/route.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'alice' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/db/prisma': { prisma },
    '@/lib/server/userSettings': loadModule('src/lib/server/userSettings.ts', { '@/lib/db/prisma': { prisma } }),
    '@/lib/validations/settings': { settingsUpdateSchema },
  });
  for (const [field, value] of Object.entries({ exportFormat: 'csv', backupEnabled: true, lastBackup: '2026-11-11' })) {
    const response = await route.POST(new Request('http://localhost/api/settings', {
      method: 'POST', body: JSON.stringify({ [field]: value }),
    }));
    assert.equal(response.status, 400, field);
    assert.match((await response.json()).details, new RegExp(field));
  }
});

test('legacy local preferences do not poison settings saves or return after reinitialization', async () => {
  const cache = new Map<string, string>();
  let stored: Record<string, unknown> | null = null;
  let pendingSave: (() => Promise<void>) | undefined;
  const loadSettings = () => loadModule<typeof SettingsModule>('src/lib/settings.ts', {
    '@/lib/aiPromptDefaults': prompts,
    '@/lib/mocap/analysis/postureThresholds': thresholds,
  }, {
    window: {},
    localStorage: {
      getItem: (key: string) => cache.get(key) ?? null,
      setItem: (key: string, value: string) => cache.set(key, value),
    },
    setTimeout: (callback: () => Promise<void>) => { pendingSave = callback; return 1; },
    clearTimeout: () => { pendingSave = undefined; },
    fetch: async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        assert.equal(settingsUpdateSchema.safeParse(body).success, true, 'save uses only supported API fields');
        stored = body;
      }
      return Response.json({ settings: stored });
    },
  }).SettingsService.getInstance();
  const service = loadSettings();
  cache.set('rowing_app_settings', JSON.stringify({
    ...service.getSettings(),
    dataManagement: { ...service.getDataManagement(), exportFormat: 'csv', backupEnabled: true, lastBackup: '2026-11-11' },
  }));
  const assertSupported = (settings: ReturnType<typeof service.getSettings>) => {
    for (const field of ['exportFormat', 'backupEnabled', 'lastBackup']) {
      assert.equal(field in settings.dataManagement, false, field);
    }
  };
  assertSupported(service.getSettings());
  service.updateUserPreferences({ theme: 'dark' });
  assert.ok(pendingSave);
  await pendingSave();
  assert.ok(stored);
  const reloaded = loadSettings();
  await reloaded.initializeFromDB();
  assert.equal(reloaded.getUserPreferences().theme, 'dark');
  assertSupported(reloaded.getSettings());
});
