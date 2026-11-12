export class InputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Count actual streamed bytes; Content-Length is only an early rejection hint. */
export async function readBoundedBody(req: Request, maxBytes: number): Promise<Uint8Array> {
  const tooLarge = () => new InputError(`Request exceeds the ${maxBytes} byte upload limit`, 413);
  if (Number(req.headers.get('content-length')) > maxBytes) {
    await req.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw tooLarge();
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof InputError) throw error;
    throw new InputError('Upload interrupted; please retry');
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readBoundedJson(req: Request, maxBytes: number): Promise<unknown> {
  const bytes = await readBoundedBody(req, maxBytes);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new InputError('Invalid JSON request body'); }
}
