import { sessionsInput } from "@/lib/sessionInput";
import { INGESTION_LIMITS } from "@/lib/ingestionLimits";
import { InputError, readBoundedJson } from "@/lib/server/requestBody";
import { applyRateLimit } from "@/lib/rateLimit";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { calculateConsistencyScore } from "@/lib/analysisUtils";
import { bumpUserSessionsRevision } from "@/lib/server/userSettings";

const unlinkRequired = "Unlink the motion capture before replacing strokes, clearing strokes, or deleting this rowing session.";

class LinkedRowingSessionError extends Error {
  constructor() { super(unlinkRequired); }
}

/**
 * GET /api/sessions
 * Fetch all sessions for the authenticated user
 */
export async function GET(req: Request) {
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

    const sessions = await prisma.rowingSession.findMany({
      where: {
        userId: session.user.id,
        ...(sessionId ? { id: sessionId } : {}),
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

    const rateLimit = await applyRateLimit(req, session.user.id, "api");
    if (rateLimit) return rateLimit;
    const { sessions: newSessions } = sessionsInput.parse(await readBoundedJson(req, INGESTION_LIMITS.sessionBodyBytes));

    const saveSessions = () => prisma.$transaction(async (tx) => {
      const created = [];
      for (const sessionData of newSessions) {
        const normalizedTimestamp = new Date(sessionData.timestamp);
        const strokeData = sessionData.strokeData;
        const hasStrokeDataInput = strokeData !== undefined;
        const existingById = sessionData.id
          ? await tx.rowingSession.findFirst({
              where: { id: sessionData.id, userId: session.user.id },
            })
          : null;
        const existing = existingById ?? await tx.rowingSession.findFirst({
          where: {
            userId: session.user.id,
            timestamp: normalizedTimestamp,
            distance: sessionData.distance,
          },
        });
        if (existing && hasStrokeDataInput) {
          // Lock before checking the link; CSV analysis uses the same rowing-first lock order.
          await tx.$queryRaw`SELECT id FROM "RowingSession" WHERE id = ${existing.id} FOR UPDATE`;
          if (await tx.mocapSession.findUnique({ where: { rowingSessionId: existing.id }, select: { id: true } })) {
            throw new LinkedRowingSessionError();
          }
        }
        const data = {
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
          ...(hasStrokeDataInput
            ? { consistencyScore: calculateConsistencyScore(strokeData) }
            : {}),
          sourceFile: sessionData.sourceFile || null,
        };
        const sessionRecord = existing
          ? await tx.rowingSession.update({ where: { id: existing.id }, data })
          : await tx.rowingSession.create({ data: { ...data, userId: session.user.id } });

        if (existing && hasStrokeDataInput) {
          await tx.strokeData.deleteMany({ where: { sessionId: existing.id } });
        }

        // Save stroke data if present - use bulk insert for performance
        if (hasStrokeDataInput && strokeData.length > 0) {
          console.log(`[SESSIONS API] Bulk inserting ${strokeData.length} stroke data points for session ${sessionRecord.id}`);

          const strokeDataRecords = strokeData.map((stroke) => ({
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

          await tx.strokeData.createMany({
            data: strokeDataRecords,
            skipDuplicates: true,
          });
        }

        created.push(sessionRecord);
      }
      await bumpUserSessionsRevision(session.user.id, tx);
      return created;
    }, { timeout: 30000 });

    let created;
    try {
      created = await saveSessions();
    } catch (error) {
      // A concurrent import can win the unique key; retry only after its failed transaction rolls back.
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error;
      created = await saveSessions();
    }

    return NextResponse.json({ 
      sessions: created,
      count: created.length 
    });
  } catch (error) {
    if (error instanceof InputError || error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof InputError ? error.status : 400 });
    }
    if (error instanceof LinkedRowingSessionError) return NextResponse.json({ error: error.message }, { status: 409 });
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

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "RowingSession" WHERE id = ${sessionId} FOR UPDATE`;
      if (await tx.mocapSession.findUnique({ where: { rowingSessionId: sessionId }, select: { id: true } })) {
        throw new LinkedRowingSessionError();
      }
      // Related stroke rows are deleted by the database cascade.
      await tx.rowingSession.delete({ where: { id: sessionId } });
      await bumpUserSessionsRevision(session.user.id, tx);
    });

    console.log(`[SESSIONS API] Deleted session ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId 
    });
  } catch (error) {
    if (error instanceof LinkedRowingSessionError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
