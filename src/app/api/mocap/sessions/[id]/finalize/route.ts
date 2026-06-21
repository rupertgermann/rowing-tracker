import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { finalizePoseStreamBlob } from "@/lib/mocap/capturePersistence";
import { analyzeAndPersistMocapSession } from "@/lib/mocap/sessionAnalysis";
import { finalizeMocapSessionLifecycle } from "@/lib/mocap/lifecycle";
import {
  setMocapCaptureFinalizationState,
  setMocapSessionStatus,
} from "@/lib/mocap/lifecyclePrisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  durationSec: z.number().nonnegative().max(60 * 60 * 8),
  qualityScore: z.number().min(0).max(1).optional(),
  qualityFlags: z.array(z.string().min(1).max(80)).max(20).optional(),
  skipAnalysis: z.boolean().optional(),
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
  const result = await finalizeMocapSessionLifecycle(
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
      setStatus: setMocapSessionStatus,
      setCaptureFinalizationState: setMocapCaptureFinalizationState,
      finalizePoseStream: finalizePoseStreamBlob,
      analyzePoseSegmented: analyzeAndPersistMocapSession,
      analyzeCsvAligned: async () => {
        throw new Error("Finalize lifecycle must use pose-segmented analysis");
      },
    },
    {
      userId: session.user.id,
      mocapSessionId: id,
      durationSec: body.durationSec,
      qualityScore: body.qualityScore,
      qualityFlags: body.qualityFlags,
      skipAnalysis: body.skipAnalysis,
    },
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
    durationSec: result.durationSec,
    frameCount: result.frameCount,
    poseStreamBytes: result.poseStreamBytes,
    strokeMetricCount: result.strokeMetricCount,
    faultCount: result.faultCount,
  });
}
