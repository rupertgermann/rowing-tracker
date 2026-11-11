import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadModule } from "../helpers/loadModule";
import type * as SettingsDefaults from "../../src/lib/server/userSettings";
import type * as SettingsValidation from "../../src/lib/validations/settings";
import type * as RateLimit from "../../src/lib/rateLimit";

test("failed registration can be retried; existing incomplete accounts recover only after authentication", async () => {
  const target = new URL(process.env.TEST_DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "local test database only");
  assert.equal(target.pathname, "/rowing_registration_test", "use a disposable registration database");
  const adminUrl = new URL(target);
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.href });
  const pool = new Pool({ connectionString: target.href });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let created = false;
  try {
    await admin.query('CREATE DATABASE "rowing_registration_test"');
    created = true;
    execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", DATABASE_URL: target.href, DIRECT_URL: target.href },
      stdio: "pipe",
    });
    const defaults = loadModule<typeof SettingsDefaults>("src/lib/server/userSettings.ts", { "@/lib/db/prisma": { prisma } });
    const rateLimit = loadModule<typeof RateLimit>("src/lib/rateLimit.ts", {}, { process: { env: {} } });
    const register = loadModule<{ POST(req: Request): Promise<Response> }>("src/app/api/auth/register/route.ts", {
      "@/lib/db/prisma": { prisma },
      "@/lib/server/userSettings": defaults,
      "@/lib/rateLimit": rateLimit,
    });
    let userId: string | undefined;
    const settings = loadModule<{ GET(): Promise<Response>; POST(req: Request): Promise<Response> }>("src/app/api/settings/route.ts", {
      "@/lib/db/prisma": { prisma },
      "@/lib/server/userSettings": defaults,
      "@/lib/validations/settings": loadModule<typeof SettingsValidation>("src/lib/validations/settings.ts", {}),
      "next-auth": { getServerSession: async () => userId ? { user: { id: userId } } : null },
      "@/lib/auth": { authOptions: {} },
    });
    const signup = (email: string) => register.POST(new Request("http://localhost/api/auth/register", {
      method: "POST", body: JSON.stringify({ email, name: "Rower", password: "test-password-138" }),
    }));

    // A database constraint forces the real settings insert to fail, including inside a transaction.
    await pool.query(`ALTER TABLE "UserSettings" ADD CONSTRAINT registration_failure CHECK ("maxTokens" < 0)`);
    assert.equal((await signup("retry@example.invalid")).status, 500);
    await pool.query(`ALTER TABLE "UserSettings" DROP CONSTRAINT registration_failure`);
    const retry = await signup("retry@example.invalid");
    assert.equal(retry.status, 200, "retry must succeed because the failed signup left no account");
    userId = (await retry.json()).id;
    const initial = (await (await settings.GET()).json()).settings;
    assert.equal(initial.userId, userId, "successful registration persisted settings");
    assert.equal(initial.maxTokens, 4000);
    assert.equal(initial.cloudAIEnabled, false);
    assert.equal(initial.theme, "system");

    // Seed a legacy account without settings to exercise the existing authenticated recovery policy.
    const legacy = await prisma.user.create({ data: { email: "legacy@example.invalid", name: "Original owner" } });
    assert.equal((await signup(legacy.email)).status, 400, "registration cannot replace an existing account");
    userId = undefined;
    assert.equal((await settings.POST(new Request("http://localhost/api/settings", { method: "POST", body: "{}" }))).status, 401);
    userId = legacy.id;
    assert.equal((await settings.POST(new Request("http://localhost/api/settings", { method: "POST", body: JSON.stringify({ theme: "dark" }) }))).status, 200);
    const recovered = (await (await settings.GET()).json()).settings;
    assert.equal(recovered.userId, legacy.id);
    assert.equal(recovered.theme, "dark");
    assert.equal(recovered.maxTokens, 4000);
    assert.equal((await signup(legacy.email)).status, 400);
  } finally {
    await prisma.$disconnect();
    await pool.end();
    if (created) await admin.query('DROP DATABASE "rowing_registration_test" WITH (FORCE)');
    await admin.end();
  }
});
