import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";

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
