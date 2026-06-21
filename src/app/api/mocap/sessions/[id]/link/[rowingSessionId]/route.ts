import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { analyzeAndPersistMocapSessionLinked } from "@/lib/mocap/sessionAnalysis";
import { linkMocapSessionLifecycle } from "@/lib/mocap/lifecycle";
import { setMocapSessionStatus } from "@/lib/mocap/lifecyclePrisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; rowingSessionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, rowingSessionId } = await params;
  const userId = session.user.id;
  const storage = getMocapStorage();

  const result = await linkMocapSessionLifecycle(
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
      findRowingSession: (ownerId, targetRowingSessionId) =>
        prisma.rowingSession.findFirst({
          where: { id: targetRowingSessionId, userId: ownerId },
          select: {
            id: true,
            mocapSession: { select: { id: true } },
          },
        }),
      setStatus: setMocapSessionStatus,
      assignMocapSession: async (mocapSessionId, ownerId, targetRowingSessionId) => {
        try {
          const update = await prisma.mocapSession.updateMany({
            where: {
              id: mocapSessionId,
              userId: ownerId,
              rowingSessionId: null,
              status: "ready",
            },
            data: {
              rowingSessionId: targetRowingSessionId,
              status: "analyzing",
            },
          });
          return update.count === 1 ? "assigned" : "mocap-conflict";
        } catch (err) {
          if ((err as { code?: string })?.code === "P2002") {
            return "rowing-conflict";
          }
          throw err;
        }
      },
      restoreMocapSessionAssignment: (mocapSessionId, restoredRowingSessionId, status) =>
        prisma.mocapSession
          .update({
            where: { id: mocapSessionId },
            data: { rowingSessionId: restoredRowingSessionId, status },
          })
          .then(() => undefined),
      bumpSessionsRevision: (ownerId) => bumpSessionsRevision(ownerId),
      analyzePoseSegmented: async () => {
        throw new Error("Link lifecycle must use csv-aligned analysis");
      },
      analyzeCsvAligned: analyzeAndPersistMocapSessionLinked,
    },
    { userId, mocapSessionId: id, rowingSessionId },
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
    rowingSessionId: result.rowingSessionId,
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
