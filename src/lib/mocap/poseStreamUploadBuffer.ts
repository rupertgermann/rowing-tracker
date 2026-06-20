export interface PoseStreamUploadBufferOptions {
  sessionId: string;
  flushBytes: number;
  onError?: (err: Error) => void;
}

export class PoseStreamUploadBuffer {
  private pendingChunks: Uint8Array[] = [];
  private pendingBytes = 0;
  private uploadInflight: Promise<void> = Promise.resolve();

  constructor(private readonly opts: PoseStreamUploadBufferOptions) {}

  enqueue(bytes: Uint8Array): void {
    this.pendingChunks.push(bytes);
    this.pendingBytes += bytes.byteLength;
    if (this.pendingBytes >= this.opts.flushBytes) {
      void this.flush(false);
    }
  }

  async drain(): Promise<void> {
    await this.flush(true);
  }

  async flush(final: boolean): Promise<void> {
    if (this.pendingChunks.length === 0) {
      if (final) await this.uploadInflight;
      return;
    }
    const chunks = this.pendingChunks;
    const total = this.pendingBytes;
    this.pendingChunks = [];
    this.pendingBytes = 0;

    const buf = new Uint8Array(total);
    let off = 0;
    for (const chunk of chunks) {
      buf.set(chunk, off);
      off += chunk.byteLength;
    }

    this.uploadInflight = this.uploadInflight.then(() =>
      this.upload(buf).catch((err) => {
        this.opts.onError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }),
    );
    if (final) await this.uploadInflight;
  }

  private async upload(buf: Uint8Array): Promise<void> {
    const res = await fetch(
      `/api/mocap/sessions/${this.opts.sessionId}/pose-stream`,
      {
        method: "POST",
        body: new Blob([buf as BlobPart], {
          type: "application/octet-stream",
        }),
        headers: { "Content-Type": "application/octet-stream" },
      },
    );
    if (!res.ok) {
      throw new Error(`Pose upload failed: ${res.status}`);
    }
  }
}
