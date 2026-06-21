import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { analyzeAndPersistMocapSession } from "@/lib/mocap/sessionAnalysis";
import { unlinkMocapSessionLifecycle } from "@/lib/mocap/lifecycle";
import { setMocapSessionStatus } from "@/lib/mocap/lifecyclePrisma";

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
  const storage = getMocapStorage();

  const result = await unlinkMocapSessionLifecycle(
    {
      storage,
      findSession: (ownerId, mocapSessionId) =>
        prisma.mocapSession.findFirst({
          where: { id: mocapSessionId, userId: ownerId },
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
        }),
      setStatus: setMocapSessionStatus,
      unassignMocapSession: async (mocapSessionId, ownerId, rowingSessionId) => {
        const update = await prisma.mocapSession.updateMany({
          where: {
            id: mocapSessionId,
            userId: ownerId,
            rowingSessionId,
            status: "ready",
          },
          data: { rowingSessionId: null, status: "analyzing" },
        });
        return update.count === 1;
      },
      restoreMocapSessionAssignment: (mocapSessionId, restoredRowingSessionId, status) =>
        prisma.mocapSession
          .update({
            where: { id: mocapSessionId },
            data: { rowingSessionId: restoredRowingSessionId, status },
          })
          .then(() => undefined),
      bumpSessionsRevision: (ownerId) => bumpSessionsRevision(ownerId),
      analyzePoseSegmented: analyzeAndPersistMocapSession,
      analyzeCsvAligned: async () => {
        throw new Error("Unlink lifecycle must use pose-segmented analysis");
      },
    },
    { userId, mocapSessionId: id },
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    status: result.status,
    analysisMode: result.analysisMode,
    strokeMetricCount: result.strokeMetricCount,
    faultCount: result.faultCount,
  });
}

async function bumpSessionsRevision(userId: string): Promise<void> {
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
}
