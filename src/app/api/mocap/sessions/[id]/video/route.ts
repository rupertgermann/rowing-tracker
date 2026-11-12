import { INGESTION_LIMITS } from "@/lib/ingestionLimits";
import { uploadCaptureChunk } from "@/lib/mocap/captureUpload";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseRange(
  header: string | null,
  totalSize: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  if (startStr === "" && endStr === "") return null;
  let start: number;
  let end: number;
  if (startStr === "") {
    const suffix = parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === "" ? totalSize - 1 : parseInt(endStr, 10);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= totalSize) {
    return null;
  }
  end = Math.min(end, totalSize - 1);
  return { start, end };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.mocapSession.findFirst({
    where: { id, userId: session.user.id },
    select: { videoStoragePath: true, status: true },
  });
  if (!row || row.status === "capturing") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storage = getMocapStorage();
  const totalSize = await storage.size(row.videoStoragePath);
  const range = parseRange(req.headers.get("range"), totalSize);

  let position = range?.start ?? 0;
  const end = range ? range.end + 1 : totalSize;
  const length = end - position;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cancelled) return;
      if (req.signal.aborted) { controller.error(new Error("Playback aborted")); return; }
      if (position >= end) { controller.close(); return; }
      try {
        const next = Math.min(end, position + INGESTION_LIMITS.videoChunkBytes);
        const bytes = await storage.read(row.videoStoragePath, { start: position, end: next });
        if (cancelled) return;
        if (req.signal.aborted) { controller.error(new Error("Playback aborted")); return; }
        if (bytes.byteLength !== next - position) throw new Error("Truncated recording");
        position = next;
        controller.enqueue(bytes);
      } catch (error) {
        if (!cancelled) controller.error(error);
      }
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return new Response(stream, {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": "video/webm",
      "Content-Length": String(length),
      ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${totalSize}` } : {}),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  return uploadCaptureChunk(req, session.user.id, id, "video");
}
