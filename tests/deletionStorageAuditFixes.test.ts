import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { get } from "@vercel/blob";
import { createRequire } from "node:module";
import { loadModule } from "./helpers/loadModule";
import * as avatars from "../src/lib/userAvatar";
import type { MocapStorage } from "../src/lib/mocap/storage";

type DeleteRoute = { DELETE: (req: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> };
const user = { id: "owner", image: "avatars/owner/8fe76a29-3e86-4ab9-b0f6-8821ce277bd5.png", role: "user", passwordHash: null };
const mocap = { id: "capture", videoStoragePath: "mocap/owner/capture/video.webm", poseStreamPath: "mocap/owner/capture/pose-stream.bin" };
const responseModule = { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };

for (const routeFile of ["src/app/api/user/delete/route.ts", "src/app/api/admin/users/[userId]/route.ts"]) {
  for (const failure of ["pose", "memory"]) {
    test(`${routeFile} retries ${failure} deletion failure before metadata removal`, async (t) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "account-delete-test-"));
      t.after(() => fs.rm(root, { recursive: true, force: true }));
      const localFiles = ["storage/memory/owner/note.pdf", "public/assets/awards/owner/trophy.png", "public/assets/awards/legacy.png", "storage/memory/another/note.pdf"];
      for (const file of localFiles) {
        await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await fs.writeFile(path.join(root, file), "private bytes");
      }
      const remaining = new Set([user.image, mocap.videoStoragePath, mocap.poseStreamPath]);
      let failPath: string | null = failure === "pose" ? mocap.poseStreamPath : null;
      let failLocal = failure === "memory";
      let metadataDeleted = false;
      let filesAtCascade: string[] = [];
      const storage = { delete: async (file: string) => {
        if (file === failPath) throw new Error("storage unavailable");
        remaining.delete(file);
      } };
      const prisma = {
        mocapSession: { findMany: async (query: { where: { userId: string } }) => {
          assert.equal(query.where.userId, user.id);
          return [mocap];
        } },
        user: {
          findUnique: async () => user,
          delete: async () => {
            filesAtCascade = [...remaining];
            for (const file of localFiles.slice(0, 2)) {
              if (await fs.stat(path.join(root, file)).then(() => true, () => false)) filesAtCascade.push(file);
            }
            metadataDeleted = true;
          },
        },
      };
      const dependencies = {
        "node:fs": { promises: { ...fs, rm: async (...args: Parameters<typeof fs.rm>) => {
          if (failLocal && String(args[0]).includes("storage/memory/owner")) throw new Error("disk unavailable");
          await fs.rm(...args);
        } } },
        "next/server": responseModule,
        "next-auth": { getServerSession: async () => ({ user: { id: user.id } }) },
        "@/lib/auth": { authOptions: {} },
        "@/lib/adminAuth": { requireAdmin: async () => null },
        "@/lib/rateLimit": { applyRateLimit: async () => null },
        "@/lib/db/prisma": { prisma },
        "@/lib/userAvatar": avatars,
        "@/lib/mocap/storage": { getMocapStorage: () => storage },
      };
      const route = loadModule<DeleteRoute>(routeFile, {
        ...dependencies,
        "@/lib/deleteUserFiles": { deleteUserFiles: async (account: typeof user) => {
          const helper = loadModule<{ deleteUserFiles: (account: typeof user) => Promise<void> }>("src/lib/deleteUserFiles.ts", dependencies, { process: { cwd: () => root } });
          await helper.deleteUserFiles(account);
        } },
      }, { console: { error: () => {} } });
      const request = () => new Request("https://example.test/api/user/delete", { method: "DELETE", body: JSON.stringify({ password: "password", confirmPhrase: "DELETE MY ACCOUNT" }) });
      const context = { params: Promise.resolve({ userId: user.id }) };
      assert.equal((await route.DELETE(request(), context)).status, 500);
      assert.equal(metadataDeleted, false);
      failPath = null;
      failLocal = false;
      assert.equal((await route.DELETE(request(), context)).status, 200);
      assert.equal(metadataDeleted, true);
      assert.deepEqual(filesAtCascade, [], "all files must be gone before user cascade");
      for (const file of localFiles.slice(2)) assert.equal(await fs.readFile(path.join(root, file), "utf8"), "private bytes");
    });
  }
}

