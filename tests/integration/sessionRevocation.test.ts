import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import { encode, type JWT } from 'next-auth/jwt';
import { loadModule } from '../helpers/loadModule';
import * as avatar from '../../src/lib/userAvatar';

const target = new URL(process.env.TEST_DATABASE_URL ?? '');
assert(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.equal(target.pathname, '/rowing_ticket129', 'disposable ticket database only');
const pools: Pool[] = [];
const database = () => {
  const pool = new Pool({ connectionString: target.href });
  pools.push(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
};
const writer = database();
const reader = database();
after(async () => { await writer.$disconnect(); await reader.$disconnect(); await Promise.all(pools.map(pool => pool.end())); });
const secret = 'synthetic-session-revocation-test-secret';
function auth(prisma: PrismaClient) {
  const { authOptions } = loadModule<{ authOptions: NextAuthOptions }>('src/lib/auth.ts', {
    '@/lib/db/prisma': { prisma }, '@/lib/userAvatar': avatar,
  });
  return { ...authOptions, secret, logger: { error() {}, warn() {}, debug() {} } };
}
const issuer = auth(writer);
const verifier = auth(reader);
async function login(email: string, password: string) {
  const provider = issuer.providers.find(p => p.id === 'credentials')!;
  const authorize = (provider as typeof provider & { options: { authorize: (credentials: { email: string; password: string }, req: object) => Promise<import('next-auth').User | null> } }).options.authorize;
  const user = await authorize({ email, password }, {});
  assert(user, 'login accepted');
  const token = await issuer.callbacks!.jwt!({ token: { id: user.id, sub: user.id }, user, account: null, trigger: 'signIn' });
  return encode({ token, secret });
}
async function session(cookie: string, options: NextAuthOptions = verifier) {
  return getServerSession({ headers: {}, cookies: { 'next-auth.session-token': cookie } } as never,
    { getHeader() {}, setHeader() {} } as never, options);
}
function routes(cookie: string) {
  const imports = {
    '@/lib/db/prisma': { prisma: writer }, '@/lib/auth': { authOptions: verifier },
    'next-auth': { getServerSession: (options: NextAuthOptions) => session(cookie, options) },
    '@/lib/rateLimit': { applyRateLimit: async () => null },
  };
  const files = loadModule('src/lib/deleteUserFiles.ts', {
    ...imports, '@/lib/userAvatar': avatar,
    '@/lib/mocap/storage': { getMocapStorage: () => ({ delete: async () => {} }) },
    'node:fs': { promises: { rm: async () => {} } },
  });
  const admin = loadModule('src/lib/adminAuth.ts', imports);
  return {
    adminChange: loadModule<{ PATCH(req: Request, context: { params: Promise<{ userId: string }> }): Promise<Response> }>('src/app/api/admin/users/[userId]/route.ts', { ...imports, '@/lib/adminAuth': admin, '@/lib/deleteUserFiles': files }).PATCH,
    remove: loadModule<{ DELETE(req: Request): Promise<Response> }>('src/app/api/user/delete/route.ts', { ...imports, '@/lib/deleteUserFiles': files }).DELETE,
    reset: loadModule<{ POST(req: Request): Promise<Response> }>('src/app/api/auth/reset-password/route.ts', imports).POST,
    change: loadModule<{ PATCH(req: Request): Promise<Response> }>('src/app/api/user/password/route.ts', imports).PATCH,
    data: loadModule<{ GET(): Promise<Response> }>('src/app/api/data-usage/route.ts', imports).GET,
  };
}
function request(body: object) { return new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) }); }
async function fixture() {
  return writer.user.create({ data: { email: `${randomUUID()}@example.invalid`, emailVerified: new Date(), passwordHash: await bcrypt.hash('old-password', 4) } });
}

test('password reset revokes the old cookie on another server; a new login accesses protected data', async () => {
  const user = await fixture();
  try {
    const cookie = await login(user.email, 'old-password');
    assert.equal((await routes(cookie).data()).status, 200);
    const token = randomUUID();
    await writer.passwordResetToken.create({ data: { email: user.email, token, expires: new Date(Date.now() + 60_000) } });
    assert.equal((await routes(cookie).reset(request({ token, password: 'new-password' }))).status, 200);
    assert.equal((await routes(cookie).data()).status, 401);
    assert.equal((await routes(await login(user.email, 'new-password')).data()).status, 200);
  } finally { await writer.user.delete({ where: { id: user.id } }); }
});

test('password change revokes even the requesting session and permits a new login', async () => {
  const user = await fixture();
  try {
    const cookie = await login(user.email, 'old-password');
    assert.equal((await routes(cookie).change(request({ currentPassword: 'old-password', newPassword: 'new-password' }))).status, 200);
    assert.equal((await routes(cookie).data()).status, 401);
    assert.equal((await routes(await login(user.email, 'new-password')).data()).status, 200);
  } finally { await writer.user.delete({ where: { id: user.id } }); }
});

test('an admin password reset revokes the target account sessions', async () => {
  const user = await fixture();
  const admin = await fixture();
  try {
    await writer.user.update({ where: { id: admin.id }, data: { role: 'admin' } });
    const cookie = await login(user.email, 'old-password');
    const response = await routes(await login(admin.email, 'old-password')).adminChange(request({ newPassword: 'new-password' }), { params: Promise.resolve({ userId: user.id }) });
    assert.equal(response.status, 200);
    assert.equal((await routes(cookie).data()).status, 401);
    assert.equal((await routes(await login(user.email, 'new-password')).data()).status, 200);
  } finally { await writer.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } }); }
});

test('account deletion denies the previously issued cookie on another server', async () => {
  const user = await fixture();
  try {
    const cookie = await login(user.email, 'old-password');
    assert.equal((await routes(cookie).remove(request({ password: 'old-password', confirmPhrase: 'DELETE MY ACCOUNT' }))).status, 200);
    assert.equal((await routes(cookie).data()).status, 401);
  } finally { await writer.user.deleteMany({ where: { id: user.id } }); }
});

test('legacy cookies without a version fail closed, including session updates', async () => {
  const user = await fixture();
  try {
    const token: JWT = { id: user.id, sub: user.id };
    assert.equal((await routes(await encode({ token, secret })).data()).status, 401);
    await assert.rejects(async () => verifier.callbacks!.jwt!({ token, trigger: 'update', session: {}, user: undefined as never, account: null }), /Session revoked/);
  } finally { await writer.user.delete({ where: { id: user.id } }); }
});

test('a rejected password change leaves the existing session usable', async () => {
  const user = await fixture();
  try {
    const cookie = await login(user.email, 'old-password');
    assert.equal((await routes(cookie).change(request({ currentPassword: 'wrong-password', newPassword: 'new-password' }))).status, 400);
    assert.equal((await routes(cookie).data()).status, 200);
  } finally { await writer.user.delete({ where: { id: user.id } }); }
});

test('database unavailability does not authorize an otherwise valid cookie', async () => {
  const user = await fixture();
  const pool = new Pool({ host: '127.0.0.1', port: 1, database: 'rowing_ticket129', connectionTimeoutMillis: 500 });
  const unavailable = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    assert.equal(await session(await login(user.email, 'old-password'), auth(unavailable)), null);
  } finally {
    await unavailable.$disconnect();
    await pool.end();
    await writer.user.delete({ where: { id: user.id } });
  }
});
