import { promises as fs } from "node:fs";
import path from "node:path";

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

class LocalDiskStorage implements MocapStorage {
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
    await fs.appendFile(abs, bytes);
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

  // Vercel Blob backend: deferred. Add @vercel/blob dependency and a
  // VercelBlobStorage class implementing MocapStorage. Append uses overwrite
  // via put({allowOverwrite: true}); byte-range read via fetch with Range header.
  throw new Error(
    `MOCAP_STORAGE_BACKEND="${backend}" not implemented. Set MOCAP_STORAGE_BACKEND=local for now.`,
  );
}
