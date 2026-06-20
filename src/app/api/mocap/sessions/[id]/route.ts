import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";

const PatchBody = z.object({
  calibrationId: z.string().min(1).max(160).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.mocapSession.findFirst({
    where: { id, userId: session.user.id },
    include: {
      rowingSession: {
        select: {
          id: true,
          timestamp: true,
          distance: true,
          duration: true,
          avgPower: true,
          strokeCount: true,
        },
      },
      strokePostureMetrics: {
        orderBy: { strokeIndex: "asc" },
      },
      postureFaults: {
        orderBy: [{ strokeIndex: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ session: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.mocapSession.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storage = getMocapStorage();
  await Promise.allSettled([
    storage.delete(row.videoStoragePath),
    storage.delete(row.poseStreamPath),
  ]);
  await prisma.mocapSession.delete({ where: { id } });

  return NextResponse.json({ success: true, id });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const row = await prisma.mocapSession.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.mocapSession.update({
    where: { id },
    data: {
      calibrationId: body.calibrationId,
    },
    select: {
      id: true,
      calibrationId: true,
    },
  });

  return NextResponse.json({ session: updated });
}
