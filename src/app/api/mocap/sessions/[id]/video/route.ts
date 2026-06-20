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

  if (!range) {
    const bytes = await storage.read(row.videoStoragePath);
    return new Response(new Uint8Array(bytes) as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "video/webm",
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const slice = await storage.read(row.videoStoragePath, {
    start: range.start,
    end: range.end + 1,
  });
  return new Response(new Uint8Array(slice) as BodyInit, {
    status: 206,
    headers: {
      "Content-Type": "video/webm",
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${range.start}-${range.end}/${totalSize}`,
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
  const row = await prisma.mocapSession.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true, videoStoragePath: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "capturing") {
    return NextResponse.json(
      { error: `Session not capturing (status=${row.status})` },
      { status: 409 },
    );
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ appended: 0 });
  }

  const storage = getMocapStorage();
  await storage.appendBytes(row.videoStoragePath, buf);

  return NextResponse.json({ appended: buf.byteLength });
}
