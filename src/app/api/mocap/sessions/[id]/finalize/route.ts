import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { finalizePoseStreamBlob } from "@/lib/mocap/capturePersistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  durationSec: z.number().nonnegative().max(60 * 60 * 8),
  qualityScore: z.number().min(0).max(1).optional(),
  qualityFlags: z.array(z.string().min(1).max(80)).max(20).optional(),
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

  let finalized: Awaited<ReturnType<typeof finalizePoseStreamBlob>>;
  try {
    finalized = await finalizePoseStreamBlob(storage, row.poseStreamPath);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const updated = await prisma.mocapSession.update({
    where: { id: row.id },
    data: {
      status: "ready",
      durationSec: body.durationSec,
      qualityScore: body.qualityScore ?? null,
      qualityFlags: body.qualityFlags ?? [],
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    durationSec: updated.durationSec,
    frameCount: finalized.frameCount,
    poseStreamBytes: finalized.poseStreamBytes,
  });
}
