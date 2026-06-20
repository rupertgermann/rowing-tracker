/**
 * VideoUploader: serialises MediaRecorder chunks for append-upload to the
 * mocap video endpoint. Guarantees in-order POSTs even if the recorder fires
 * `dataavailable` faster than uploads complete, and lets stop() await drain.
 */

export class VideoUploader {
  private queue: Promise<void> = Promise.resolve();
  private bytesUploaded = 0;

  constructor(
    private readonly sessionId: string,
    private readonly onError?: (err: Error) => void,
  ) {}

  get totalBytes(): number {
    return this.bytesUploaded;
  }

  enqueue(chunk: Blob): void {
    if (chunk.size === 0) return;
    this.queue = this.queue.then(async () => {
      try {
        const res = await fetch(
          `/api/mocap/sessions/${this.sessionId}/video`,
          {
            method: "POST",
            body: chunk,
            headers: { "Content-Type": "application/octet-stream" },
          },
        );
        if (!res.ok) {
          throw new Error(`Video upload failed: ${res.status}`);
        }
        this.bytesUploaded += chunk.size;
      } catch (err) {
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async drain(): Promise<void> {
    await this.queue;
  }
}
