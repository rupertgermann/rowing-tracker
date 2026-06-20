import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/sessions/list
 * Lightweight endpoint that returns session metadata WITHOUT strokeData.
 * This dramatically reduces payload size (from ~10-50MB to <1MB) for analytics.
 *
 * Response includes:
 * - sessions: Array of session objects (without strokeData)
 * - sessionsRevision: Version number for cache invalidation
 * - count: Total number of sessions
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch sessions without strokeData - much faster and smaller
    const [sessions, settings] = await Promise.all([
      prisma.rowingSession.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          timestamp: true,
          distance: true,
          duration: true,
          energy: true,
          strokeCount: true,
          avgPower: true,
          maxPower: true,
          wattPerKg: true,
          avgSplit: true,
          minSplit: true,
          avgWork: true,
          avgStrokeLength: true,
          avgStrokeRate: true,
          maxStrokeRate: true,
          consistencyScore: true,
          createdAt: true,
          updatedAt: true,
          importedAt: true,
          sourceFile: true,
          mocapSession: {
            select: { id: true },
          },
          _count: {
            select: { strokeData: true },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      }),
      prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { sessionsRevision: true },
      }),
    ]);

    const sessionsWithCounts = sessions.map(({ _count, ...session }) => ({
      ...session,
      strokeDataCount: _count.strokeData,
    }));

    return NextResponse.json({
      sessions: sessionsWithCounts,
      sessionsRevision: settings?.sessionsRevision ?? 0,
      count: sessionsWithCounts.length,
    });
  } catch (error) {
    console.error("Error fetching sessions list:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
