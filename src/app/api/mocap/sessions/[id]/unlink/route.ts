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
  const userId = session.user.id;

  const mocapSession = await prisma.mocapSession.findFirst({
    where: { id, userId },
    select: {
      id: true,
      userId: true,
      status: true,
      rowingSessionId: true,
      poseStreamPath: true,
      capturePerspective: true,
      calibrationCatchFrame: true,
      calibrationFinishFrame: true,
    },
  });

  if (!mocapSession) {
    return NextResponse.json({ error: "Mocap session not found" }, { status: 404 });
  }

  if (mocapSession.status !== "ready") {
    return NextResponse.json(
      { error: `Mocap session not ready (status=${mocapSession.status})` },
      { status: 409 },
    );
  }

  const previousRowingSessionId = mocapSession.rowingSessionId;
  if (previousRowingSessionId === null) {
    return NextResponse.json(
      { error: "Mocap session is not linked to a rowing session." },
      { status: 409 },
    );
  }

  // Clear the link and set status to "analyzing"
  await prisma.mocapSession.update({
    where: { id },
    data: { rowingSessionId: null, status: "analyzing" },
  });

  const storage = getMocapStorage();

  try {
    // Re-run pose-segmented analysis, which sets segmentationSource = "pose-segmented"
    // and clears strokeDataId (analyzeAndPersistMocapSession does not set strokeDataId)
    await analyzeAndPersistMocapSession(storage, mocapSession);
  } catch (err) {
    // Roll back: restore the previous link and revert status
    await prisma.mocapSession.update({
      where: { id },
      data: {
        rowingSessionId: previousRowingSessionId ?? null,
        status: "ready",
      },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const updated = await prisma.mocapSession.update({
    where: { id },
    data: { status: "ready" },
    select: { id: true, status: true },
  });

  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      sessionsRevision: { increment: 1 },
    },
    create: {
      userId,
      theme: "system",
      units: "metric",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "24h",
      language: "en",
      defaultChartType: "line",
      animationsEnabled: true,
      cloudAIEnabled: false,
      maxTokens: 4000,
      sessionsRevision: 1,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
  });
}
