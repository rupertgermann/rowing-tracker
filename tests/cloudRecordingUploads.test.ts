import assert from "node:assert/strict";
import { test } from "node:test";
import { loadModule } from "./helpers/loadModule";
import type { MocapStorage } from "../src/lib/mocap/storage";
import { VideoUploader } from "../src/lib/mocap/videoUploader";
import { appendPoseFrames, finalizePoseStreamBlob, initializePoseStreamBlob } from "../src/lib/mocap/capturePersistence";
import { BYTES_PER_FRAME_V1, HEADER_SIZE, decodeHeader } from "../src/lib/mocap/poseFrameStream";
import { BlobNotFoundError } from "@vercel/blob";

function cloud() {
  const objects = new Map<string, Uint8Array>();
  const writes: { path: string; bytes: number; json: boolean }[] = [];
  const reads: string[] = [];
  let failIndex = false;
  let failHead = false;
  const sdk = {
    BlobNotFoundError,
    put: async (file: string, bytes: Uint8Array | string, options: { contentType: string }) => {
      if (failIndex && options.contentType === "application/json") throw new Error("index unavailable");
      const payload = typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
      objects.set(file, payload);
      writes.push({ path: file, bytes: payload.length, json: options.contentType === "application/json" });
    },
    get: async (file: string, options: { headers?: Record<string, string> }) => {
      reads.push(file);
      const bytes = objects.get(file);
      if (!bytes) return null;
      const range = options.headers?.Range?.match(/^bytes=(\d+)-(\d*)$/);
      const selected = range ? bytes.slice(Number(range[1]), range[2] ? Number(range[2]) + 1 : undefined) : bytes;
      return { statusCode: 200, stream: new Response(new Uint8Array(selected)).body };
    },
    head: async (file: string) => {
      if (failHead) throw new Error("metadata unavailable");
      const bytes = objects.get(file);
      if (!bytes) throw new BlobNotFoundError();
      return { size: bytes.length };
    },
    list: async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
      const entries = [...objects].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
      const offset = Number(cursor ?? 0);
      const blobs = entries.slice(offset, offset + 2).map(([pathname, bytes]) => ({ pathname, size: bytes.length }));
      const hasMore = offset + 2 < entries.length;
      return { blobs, hasMore, cursor: hasMore ? String(offset + 2) : undefined };
    },
    del: async (files: string | string[]) => {
      for (const file of Array.isArray(files) ? files : [files]) objects.delete(file);
    },
  };
  const storage = () => loadModule<{ getMocapStorage(): MocapStorage }>("src/lib/mocap/storage.ts", {
    "@vercel/blob": sdk,
  }, { process: { env: { MOCAP_STORAGE_BACKEND: "vercel-blob" } } }).getMocapStorage();
  return { storage, objects, writes, reads, failIndex: (fail: boolean) => { failIndex = fail; }, failHead: (fail: boolean) => { failHead = fail; } };
}

test("cloud video uploads send each chunk once without downloading previous recording bytes", async (t) => {
  const fixture = cloud();
  const file = "mocap/owner/capture/video.webm";
  const row = { id: "capture", status: "capturing", videoStoragePath: file };
  const db = { mocapSession: { findFirst: async () => row }, $queryRaw: async () => [row] };
  const prisma = { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) };
  const upload = loadModule('src/lib/mocap/captureUpload.ts', {
    '@/lib/db/prisma': { prisma }, './storage': { getMocapStorage: fixture.storage },
  });
  const route = loadModule<{ POST(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> }>(
    "src/app/api/mocap/sessions/[id]/video/route.ts", {
      "next/server": { NextResponse: { json: Response.json } },
      "next-auth": { getServerSession: async () => ({ user: { id: "owner" } }) },
      "@/lib/auth": { authOptions: {} },
      "@/lib/mocap/captureUpload": upload,
      "@/lib/db/prisma": { prisma: { mocapSession: { findFirst: async () => ({ id: "capture", status: "capturing", videoStoragePath: file }) } } },
      "@/lib/mocap/storage": { getMocapStorage: fixture.storage },
    });
  t.mock.method(globalThis, "fetch", async (_input: string, init: RequestInit) => route.POST(
    new Request("http://localhost/api/video", init), { params: Promise.resolve({ id: "capture" }) },
  ));
  const errors: Error[] = [];
  const uploader = new VideoUploader("capture", error => errors.push(error));
  for (let i = 0; i < 6; i++) uploader.enqueue(new Blob([Uint8Array.from([i, i])]));
  await uploader.drain();

  assert.deepEqual(errors, []);
  assert.equal(uploader.totalBytes, 12);
  assert.equal(fixture.writes.filter(write => !write.json).reduce((sum, write) => sum + write.bytes, 0), 12);
  assert.equal(fixture.reads.filter(read => !read.endsWith("index.json")).length, 0);
  assert.ok(fixture.writes.filter(write => write.json).every(write => write.bytes < 128));
  assert.equal(await fixture.storage().size(file), 12);
  assert.deepEqual(await fixture.storage().read(file), Uint8Array.from([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]));
  assert.deepEqual(await fixture.storage().read(file, { start: 1, end: 5 }), Uint8Array.from([0, 1, 1, 2]));
});

