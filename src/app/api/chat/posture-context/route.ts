import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { buildAndValidatePosturePayload } from "@/lib/aiAnalysis";
import {
  assertNoKeypointsInPayload,
  buildMocapCoachContext,
} from "@/lib/mocap/aiPayload";

function parseLimit(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * GET /api/chat/posture-context
 *
 * Returns cloud-safe posture context for AI Coach:
 * - payload: existing aggregate PostureAIPayload from linked ready sessions
 * - coachContext: session-scoped mocap summaries for the coach tool
 *
 * Tier policy (mirrors insight generation):
 *   cloudAIEnabled = false  → { payload: null }   (Tier 1 hard-wall)
 *   cloudAIEnabled = true   → Tier 3 fault summary
 *   + mocapDetailedAIShare  → Tier 2 adds per-stroke scalar metrics
 *
 * Raw keypoints, landmarks, pose-stream blobs, and video bytes are never
 * included; hard guards enforce this before returning.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"), 5, 10);
  const sessionId = searchParams.get("sessionId");
  const includeStrokeMetrics =
    searchParams.get("includeStrokeMetrics") === "true";

  const userSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { cloudAIEnabled: true, mocapDetailedAIShare: true },
  });

  if (!userSettings?.cloudAIEnabled) {
    return NextResponse.json({
      payload: null,
      sessionCount: 0,
      coachContext: null,
    });
  }

  const linkedMocapSessions = await prisma.mocapSession.findMany({
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

  const coachMocapSessions = await prisma.mocapSession.findMany({
    where: {
      userId,
      status: "ready",
      ...(sessionId
        ? {
            OR: [{ id: sessionId }, { rowingSessionId: sessionId }],
          }
        : {}),
    },
    select: {
      id: true,
      rowingSessionId: true,
      createdAt: true,
      source: true,
      capturePerspective: true,
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
    take: limit,
  });

  const faults: { faultType: string; severity: string }[] = [];
  const metrics: {
    strokeIndex: number;
    segmentationSource: string;
    metricsJson: unknown;
  }[] = [];
  const qualityFlagSet = new Set<string>();
  let qualityScoreSum = 0;
  let qualityScoreCount = 0;

  for (const s of linkedMocapSessions) {
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

  const payload =
    linkedMocapSessions.length > 0
      ? buildAndValidatePosturePayload(
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
        )
      : null;

  const coachContext = buildMocapCoachContext(
    coachMocapSessions.map((s) => ({
      id: s.id,
      rowingSessionId: s.rowingSessionId,
      createdAt: s.createdAt,
      source: s.source,
      capturePerspective: s.capturePerspective,
      qualityFlags: s.qualityFlags,
      qualityScore: s.qualityScore,
      faults: s.postureFaults,
      metrics: s.strokePostureMetrics,
    })),
    {
      cloudAIEnabled: userSettings.cloudAIEnabled,
      mocapDetailedAIShare: userSettings.mocapDetailedAIShare ?? false,
      includeStrokeMetrics,
    },
  );

  assertNoKeypointsInPayload(coachContext);

  return NextResponse.json({
    payload,
    sessionCount: linkedMocapSessions.length,
    coachContext,
  });
}
