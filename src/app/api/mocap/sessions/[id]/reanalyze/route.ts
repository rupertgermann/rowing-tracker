import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { analyzeAndPersistMocapSession } from "@/lib/mocap/sessionAnalysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
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
    select: {
      id: true,
      userId: true,
      status: true,
      poseStreamPath: true,
      videoStoragePath: true,
      capturePerspective: true,
      calibrationCatchFrame: true,
      calibrationFinishFrame: true,
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "ready") {
    return NextResponse.json(
      { error: `Session not ready (status=${row.status})` },
      { status: 409 },
    );
  }

  await prisma.mocapSession.update({
    where: { id: row.id },
    data: { status: "analyzing" },
  });

  const storage = getMocapStorage();

  let analysis: Awaited<ReturnType<typeof analyzeAndPersistMocapSession>>;
  try {
    analysis = await analyzeAndPersistMocapSession(storage, row);
  } catch (err) {
    // Revert status so the session stays usable
    await prisma.mocapSession.update({
      where: { id: row.id },
      data: { status: "ready" },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const updated = await prisma.mocapSession.update({
    where: { id: row.id },
    data: { status: "ready" },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    strokeMetricCount: analysis.strokeMetricCount,
    faultCount: analysis.faultCount,
  });
}
