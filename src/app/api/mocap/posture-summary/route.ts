import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/mocap/posture-summary
 *
 * Returns aggregated posture faults and stroke metrics for all of the
 * authenticated user's ready mocap sessions. Used by AI insight generation
 * to build a tiered PostureAIPayload without touching raw keypoint data.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch all ready mocap sessions for this user including their faults,
  // per-stroke metrics, and quality signals.
  const mocapSessions = await prisma.mocapSession.findMany({
    where: { userId, status: "ready" },
    select: {
      qualityScore: true,
      qualityFlags: true,
      postureFaults: {
        select: {
          faultType: true,
          severity: true,
        },
      },
      strokePostureMetrics: {
        select: {
          strokeIndex: true,
          segmentationSource: true,
          metricsJson: true,
        },
      },
    },
  });

  const faults: { faultType: string; severity: string }[] = [];
  const metrics: {
    strokeIndex: number;
    segmentationSource: string;
    metricsJson: unknown;
  }[] = [];
  const qualityFlags: string[] = [];
  let qualityScore: number | null = null;
  let qualityScoreCount = 0;

  for (const s of mocapSessions) {
    for (const f of s.postureFaults) {
      faults.push({ faultType: f.faultType, severity: f.severity });
    }
    for (const m of s.strokePostureMetrics) {
      metrics.push({
        strokeIndex: m.strokeIndex,
        segmentationSource: m.segmentationSource,
        metricsJson: m.metricsJson,
      });
    }
    for (const flag of s.qualityFlags) {
      if (!qualityFlags.includes(flag)) qualityFlags.push(flag);
    }
    if (s.qualityScore !== null) {
      qualityScore = (qualityScore ?? 0) + s.qualityScore;
      qualityScoreCount++;
    }
  }

  if (qualityScoreCount > 0 && qualityScore !== null) {
    qualityScore = qualityScore / qualityScoreCount;
  }

  return NextResponse.json({ faults, metrics, qualityFlags, qualityScore });
}
