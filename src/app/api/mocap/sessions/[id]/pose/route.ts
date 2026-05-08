import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { BYTES_PER_FRAME_V1 } from "@/lib/mocap/poseFrameStream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    select: { id: true, status: true, poseStreamPath: true },
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
  if (buf.byteLength % BYTES_PER_FRAME_V1 !== 0) {
    return NextResponse.json(
      {
        error: `Body length ${buf.byteLength} not multiple of frame size ${BYTES_PER_FRAME_V1}`,
      },
      { status: 400 },
    );
  }

  const storage = getMocapStorage();
  await storage.appendBytes(row.poseStreamPath, buf);

  const framesAppended = buf.byteLength / BYTES_PER_FRAME_V1;
  return NextResponse.json({ appended: framesAppended });
}
