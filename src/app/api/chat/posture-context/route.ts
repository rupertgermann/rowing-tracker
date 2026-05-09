import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { buildAndValidatePosturePayload } from "@/lib/aiAnalysis";

/**
 * GET /api/chat/posture-context
 *
 * Returns a cloud-safe PostureAIPayload built from the authenticated user's
 * most recent linked (rowing-session-associated) ready MocapSessions.
 *
 * Tier policy (mirrors insight generation):
 *   cloudAIEnabled = false  → { payload: null }   (Tier 1 hard-wall)
 *   cloudAIEnabled = true   → Tier 3 fault summary
 *   + mocapDetailedAIShare  → Tier 2 adds per-stroke scalar metrics
 *
 * Raw keypoints, landmarks, pose-stream blobs, and video bytes are never
 * included; the hard guard in buildAndValidatePosturePayload enforces this.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { cloudAIEnabled: true, mocapDetailedAIShare: true },
  });

  if (!userSettings?.cloudAIEnabled) {
    return NextResponse.json({ payload: null, sessionCount: 0 });
  }

  const mocapSessions = await prisma.mocapSession.findMany({
    where: {
      userId,
      status: "ready",
      rowingSessionId: { not: null },
    },
    select: {
      qualityScore: true,
      qualityFlags: true,
      postureFaults: {
        select: { faultType: true, severity: true },
      },
      strokePostureMetrics: {
        select: {
          strokeIndex: true,
          segmentationSource: true,
          metricsJson: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (mocapSessions.length === 0) {
    return NextResponse.json({ payload: null, sessionCount: 0 });
  }

  const faults: { faultType: string; severity: string }[] = [];
  const metrics: {
    strokeIndex: number;
    segmentationSource: string;
    metricsJson: unknown;
  }[] = [];
  const qualityFlagSet = new Set<string>();
  let qualityScoreSum = 0;
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
      qualityFlagSet.add(flag);
    }
    if (s.qualityScore !== null) {
      qualityScoreSum += s.qualityScore;
      qualityScoreCount++;
    }
  }

  const qualityScore =
    qualityScoreCount > 0 ? qualityScoreSum / qualityScoreCount : null;

  const payload = buildAndValidatePosturePayload(
    {
      faults,
      metrics,
      qualityFlags: Array.from(qualityFlagSet),
      qualityScore,
    },
    {
      cloudAIEnabled: userSettings.cloudAIEnabled,
      mocapDetailedAIShare: userSettings.mocapDetailedAIShare ?? false,
    },
  );

  return NextResponse.json({ payload, sessionCount: mocapSessions.length });
}
