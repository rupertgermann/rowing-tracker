import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './helpers/loadModule';
import { INGESTION_LIMITS } from '../src/lib/ingestionLimits';

for (const failure of [undefined, 'http', 'network'] as const) {
  test(`legacy migration batches 1001 workouts and preserves retryability after ${failure ?? 'no failure'}`, async () => {
    const sessions = Array.from({ length: 1001 }, (_, index) => ({
      id: `legacy-${index}`, timestamp: '2026-01-01T00:00:00Z', distance: index, duration: 300,
    }));
    const values = new Map([['rowingSessions', JSON.stringify(sessions)]]);
    const saved = new Map<number, unknown>();
    const api = loadModule<typeof import('../src/app/api/migrate/sessions/route')>('src/app/api/migrate/sessions/route.ts', {
      'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/rateLimit': { applyRateLimit: async () => null },
      '@/lib/db/prisma': { prisma: { rowingSession: {
        findFirst: async ({ where }: { where: { distance: number } }) => saved.get(where.distance) ?? null,
        create: async ({ data }: { data: { distance: number } }) => { saved.set(data.distance, data); return data; },
      } } },
    });
    const sizes: number[] = [];
    const migration = loadModule<typeof import('../src/lib/migrateLocalStorage')>('src/lib/migrateLocalStorage.ts', {}, {
      localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
      fetch: async (_url: string, init: RequestInit) => {
        sizes.push(JSON.parse(String(init.body)).sessions.length);
        assert.ok(Buffer.byteLength(String(init.body)) <= INGESTION_LIMITS.sessionBodyBytes);
        if (sizes.length === 2 && failure === 'http') return Response.json({ error: 'Unavailable' }, { status: 503 });
        const response = await api.POST(new Request('http://localhost/api/migrate/sessions', init));
        if (sizes.length === 2 && failure === 'network') throw new Error('Lost response after commit');
        return response;
      },
      console: { ...console, log() {} },
    });
    const result = await migration.migrateLocalStorageToDatabase();
    assert.deepEqual(sizes, [1000, 1]);
    assert.equal(result.success, !failure);
    assert.equal(result.migratedSessions, failure ? 1000 : 1001);
    assert.equal(values.get('rowingSessions'), JSON.stringify(sessions));
    if (failure) {
      assert.equal(values.get('migrationComplete'), undefined);
      const retry = await migration.migrateLocalStorageToDatabase();
      assert.equal(retry.success, true);
      assert.equal(retry.migratedSessions, failure === 'http' ? 1 : 0);
    }
    assert.equal(values.get('migrationComplete'), 'true');
    assert.deepEqual([...saved.keys()], sessions.map(row => row.distance));
  });
}
