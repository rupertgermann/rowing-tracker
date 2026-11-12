import { INGESTION_LIMITS } from './ingestionLimits';

export function createSessionUploadBatches<T extends { id?: string; strokeData?: unknown[] }>(
  sessions: T[],
  chunkSize = 25,
): { sessions: T[]; json: string[] }[] {
  chunkSize = Math.min(INGESTION_LIMITS.sessions, Math.max(1, Math.floor(chunkSize || 25)));
  const chunks: { sessions: T[]; json: string[] }[] = [];
  const encoder = new TextEncoder();
  const envelopeBytes = encoder.encode('{"sessions":[]}').length;
  let chunk = { sessions: [] as T[], json: [] as string[] };
  let bytes = envelopeBytes;
  let strokes = 0;
  for (const session of sessions) {
    const json = JSON.stringify(session);
    const sessionBytes = encoder.encode(json).length;
    const sessionStrokes = session.strokeData?.length ?? 0;
    if (sessionBytes + envelopeBytes > INGESTION_LIMITS.sessionBodyBytes || sessionStrokes > INGESTION_LIMITS.strokes) {
      throw new Error(`Workout ${session.id} exceeds the upload limit; split its stroke data into smaller workouts before importing.`);
    }
    if (chunk.sessions.length && (chunk.sessions.length >= chunkSize ||
      bytes + 1 + sessionBytes > INGESTION_LIMITS.sessionBodyBytes || strokes + sessionStrokes > INGESTION_LIMITS.strokes)) {
      chunks.push(chunk);
      chunk = { sessions: [], json: [] };
      bytes = envelopeBytes;
      strokes = 0;
    }
    bytes += sessionBytes + (chunk.sessions.length ? 1 : 0);
    strokes += sessionStrokes;
    chunk.sessions.push(session);
    chunk.json.push(json);
  }
  if (chunk.sessions.length) chunks.push(chunk);
  return chunks;
}
