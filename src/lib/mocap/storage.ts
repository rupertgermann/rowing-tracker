import { promises as fs } from "node:fs";
import path from "node:path";
import { BlobNotFoundError, del, get, head, list, put } from "@vercel/blob";
import { z } from "zod";

export type ByteRange = { start: number; end?: number };

export interface MocapStorage {
  videoPath(userId: string, sessionId: string): string;
  poseStreamPath(userId: string, sessionId: string): string;
  appendBytes(storagePath: string, bytes: Uint8Array): Promise<void>;
  writeAt(storagePath: string, bytes: Uint8Array, offset: number): Promise<void>;
  read(storagePath: string, range?: ByteRange): Promise<Uint8Array>;
  size(storagePath: string): Promise<number>;
  exists(storagePath: string): Promise<boolean>;
  delete(storagePath: string): Promise<void>;
}

const MOCAP_ROOT = "mocap";

export class LocalDiskStorage implements MocapStorage {
  constructor(private readonly root: string) {}

  videoPath(userId: string, sessionId: string): string {
    return path.posix.join(MOCAP_ROOT, userId, sessionId, "video.webm");
  }

  poseStreamPath(userId: string, sessionId: string): string {
    return path.posix.join(MOCAP_ROOT, userId, sessionId, "pose-stream.bin");
  }

  private resolve(storagePath: string): string {
    const abs = path.resolve(this.root, storagePath);
    const rootAbs = path.resolve(this.root);
    if (!abs.startsWith(rootAbs + path.sep) && abs !== rootAbs) {
      throw new Error(`Path escapes storage root: ${storagePath}`);
    }
    return abs;
  }

  async appendBytes(storagePath: string, bytes: Uint8Array): Promise<void> {
    const abs = this.resolve(storagePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const file = await fs.open(abs, "a+");
    const previousSize = (await file.stat()).size;
    try {
      await file.writeFile(bytes);
    } catch (error) {
      await file.truncate(previousSize);
      throw error;
    } finally {
      await file.close();
    }
  }

  async writeAt(
    storagePath: string,
    bytes: Uint8Array,
    offset: number,
  ): Promise<void> {
    const abs = this.resolve(storagePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const fh = await fs.open(abs, "r+");
    try {
      await fh.write(bytes, 0, bytes.byteLength, offset);
    } finally {
      await fh.close();
    }
  }

  async read(storagePath: string, range?: ByteRange): Promise<Uint8Array> {
    const abs = this.resolve(storagePath);
    if (!range) {
      const buf = await fs.readFile(abs);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const fh = await fs.open(abs, "r");
    try {
      const stat = await fh.stat();
      const end = range.end ?? stat.size;
      const length = Math.max(0, end - range.start);
      const buf = Buffer.alloc(length);
      if (length > 0) {
        await fh.read(buf, 0, length, range.start);
      }
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } finally {
      await fh.close();
    }
  }

  async size(storagePath: string): Promise<number> {
    const abs = this.resolve(storagePath);
    const stat = await fs.stat(abs);
    return stat.size;
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(storagePath));
      return true;
    } catch {
      return false;
    }
  }

  async delete(storagePath: string): Promise<void> {
    const abs = this.resolve(storagePath);
    await fs.rm(abs, { force: true });
    const dir = path.dirname(abs);
    try {
      const entries = await fs.readdir(dir);
      if (entries.length === 0) {
        await fs.rmdir(dir);
      }
    } catch {
      // ignore
    }
  }
}

const chunkIndexSchema = z.object({
  count: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  baseSize: z.number().int().nonnegative(),
});
type ChunkIndex = z.infer<typeof chunkIndexSchema>;
type StoredChunk = { pathname: string; size: number };

class VercelBlobStorage implements MocapStorage {
  videoPath(userId: string, sessionId: string): string {
    return path.posix.join(MOCAP_ROOT, userId, sessionId, "video.webm");
  }

  poseStreamPath(userId: string, sessionId: string): string {
    return path.posix.join(MOCAP_ROOT, userId, sessionId, "pose-stream.bin");
  }

