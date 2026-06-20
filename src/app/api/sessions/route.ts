import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { calculateConsistencyScore } from "@/lib/analysisUtils";

/**
 * GET /api/sessions
 * Fetch all sessions for the authenticated user
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

    const sessions = await prisma.rowingSession.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        strokeData: {
          orderBy: {
            strokeIndex: 'asc',
          },
        },
        mocapSession: {
          select: { id: true },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 * Create new sessions for the authenticated user
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { sessions: newSessions } = await req.json();

    if (!Array.isArray(newSessions) || newSessions.length === 0) {
      return NextResponse.json(
        { error: "Invalid sessions data" },
        { status: 400 }
      );
    }

    const created = [];
    let createdAnyNewSession = false;
    let updatedAnyExistingSession = false;

    for (const sessionData of newSessions) {
      const normalizedTimestamp = new Date(sessionData.timestamp);
      const hasStrokeDataInput =
        Object.prototype.hasOwnProperty.call(sessionData, 'strokeData') &&
        Array.isArray(sessionData.strokeData);

      // Check if session already exists (for updates)
      // 1) Prefer matching by id (stable across re-imports if client keeps it)
      // 2) Fallback to matching by the DB unique constraint (userId, timestamp, distance)
      const existingById = sessionData.id
        ? await prisma.rowingSession.findFirst({
            where: {
              id: sessionData.id,
              userId: session.user.id,
            },
          })
        : null;

      const existingByUnique = !existingById
        ? await prisma.rowingSession.findFirst({
            where: {
              userId: session.user.id,
              timestamp: normalizedTimestamp,
              distance: sessionData.distance,
            },
          })
        : null;

      const existing = existingById || existingByUnique;

      let sessionRecord;

      // Pre-compute consistency score from stroke data
      const consistencyScore = hasStrokeDataInput
        ? calculateConsistencyScore(sessionData.strokeData)
        : undefined;

      if (existing) {
        // Update existing session
        console.log(`[SESSIONS API] Updating existing session ${sessionData.id}`);
        updatedAnyExistingSession = true;

        sessionRecord = await prisma.rowingSession.update({
          where: { id: existing.id },
          data: {
            timestamp: normalizedTimestamp,
            distance: sessionData.distance,
            duration: sessionData.duration,
            energy: sessionData.energy || 0,
            strokeCount: sessionData.strokeCount || 0,
            avgPower: sessionData.avgPower || 0,
            maxPower: sessionData.maxPower || 0,
            wattPerKg: sessionData.wattPerKg || 0,
            avgSplit: sessionData.avgSplit || 0,
            minSplit: sessionData.minSplit || 0,
            avgWork: sessionData.avgWork || 0,
            avgStrokeLength: sessionData.avgStrokeLength || 0,
            avgStrokeRate: sessionData.avgStrokeRate || 0,
            maxStrokeRate: sessionData.maxStrokeRate || 0,
            ...(hasStrokeDataInput ? { consistencyScore } : {}),
            sourceFile: sessionData.sourceFile || null,
          },
        });

        // Delete existing stroke data before adding new
        if (hasStrokeDataInput) {
          await prisma.strokeData.deleteMany({
            where: { sessionId: existing.id },
          });
        }
      } else {
        // Create new session
        console.log(`[SESSIONS API] Creating new session`);

        try {
          sessionRecord = await prisma.rowingSession.create({
            data: {
              userId: session.user.id,
              timestamp: normalizedTimestamp,
              distance: sessionData.distance,
              duration: sessionData.duration,
              energy: sessionData.energy || 0,
              strokeCount: sessionData.strokeCount || 0,
              avgPower: sessionData.avgPower || 0,
              maxPower: sessionData.maxPower || 0,
              wattPerKg: sessionData.wattPerKg || 0,
              avgSplit: sessionData.avgSplit || 0,
              minSplit: sessionData.minSplit || 0,
              avgWork: sessionData.avgWork || 0,
              avgStrokeLength: sessionData.avgStrokeLength || 0,
              avgStrokeRate: sessionData.avgStrokeRate || 0,
              maxStrokeRate: sessionData.maxStrokeRate || 0,
              consistencyScore: consistencyScore ?? null,
              sourceFile: sessionData.sourceFile || null,
            },
          });
          createdAnyNewSession = true;
        } catch (err: unknown) {
          // Handle race/duplicate imports gracefully
          if ((err as { code?: string })?.code === 'P2002') {
            const dupe = await prisma.rowingSession.findFirst({
              where: {
                userId: session.user.id,
                timestamp: normalizedTimestamp,
                distance: sessionData.distance,
              },
            });

            if (!dupe) {
              throw err;
            }

            console.log(`[SESSIONS API] Duplicate detected, updating existing session ${dupe.id}`);
            updatedAnyExistingSession = true;
            sessionRecord = await prisma.rowingSession.update({
              where: { id: dupe.id },
              data: {
                duration: sessionData.duration,
                energy: sessionData.energy || 0,
                strokeCount: sessionData.strokeCount || 0,
                avgPower: sessionData.avgPower || 0,
                maxPower: sessionData.maxPower || 0,
                wattPerKg: sessionData.wattPerKg || 0,
                avgSplit: sessionData.avgSplit || 0,
                minSplit: sessionData.minSplit || 0,
                avgWork: sessionData.avgWork || 0,
                avgStrokeLength: sessionData.avgStrokeLength || 0,
                avgStrokeRate: sessionData.avgStrokeRate || 0,
                maxStrokeRate: sessionData.maxStrokeRate || 0,
                ...(hasStrokeDataInput ? { consistencyScore } : {}),
                sourceFile: sessionData.sourceFile || null,
              },
            });

            if (hasStrokeDataInput) {
              await prisma.strokeData.deleteMany({
                where: { sessionId: dupe.id },
              });
            }
          } else {
            throw err;
          }
        }
      }

      // Save stroke data if present - use bulk insert for performance
      if (hasStrokeDataInput && sessionData.strokeData.length > 0) {
        console.log(`[SESSIONS API] Bulk inserting ${sessionData.strokeData.length} stroke data points for session ${sessionRecord.id}`);

        const strokeDataRecords = sessionData.strokeData.map((stroke: Record<string, unknown>) => ({
          sessionId: sessionRecord.id,
          strokeIndex: stroke.strokeIndex,
          time: stroke.time,
          timestamp: stroke.timestamp,
          distance: stroke.distance,
          work: stroke.work,
          power: stroke.power,
          avgPower: stroke.avgPower,
          split: stroke.split,
          avgSplit: stroke.avgSplit,
          strokeRate: stroke.strokeRate,
          heartRate: stroke.heartRate || null,
          strokeLength: stroke.strokeLength || null,
        }));

        await prisma.strokeData.createMany({
          data: strokeDataRecords,
          skipDuplicates: true,
        });
      }

      created.push(sessionRecord);
    }

    const shouldBumpSessionsRevision =
      createdAnyNewSession || updatedAnyExistingSession || newSessions.length > 1;
    if (shouldBumpSessionsRevision) {
      await prisma.userSettings.upsert({
        where: { userId: session.user.id },
        update: {
          sessionsRevision: { increment: 1 },
        },
        create: {
          userId: session.user.id,
          theme: 'system',
          units: 'metric',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '24h',
          language: 'en',
          defaultChartType: 'line',
          animationsEnabled: true,
          cloudAIEnabled: false,
          maxTokens: 4000,
          sessionsRevision: 1,
        },
      });
    }

    return NextResponse.json({ 
      sessions: created,
      count: created.length 
    });
  } catch (error) {
    console.error("Error creating sessions:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Failed to create sessions", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions
 * Delete a session for the authenticated user
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Verify the session belongs to the user before deleting
    const existingSession = await prisma.rowingSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Delete stroke data first (cascade should handle this, but being explicit)
    await prisma.strokeData.deleteMany({
      where: { sessionId },
    });

    // Delete the session
    await prisma.rowingSession.delete({
      where: { id: sessionId },
    });

    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        sessionsRevision: { increment: 1 },
      },
      create: {
        userId: session.user.id,
        theme: 'system',
        units: 'metric',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '24h',
        language: 'en',
        defaultChartType: 'line',
        animationsEnabled: true,
        cloudAIEnabled: false,
        maxTokens: 4000,
        sessionsRevision: 1,
      },
    });

    console.log(`[SESSIONS API] Deleted session ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId 
    });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
