import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import {
  BYTES_PER_FRAME_V1,
  HEADER_SIZE,
  framesFromBlobSize,
} from "@/lib/mocap/poseFrameStream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FRAME_COUNT_OFFSET = 16;

const Body = z.object({
  durationSec: z.number().nonnegative().max(60 * 60 * 8),
  qualityScore: z.number().min(0).max(1).optional(),
});

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
    select: {
      id: true,
      status: true,
      poseStreamPath: true,
      videoStoragePath: true,
    },
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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const storage = getMocapStorage();

  let poseSize = 0;
  try {
    poseSize = await storage.size(row.poseStreamPath);
  } catch {
    return NextResponse.json(
      { error: "Pose stream missing" },
      { status: 500 },
    );
  }
  if (poseSize < HEADER_SIZE) {
    return NextResponse.json(
      { error: "Pose stream truncated below header" },
      { status: 500 },
    );
  }
  const trailing = (poseSize - HEADER_SIZE) % BYTES_PER_FRAME_V1;
  if (trailing !== 0) {
    return NextResponse.json(
      {
        error: `Pose stream has ${trailing} trailing bytes (corrupt)`,
      },
      { status: 500 },
    );
  }
  const frameCount = framesFromBlobSize(poseSize);

  const headerPatch = new Uint8Array(4);
  new DataView(headerPatch.buffer).setUint32(0, frameCount, true);
  await storage.writeAt(row.poseStreamPath, headerPatch, FRAME_COUNT_OFFSET);

  const updated = await prisma.mocapSession.update({
    where: { id: row.id },
    data: {
      status: "ready",
      durationSec: body.durationSec,
      qualityScore: body.qualityScore ?? null,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    durationSec: updated.durationSec,
    frameCount,
    poseStreamBytes: poseSize,
  });
}
