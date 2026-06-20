import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import {
  analyzeAndPersistMocapSession,
  analyzeAndPersistMocapSessionLinked,
} from "@/lib/mocap/sessionAnalysis";
import { reanalyzeMocapSessionLifecycle } from "@/lib/mocap/lifecycle";

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
  const storage = getMocapStorage();
  const result = await reanalyzeMocapSessionLifecycle(
    {
      storage,
      findSession: (userId, mocapSessionId) =>
        prisma.mocapSession.findFirst({
          where: { id: mocapSessionId, userId },
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
      setStatus: (mocapSessionId, status) =>
        prisma.mocapSession.update({
          where: { id: mocapSessionId },
          data: { status },
          select: { status: true },
        }),
      analyzePoseSegmented: analyzeAndPersistMocapSession,
      analyzeCsvAligned: analyzeAndPersistMocapSessionLinked,
    },
    {
      userId: session.user.id,
      mocapSessionId: id,
    },
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    id: result.id,
    status: result.status,
    analysisMode: result.analysisMode,
    strokeMetricCount: result.strokeMetricCount,
    faultCount: result.faultCount,
  });
}
