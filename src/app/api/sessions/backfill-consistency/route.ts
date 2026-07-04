import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { calculateConsistencyScore } from "@/lib/analysisUtils";
import { bumpUserSessionsRevision } from "@/lib/server/userSettings";

/**
 * POST /api/sessions/backfill-consistency
 * Backfill consistency scores for all sessions that don't have one.
 * This is a one-time operation to migrate existing data.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find all sessions without consistency score that have stroke data
    const sessions = await prisma.rowingSession.findMany({
      where: {
        userId: session.user.id,
        consistencyScore: null,
      },
      select: {
        id: true,
        strokeData: {
          select: { power: true },
        },
      },
    });

    let updated = 0;
    let skipped = 0;

    // Process in batches to avoid memory issues
    for (const s of sessions) {
      if (s.strokeData && s.strokeData.length >= 5) {
        const score = calculateConsistencyScore(s.strokeData);
        if (score !== null) {
          await prisma.rowingSession.update({
            where: { id: s.id },
            data: { consistencyScore: score },
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    // Bump the sessions revision to invalidate caches
    if (updated > 0) {
      await bumpUserSessionsRevision(session.user.id);
    }

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      total: sessions.length,
    });
  } catch (error) {
    console.error("Error backfilling consistency scores:", error);
    return NextResponse.json(
      { error: "Failed to backfill consistency scores" },
      { status: 500 }
    );
  }
}