test("a corrupt cloud index is rejected without overwriting recording data", async () => {
  const fixture = cloud();
  const file = "mocap/owner/capture/video.webm";
  await fixture.storage().appendBytes(file, Uint8Array.of(1));
  fixture.objects.set(`${file}.parts/index.json`, new TextEncoder().encode('{"count":"bad"}'));
  const before = fixture.writes.length;
  await assert.rejects(fixture.storage().appendBytes(file, Uint8Array.of(2)));
  await assert.rejects(fixture.storage().read(file));
  assert.equal(fixture.writes.length, before);
  assert.deepEqual(fixture.objects.get(file), Uint8Array.of(1));
});

test("cloud metadata failures never overwrite a recording or falsely finish deletion", async () => {
  const fixture = cloud();
  const file = "mocap/owner/capture/video.webm";
  await fixture.storage().appendBytes(file, Uint8Array.of(1));
  fixture.failHead(true);
  await assert.rejects(fixture.storage().appendBytes(file, Uint8Array.of(2)), /metadata unavailable/);
  assert.deepEqual(fixture.objects.get(file), Uint8Array.of(1));
  fixture.failHead(false);
  await fixture.storage().appendBytes(file, Uint8Array.of(3));
  fixture.failHead(true);
  await assert.rejects(fixture.storage().delete(file), /metadata unavailable/);
  assert.ok(fixture.objects.has(file));
  assert.ok(fixture.objects.has(`${file}.parts/index.json`));
  fixture.failHead(false);
  await fixture.storage().delete(file);
  assert.equal(fixture.objects.size, 0);
});

test("cloud pose finalization patches only its header and deletes every chunk", async () => {
  const fixture = cloud();
  const storage = fixture.storage();
  const file = storage.poseStreamPath("owner", "capture");
  await initializePoseStreamBlob(storage, file, 30);
  for (let i = 0; i < 4; i++) await appendPoseFrames(fixture.storage(), file, new Uint8Array(BYTES_PER_FRAME_V1));
  const before = fixture.writes.length;
  assert.equal((await finalizePoseStreamBlob(fixture.storage(), file)).frameCount, 4);
  assert.equal(fixture.writes.slice(before).filter(write => !write.json).reduce((sum, write) => sum + write.bytes, 0), HEADER_SIZE);
  assert.equal(decodeHeader(await storage.read(file, { start: 0, end: HEADER_SIZE })).frameCount, 4);
  assert.equal((await storage.read(file)).length, HEADER_SIZE + 4 * BYTES_PER_FRAME_V1);
  await storage.delete(file);
  await storage.delete(file);
  assert.equal(fixture.objects.size, 0);
});

test("unpublished cloud chunks are ignored, replaceable and cleaned up", async () => {
  const fixture = cloud();
  const file = "mocap/owner/capture/video.webm";
  await fixture.storage().appendBytes(file, Uint8Array.of(1));
  fixture.failIndex(true);
  await assert.rejects(fixture.storage().appendBytes(file, Uint8Array.of(2)), /index unavailable/);
  assert.deepEqual(await fixture.storage().read(file), Uint8Array.of(1));
  assert.equal(fixture.objects.size, 1);
  fixture.failIndex(false);
  await fixture.storage().appendBytes(file, Uint8Array.of(3));
  assert.deepEqual(await fixture.storage().read(file), Uint8Array.of(1, 3));
  fixture.failIndex(true);
  await assert.rejects(fixture.storage().appendBytes(file, Uint8Array.of(4)), /index unavailable/);
  await fixture.storage().delete(file);
  assert.equal(fixture.objects.size, 0);
});
