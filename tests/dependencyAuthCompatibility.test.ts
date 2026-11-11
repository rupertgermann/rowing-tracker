import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import NextAuth, { type NextAuthOptions } from 'next-auth';
import type { NextApiResponse } from 'next';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { loadModule } from './helpers/loadModule';
import * as avatar from '../src/lib/userAvatar';

// Exercise the configured auth handler with an in-memory database and mail boundary.
function authHarness() {
  const deliveries: string[] = [];
  const { authOptions } = loadModule<{ authOptions: NextAuthOptions }>('src/lib/auth.ts', {
    '@auth/prisma-adapter': { PrismaAdapter: () => ({
      getUserByEmail: async () => null,
      useVerificationToken: async () => null,
      createVerificationToken: async (token: unknown) => token,
    }) },
    '@/lib/db/prisma': { prisma: { user: { findUnique: async () => ({ id: 'alice', email: 'alice@example.com', emailVerified: new Date(), passwordHash: bcrypt.hashSync('correct-password', 4), role: 'user', sessionVersion: 0 }) } } },
    '@/lib/userAvatar': avatar,
  }, { process: { env: { NODE_ENV: 'test', GOOGLE_CLIENT_ID: 'synthetic-client', GOOGLE_CLIENT_SECRET: 'synthetic-secret' } } });
  const email = authOptions.providers.find(provider => provider.id === 'email');
  assert.ok(email && email.type === 'email');
  email.options = { ...email.options, sendVerificationRequest: async ({ identifier }) => { deliveries.push(identifier); } };
  const handler = NextAuth({ ...authOptions, secret: 'synthetic-dependency-test-secret', logger: { error() {}, warn() {} } });
  const cookies: Record<string, string> = {};
  async function request(action: string[], body?: Record<string, string>) {
    const headers = new Map<string, string | string[]>();
    let data: unknown;
    let status = 200;
    const response = {
      status(code: number) { status = code; return response; },
      getHeader(name: string) { return headers.get(name); },
      setHeader(name: string, value: string | string[]) { headers.set(name, value); return response; },
      send(value: unknown) { data = value; },
      json(value: unknown) { data = value; },
      end() {},
    };
    const req = Object.assign(new IncomingMessage(new Socket()), {
      query: { nextauth: action }, method: body ? 'POST' : 'GET', body, cookies, env: {},
      headers: { host: 'localhost:43124' },
    });
    await handler(req, response as unknown as NextApiResponse);
    for (const cookie of [headers.get('Set-Cookie')].flat().filter((value): value is string => !!value)) {
      const [name, value] = cookie.split(';')[0].split('=');
      cookies[name] = decodeURIComponent(value);
    }
    return { data, status, headers };
  }
  return { request, deliveries };
}

test('magic-link sign-in rejects an extra Unicode at-sign before sending email', async () => {
  const auth = authHarness();
  const csrf = await auth.request(['csrf']);
  const { csrfToken } = csrf.data as { csrfToken: string };
  assert.ok(csrfToken);
  const result = await auth.request(['signin', 'email'], { csrfToken, email: 'victim@example.com＠attacker.example', json: 'true' });
  assert.deepEqual(auth.deliveries, []);
  assert.match(JSON.stringify(result.data), /error/i);
});

test('magic-link sign-in still delivers a normalized ordinary email', async () => {
  const auth = authHarness();
  const csrf = await auth.request(['csrf']);
  const { csrfToken } = csrf.data as { csrfToken: string };
  const result = await auth.request(['signin', 'email'], { csrfToken, email: ' Alice@Example.com ', json: 'true' });
  assert.deepEqual(auth.deliveries, ['alice@example.com']);
  assert.match(JSON.stringify(result.data), /verify-request/);
});

test('password sign-in establishes a session and rejects the wrong password', async () => {
  const auth = authHarness();
  const csrf = await auth.request(['csrf']);
  const { csrfToken } = csrf.data as { csrfToken: string };
  const bad = await auth.request(['callback', 'credentials'], { csrfToken, email: 'alice@example.com', password: 'wrong-password', json: 'true' });
  assert.match(JSON.stringify(bad.data), /CredentialsSignin/);
  await auth.request(['callback', 'credentials'], { csrfToken, email: 'alice@example.com', password: 'correct-password', json: 'true' });
  const session = await auth.request(['session']);
  assert.equal((session.data as { user: { id: string } }).user.id, 'alice');
});

test('mail transport preserves the verification recipient and link', async () => {
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: 'no-reply@example.com', to: 'alice@example.com', subject: 'Sign in',
    text: 'http://localhost:43124/api/auth/callback/email?token=synthetic-token',
  });
  assert.deepEqual(result.envelope.to, ['alice@example.com']);
  assert.match(result.message.toString(), /token=synthetic-token/);
});

test('configured OAuth remains discoverable through the auth provider endpoint', async () => {
  const { request } = authHarness();
  const result = await request(['providers']);
  const providers = result.data as Record<string, { type: string; signinUrl: string }>;
  assert.equal(providers.google.type, 'oauth');
  assert.match(providers.google.signinUrl, /api\/auth\/signin\/google$/);
});
