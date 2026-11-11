import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { applyRateLimit } from '@/lib/rateLimit';
import { INGESTION_LIMITS as limits } from '@/lib/ingestionLimits';
import { InputError, readBoundedBody } from '@/lib/server/requestBody';
import { getMocapStorage } from './storage';
import { appendPoseFrames } from './capturePersistence';
import { decodeHeader, HEADER_SIZE } from './poseFrameStream';

type UploadSession = { id: string; status: string; videoStoragePath: string; poseStreamPath: string };

export async function uploadCaptureChunk(req: Request, userId: string, id: string, kind: 'pose' | 'video') {
  const limited = await applyRateLimit(req, userId, 'capture');
  if (limited) return limited;
  try {
    const owned = await prisma.mocapSession.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) throw new InputError('Not found', 404);
    const bytes = await readBoundedBody(req, kind === 'pose' ? limits.poseChunkBytes : limits.videoChunkBytes);
    const storage = getMocapStorage();
    // Serialize size-check + append across app instances and against lifecycle status changes.
    const appended = await prisma.$transaction(async tx => {
      const [row] = await tx.$queryRaw<UploadSession[]>`SELECT "id", "status", "videoStoragePath", "poseStreamPath" FROM "MocapSession" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`;
      if (!row) throw new InputError('Not found', 404);
      if (row.status !== 'capturing') throw new InputError('Session is no longer capturing', 409);
      const path = kind === 'pose' ? row.poseStreamPath : row.videoStoragePath;
      const size = await storage.exists(path) ? await storage.size(path) : 0;
      let maxBytes: number = limits.videoBytes;
      if (kind === 'pose') {
        if (size < HEADER_SIZE) throw new InputError('Pose stream unavailable', 409);
        const header = decodeHeader(await storage.read(path, { start: 0, end: HEADER_SIZE }));
        maxBytes = Math.min(limits.poseBytes, HEADER_SIZE + Math.ceil(limits.recordingSeconds * header.fps) * header.bytesPerFrame);
      }
      if (size + bytes.byteLength > maxBytes) {
        throw new InputError(kind === 'pose'
          ? 'Pose recording limit reached (256 MiB or 8 hours at the capture frame rate). Stop and start a new recording.'
          : 'Video recording limit reached (10 GiB). Stop and start a new recording.', 413);
      }
      if (kind === 'pose') return appendPoseFrames(storage, path, bytes);
      if (bytes.byteLength) await storage.appendBytes(path, bytes);
      return bytes.byteLength;
    }, { timeout: 30_000 });
    return NextResponse.json({ appended });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Capture upload failed:', error);
    return NextResponse.json({ error: 'Capture upload failed; stop and retry the recording' }, { status: 500 });
  }
}