  async appendBytes(storagePath: string, bytes: Uint8Array): Promise<void> {
    if (bytes.byteLength === 0) return;
    const index = await this.readIndex(storagePath);
    if (!index && !(await this.exists(storagePath))) {
      await this.putBytes(storagePath, bytes);
      return;
    }
    const baseSize = index?.baseSize ?? (await head(storagePath)).size;
    const count = index?.count ?? 0;
    const partPath = `${storagePath}.parts/${String(count).padStart(12, "0")}`;
    await this.putBytes(partPath, bytes);
    const proposed = { count: count + 1, size: (index?.size ?? baseSize) + bytes.byteLength, baseSize };
    try {
      await put(`${storagePath}.parts/index.json`, JSON.stringify(proposed), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    } catch (error) {
      // A failed response may still have published the index: never delete a referenced part.
      const published = await this.readIndex(storagePath);
      if (published?.count === proposed.count && published.size === proposed.size && published.baseSize === proposed.baseSize) return;
      if (!published || published.count <= count) await del(partPath);
      throw error;
    }
  }

  async writeAt(storagePath: string, bytes: Uint8Array, offset: number): Promise<void> {
    const index = await this.readIndex(storagePath);
    const chunks = index
      ? await this.chunks(storagePath, index)
      : [{ pathname: storagePath, size: (await head(storagePath)).size }];
    const total = index?.size ?? chunks[0].size;
    if (offset < 0 || offset + bytes.byteLength > total) {
      throw new Error(`writeAt outside blob bounds for ${storagePath}`);
    }
    let position = 0;
    for (const chunk of chunks) {
      const start = Math.max(offset, position);
      const end = Math.min(offset + bytes.byteLength, position + chunk.size);
      if (end > start) {
        const updated = await this.readBlob(chunk.pathname);
        updated.set(bytes.subarray(start - offset, end - offset), start - position);
        await this.putBytes(chunk.pathname, updated);
      }
      position += chunk.size;
    }
  }

  async read(storagePath: string, range?: ByteRange): Promise<Uint8Array> {
    const index = await this.readIndex(storagePath);
    if (!index || (range && (range.end ?? index.size) <= index.baseSize)) {
      return this.readBlob(storagePath, range);
    }
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? index.size, index.size);
    const bytes = new Uint8Array(Math.max(0, end - start));
    let position = 0;
    const reads: { pathname: string; start: number; end: number; offset: number }[] = [];
    for (const chunk of await this.chunks(storagePath, index)) {
      const from = Math.max(start, position);
      const to = Math.min(end, position + chunk.size);
      if (to > from) reads.push({ pathname: chunk.pathname, start: from - position, end: to - position, offset: from - start });
      position += chunk.size;
    }
    for (let i = 0; i < reads.length; i += 8) {
      await Promise.all(reads.slice(i, i + 8).map(async (chunk) => {
        bytes.set(await this.readBlob(chunk.pathname, chunk), chunk.offset);
      }));
    }
    return bytes;
  }

  async size(storagePath: string): Promise<number> {
    return (await this.readIndex(storagePath))?.size ?? (await head(storagePath)).size;
  }

  private async readBlob(storagePath: string, range?: ByteRange): Promise<Uint8Array> {
    const headers: HeadersInit = {};
    if (range) {
      const end = range.end === undefined ? "" : String(range.end - 1);
      headers.Range = `bytes=${range.start}-${end}`;
    }
    const result = await get(storagePath, { access: "private", useCache: false, headers });
    if (!result || result.statusCode !== 200) {
      throw new Error(`Failed to read blob ${storagePath}: ${result?.statusCode ?? 404}`);
    }
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }

  private async readIndex(storagePath: string): Promise<ChunkIndex | null> {
    const result = await get(`${storagePath}.parts/index.json`, { access: "private", useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw new Error(`Failed to read chunk index for ${storagePath}`);
    return chunkIndexSchema.parse(await new Response(result.stream).json());
  }

  private async listParts(storagePath: string): Promise<StoredChunk[]> {
    const chunks: StoredChunk[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `${storagePath}.parts/`, cursor });
      chunks.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return chunks;
  }

  private async chunks(storagePath: string, index: ChunkIndex): Promise<StoredChunk[]> {
    const prefix = `${storagePath}.parts/`;
    const parts = (await this.listParts(storagePath)).filter(chunk => {
      const suffix = chunk.pathname.slice(prefix.length);
      return /^\d{12}$/.test(suffix) && Number(suffix) < index.count;
    }).sort((a, b) => a.pathname.localeCompare(b.pathname));
    if (parts.length !== index.count || parts.reduce((sum, part) => sum + part.size, index.baseSize) !== index.size) {
      throw new Error(`Incomplete recording chunks for ${storagePath}`);
    }
    return [{ pathname: storagePath, size: index.baseSize }, ...parts];
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await head(storagePath);
      return true;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return false;
      throw error;
    }
  }

  async delete(storagePath: string): Promise<void> {
    const indexPath = `${storagePath}.parts/index.json`;
    const allParts = await this.listParts(storagePath);
    const parts = allParts.filter(part => part.pathname !== indexPath);
    if (parts.length) await del(parts.map(part => part.pathname));
    if (await this.exists(storagePath)) await del(storagePath);
    if (allParts.some(part => part.pathname === indexPath)) await del(indexPath);
  }

  private async putBytes(storagePath: string, bytes: Uint8Array): Promise<void> {
    await put(storagePath, Buffer.from(bytes), {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/octet-stream",
    });
  }
}

let instance: MocapStorage | null = null;

export function getMocapStorage(): MocapStorage {
  if (instance) return instance;

  const backend = process.env.MOCAP_STORAGE_BACKEND ?? "local";
  if (backend === "local") {
    const root = process.env.MOCAP_STORAGE_ROOT
      ? path.resolve(process.env.MOCAP_STORAGE_ROOT)
      : path.resolve(process.cwd(), "storage");
    instance = new LocalDiskStorage(root);
    return instance;
  }

  if (backend === "vercel-blob") {
    instance = new VercelBlobStorage();
    return instance;
  }

  throw new Error(`Unknown MOCAP_STORAGE_BACKEND="${backend}"`);
}
