import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadModule } from '../helpers/loadModule';
import type { memoryStorage } from '../../src/lib/memoryStorage';

const target = new URL(process.env.TEST_DATABASE_URL ?? '');
assert(['localhost', '127.0.0.1'].includes(target.hostname));
assert.equal(target.pathname, '/rowing_ticket135');

test('system memory replacement preserves prior documents on failure and serializes retries per account', async () => {
  const pool = new Pool({ connectionString: target.href });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const user = await prisma.user.create({ data: { email: `memory-${crypto.randomUUID()}@example.invalid` } });
  const other = await prisma.user.create({ data: { email: `memory-${crypto.randomUUID()}@example.invalid` } });
  let userId = user.id;
  const route = loadModule<typeof import('../../src/app/api/memory/route')>('src/app/api/memory/route.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: userId } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/db/prisma': { prisma },
  });
  const service = loadModule<{ memoryStorage: typeof memoryStorage }>('src/lib/memoryStorage.ts', {}, {
    Blob,
    fetch: async (_url: string, init?: RequestInit) => {
      const req = new Request('http://localhost/api/memory', init);
      return init?.method === 'POST' ? route.POST(req) : init?.method === 'DELETE' ? route.DELETE(req) : route.GET();
    },
  }).memoryStorage;
  try {
    await pool.query(`CREATE FUNCTION reject_memory_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.description = 'reject-save' THEN RAISE EXCEPTION 'injected persistence failure'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER reject_memory_save BEFORE INSERT OR UPDATE ON "MemoryDocument" FOR EACH ROW EXECUTE FUNCTION reject_memory_save()`);
    const old = await service.addSystemDocument('training_plan', 'Original', { id: 'plan-1' }, { status: 'active' });
    await assert.rejects(service.addSystemDocument('training_plan', 'Replacement', { id: 'plan-1' }, { status: 'active', description: 'reject-save' }));
    assert.equal((await service.getDocument(old.id))?.name, 'Original');
    assert.equal((await service.getActiveTrainingPlan())?.id, old.id);
    await assert.rejects(service.addSystemDocument('training_plan', 'New plan', { id: 'plan-2' }, { status: 'active', description: 'reject-save' }));
    assert.equal((await service.getActiveTrainingPlan())?.id, old.id);
    await Promise.all(Array.from({ length: 5 }, () => service.addSystemDocument('training_plan', 'Replacement', { id: 'plan-2' }, { status: 'active' })));
    const plans = await service.filterByType('training_plan');
    assert.equal(plans.length, 2);
    assert.equal(plans.filter(p => p.status === 'active').length, 1);
    assert.equal((await service.getDocument(old.id))?.status, 'archived');
    const content = { generatedAt: '2026-11-11T12:00:00Z' };
    await Promise.all(Array.from({ length: 5 }, () => service.addSystemDocument('insight', 'Insights', content)));
    await service.addSystemDocument('insight', 'Insights', content);
    assert.equal((await service.filterByType('insight')).length, 1);
    await service.addSystemDocument('insight', 'Different name', content);
    await service.addSystemDocument('insight', 'Insights', { generatedAt: '2026-11-12T12:00:00Z' });
    assert.equal((await service.filterByType('insight')).length, 3);
    userId = other.id;
    await service.addSystemDocument('insight', 'Insights', content);
    assert.equal((await service.filterByType('insight')).length, 1);
    userId = user.id;
    assert.equal((await service.filterByType('insight')).length, 3);
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS reject_memory_save ON "MemoryDocument"; DROP FUNCTION IF EXISTS reject_memory_save()');
    await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
    await prisma.$disconnect();
    await pool.end();
  }
});
