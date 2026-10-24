import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const migration = '20261024160000_reconcile_runtime_columns';
const target = new URL(process.env.TEST_DATABASE_URL ?? '');
assert(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'local PostgreSQL only');
assert.equal(target.pathname, '/rowing_migration_test', 'use a disposable rowing_migration_test database');

function workspace() {
  const dir = mkdtempSync(path.join(tmpdir(), 'rowing-migration-test-'));
  cpSync('prisma', path.join(dir, 'prisma'), { recursive: true });
  symlinkSync(path.resolve('node_modules'), path.join(dir, 'node_modules'));
  writeFileSync(path.join(dir, 'prisma.config.ts'), `import { defineConfig } from 'prisma/config';
export default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' }, datasource: { url: process.env.DATABASE_URL! } });`);
  return dir;
}

function deploy(dir: string, url: string) {
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: dir,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
    timeout: 60_000,
  });
}

async function exerciseClient(pool: Pool) {
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const user = await prisma.user.create({ data: { email: 'migration@example.invalid', settings: { create: {} } }, include: { settings: true } });
    assert.equal(user.settings?.sessionsRevision, 0);
    assert.equal(user.settings?.insightsRevision, 0);
    assert.equal(user.settings?.timeZone, 'UTC');
    const settings = await prisma.userSettings.update({ where: { userId: user.id }, data: { sessionsRevision: { increment: 1 }, insightsRevision: { increment: 1 } } });
    assert.equal(settings.sessionsRevision, 1);
    assert.equal(settings.insightsRevision, 1);
    await pool.query(`SELECT "consistencyScore" FROM "RowingSession"`);
    await pool.query(`SELECT "feedback", "feedbackAt" FROM "AIInsight"`);
    await pool.query(`SELECT "colorPalette" FROM "GeneratedAchievement"`);
  } finally {
    await prisma.$disconnect();
  }
}

test('committed migrations support the current client on a fresh database', async () => {
  const dir = workspace();
  const pool = new Pool({ connectionString: target.href });
  try {
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`)).rows[0].count, 0, 'database must be fresh');
    deploy(dir, target.href);
    await exerciseClient(pool);
  } finally {
    await pool.end();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upgrade preserves existing counters and legacy memory bytes', async () => {
  const dir = workspace();
  const admin = new Pool({ connectionString: target.href });
  const name = `rowing_migration_test_upgrade_${process.pid}`;
  const upgrade = new URL(target);
  upgrade.pathname = '/' + name;
  const pool = new Pool({ connectionString: upgrade.href });
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    rmSync(path.join(dir, 'prisma/migrations', migration), { recursive: true, force: true });
    deploy(dir, upgrade.href);
    await pool.query(`INSERT INTO "User" (id, email, "updatedAt") VALUES ('existing', 'existing@example.invalid', NOW());
      INSERT INTO "MemoryDocument" (id, "userId", name, type, source, "mimeType", size) VALUES ('document', 'existing', 'legacy', 'file', 'upload', 'application/octet-stream', 3);
      INSERT INTO "MemoryBlob" (id, "documentId", data) VALUES ('blob', 'document', decode('010203', 'hex'));
      ALTER TABLE "UserSettings" ADD COLUMN "sessionsRevision" INTEGER NOT NULL DEFAULT 0;
      INSERT INTO "UserSettings" (id, "userId", "sessionsRevision", "timeZone", "updatedAt") VALUES ('settings', 'existing', 73, 'Europe/Berlin', NOW());`);
    cpSync(path.join('prisma/migrations', migration), path.join(dir, 'prisma/migrations', migration), { recursive: true });
    deploy(dir, upgrade.href);
    assert.equal((await pool.query(`SELECT "sessionsRevision" FROM "UserSettings" WHERE id = 'settings'`)).rows[0].sessionsRevision, 73);
    assert.equal((await pool.query(`SELECT "timeZone" FROM "UserSettings" WHERE id = 'settings'`)).rows[0].timeZone, 'Europe/Berlin');
    assert.equal((await pool.query(`SELECT encode(data, 'hex') AS bytes FROM "MemoryBlob" WHERE id = 'blob'`)).rows[0].bytes, '010203');
    await exerciseClient(pool);
  } finally {
    await pool.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    rmSync(dir, { recursive: true, force: true });
  }
});
