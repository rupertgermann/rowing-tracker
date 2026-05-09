import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  aggregatePostureTrend,
  type SessionFaultInput,
} from "@/lib/mocap/postureTrendAggregation";

/**
 * GET /api/mocap/posture-trend
 *
 * Returns per-fault-type frequency trend across all ready mocap sessions
 * linked to the authenticated user. Sessions with low quality scores or
 * quality flags are included but marked so the UI can surface them.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const mocapSessions = await prisma.mocapSession.findMany({
    where: { userId, status: "ready" },
    select: {
      id: true,
      createdAt: true,
      qualityScore: true,
      qualityFlags: true,
      postureFaults: {
        select: { faultType: true, severity: true },
      },
      _count: { select: { strokePostureMetrics: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const inputs: SessionFaultInput[] = mocapSessions.map((s) => ({
    sessionId: s.id,
    sessionDate: s.createdAt,
    qualityScore: s.qualityScore,
    qualityFlags: s.qualityFlags,
    faults: s.postureFaults,
    strokeCount: s._count.strokePostureMetrics,
  }));

  const result = aggregatePostureTrend(inputs);

  return NextResponse.json(result);
}
