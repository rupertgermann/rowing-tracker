import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './helpers/loadModule';

test('account transition clears private caches and discards an outstanding API result', async () => {
  const values = new Map([['rowing_account_owner', 'A'], ['rowing_app_settings', 'secret-A'], ['rowing_analytics_cache', 'A'], ['theme', 'dark']]);
  const storage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i], getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) };
  let resolve!: (response: Response) => void;
  const browser = { localStorage: storage, fetch: () => new Promise<Response>(r => { resolve = r; }) };
  const { createAccountBoundary } = loadModule<typeof import('../src/lib/accountBoundary')>('src/lib/accountBoundary.ts', {}, { window: browser, DOMException, AbortController, AbortSignal });
  const boundary = createAccountBoundary(browser as unknown as Window);
  assert.equal(boundary.enter('A'), false);
  const pending = browser.fetch();
  assert.equal(boundary.enter('B'), true);
  resolve(Response.json({ secret: 'A' }));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(storage.getItem('rowing_app_settings'), null);
  assert.equal(storage.getItem('rowing_analytics_cache'), null);
  assert.equal(storage.getItem('theme'), 'dark');
  assert.equal(storage.getItem('rowing_account_owner'), 'B');
});

test('another tab changing account invalidates a response body already in flight', async () => {
  const values = new Map([['rowing_account_owner', 'A']]);
  const storage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i], getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) };
  let finish!: (value: unknown) => void;
  const browser = { localStorage: storage, fetch: async () => ({ json: () => new Promise(r => { finish = r; }) }) };
  const { createAccountBoundary } = loadModule<typeof import('../src/lib/accountBoundary')>('src/lib/accountBoundary.ts', {}, { DOMException, AbortController, AbortSignal });
  createAccountBoundary(browser as unknown as Window).enter('A');
  const response = await browser.fetch();
  const body = response.json();
  storage.setItem('rowing_account_owner', 'B');
  finish({ apiKey: 'A' });
  await assert.rejects(body, { name: 'AbortError' });
});

test('legacy image migration lists only images owned by the authenticated account', async () => {
  const accountBoundary = loadModule<typeof import('../src/lib/accountBoundary')>('src/lib/accountBoundary.ts', {});
  const images = new Map([['rowing-achievement-images', ['unowned-private-image']], ['rowing-achievement-images:A', ['A-image']]]);
  const imports = { './accountBoundary': accountBoundary, idb: { openDB: async (name: string) => ({ getAllKeys: async () => images.get(name) ?? [] }) } };
  for (const [owner, expected] of [['A', ['A-image']], ['B', []]] as const) {
    const service = loadModule<typeof import('../src/lib/imageStorage')>('src/lib/imageStorage.ts', imports, { localStorage: { getItem: () => owner } });
    assert.deepEqual(await service.getAllAchievementImageIdsFromIndexedDB(), expected);
  }
});

test('unowned local-only migration records are quarantined without being offered to a new account', () => {
  const values = new Map([['rowingSessions', '[{"id":"legacy-private-session"}]'], ['rowing-tracker-storage', '{"state":{"sessions":[{"id":"old"}]}}'], ['personalRecords', '[{"id":"pr"}]'], ['trainingPlans', '[{"id":"plan"}]'], ['earnedAwards', '[{"id":"award"}]'], ['rowing_analytics_cache', 'server-cache'], ['rowing_app_settings', 'old-api-key']]);
  const storage = { get length() { return values.size; }, key: (i: number) => [...values.keys()][i], getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) };
  const { createAccountBoundary, isLegacyDataQuarantined } = loadModule<typeof import('../src/lib/accountBoundary')>('src/lib/accountBoundary.ts', {}, { DOMException, AbortController, AbortSignal });
  const browser = { localStorage: storage, fetch: async () => Response.json({}) };
  createAccountBoundary(browser as unknown as Window).enter('A');
  assert.equal(storage.getItem('rowing_legacy_quarantine'), 'in-place');
  assert.equal(storage.getItem('rowingSessions'), '[{"id":"legacy-private-session"}]');
  assert.equal(storage.getItem('rowing-tracker-storage'), '{"state":{"sessions":[{"id":"old"}]}}');
  const migration = loadModule<typeof import('../src/lib/migrateLocalStorage')>('src/lib/migrateLocalStorage.ts', {
    './accountBoundary': { isLegacyDataQuarantined },
  }, { localStorage: storage, window: browser });
  assert.equal(migration.hasPendingMigration(), false);
  migration.clearLocalStorageData();
  assert.equal(storage.getItem('rowingSessions'), '[{"id":"legacy-private-session"}]');
  const freshBrowser = { localStorage: storage, fetch: async () => Response.json({}) };
  createAccountBoundary(freshBrowser as unknown as Window).enter('B');
  assert.ok(storage.getItem('rowing_legacy_quarantine'));
  assert.equal(storage.getItem('rowing_app_settings'), null);
});