test("mocap DELETE retains pointers after partial deletion and succeeds on retry", async () => {
  const remaining = new Set([mocap.videoStoragePath, mocap.poseStreamPath]);
  let fail = true;
  let metadataDeleted = false;
  const route = loadModule<DeleteRoute>("src/app/api/mocap/sessions/[id]/route.ts", {
    "next/server": responseModule,
    "next-auth": { getServerSession: async () => ({ user: { id: user.id } }) },
    "@/lib/auth": { authOptions: {} },
    "@/lib/db/prisma": { prisma: { mocapSession: {
      findFirst: async () => mocap,
      delete: async () => { metadataDeleted = true; },
    } } },
    "@/lib/mocap/storage": { getMocapStorage: () => ({ delete: async (file: string) => {
      if (file === mocap.poseStreamPath && fail) throw new Error("storage unavailable");
      remaining.delete(file);
    } }) },
  }, { console: { error: () => {} } });
  const request = new Request("https://example.test/api/mocap/sessions/capture", { method: "DELETE" });
  const context = { params: Promise.resolve({ id: mocap.id }) };
  assert.equal((await route.DELETE(request, context)).status, 500);
  assert.equal(metadataDeleted, false);
  fail = false;
  assert.equal((await route.DELETE(request, context)).status, 200);
  assert.equal(metadataDeleted, true);
  assert.equal(remaining.size, 0);
});

test("private blob reads authenticate through SDK and retain exclusive byte range semantics", async () => {
  const token = "vercel_blob_rw_teststore_synthetic";
  const bytes = Uint8Array.from([10, 20, 30, 40]);
  const requests: { url: URL; headers: Headers }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    requests.push({ url, headers });
    if (headers.get("authorization") !== `Bearer ${token}`) return new Response(null, { status: 403 });
    if (url.pathname.includes("missing")) return new Response(null, { status: 404 });
    const range = headers.get("Range");
    const match = range?.match(/^bytes=(\d+)-(\d*)$/);
    const selected = match ? bytes.slice(Number(match[1]), match[2] ? Number(match[2]) + 1 : undefined) : bytes;
    return new Response(selected, { status: range ? 206 : 200 });
  };
  const sdkPath = createRequire(path.resolve("package.json")).resolve("@vercel/blob");
  const sdk = loadModule<{ get: typeof get }>(sdkPath, { undici: { fetch: fakeFetch } }, { fetch: fakeFetch });
  const storageModule = loadModule<{ getMocapStorage: () => MocapStorage }>("src/lib/mocap/storage.ts", {
    "@vercel/blob": {
      get: (file: string, options: Parameters<typeof get>[1]) => sdk.get(file, { ...options, token }),
      head: async (file: string) => ({ url: `https://teststore.private.blob.vercel-storage.com/${file}` }),
    },
  }, { process: { env: { MOCAP_STORAGE_BACKEND: "vercel-blob" } }, fetch: fakeFetch });
  const storage = storageModule.getMocapStorage();
  assert.deepEqual(await storage.read("video"), bytes);
  assert.deepEqual(await storage.read("video", { start: 1, end: 3 }), Uint8Array.from([20, 30]));
  assert.deepEqual(await storage.read("video", { start: 2 }), Uint8Array.from([30, 40]));
  await assert.rejects(storage.read("missing"), /Failed to read blob/);
  assert.equal(requests[1].headers.get("Range"), "bytes=1-2");
  assert.equal(requests[2].headers.get("Range"), "bytes=2-");
  for (const request of requests) assert.equal(request.url.searchParams.get("cache"), "0");
});
