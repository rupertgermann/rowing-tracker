import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

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

    for (const sessionData of newSessions) {
      // Check if session already exists (for updates)
      const existing = await prisma.rowingSession.findFirst({
        where: {
          id: sessionData.id,
          userId: session.user.id,
        },
      });

      let sessionRecord;

      if (existing) {
        // Update existing session
        console.log(`[SESSIONS API] Updating existing session ${sessionData.id}`);
        
        sessionRecord = await prisma.rowingSession.update({
          where: { id: existing.id },
          data: {
            timestamp: new Date(sessionData.timestamp),
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
            sourceFile: sessionData.sourceFile || null,
          },
        });

        // Delete existing stroke data before adding new
        if (sessionData.strokeData && Array.isArray(sessionData.strokeData)) {
          await prisma.strokeData.deleteMany({
            where: { sessionId: existing.id },
          });
        }
      } else {
        // Create new session
        console.log(`[SESSIONS API] Creating new session`);
        
        sessionRecord = await prisma.rowingSession.create({
          data: {
            userId: session.user.id,
            timestamp: new Date(sessionData.timestamp),
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
            sourceFile: sessionData.sourceFile || null,
          },
        });
      }

      // Save stroke data if present
      if (sessionData.strokeData && Array.isArray(sessionData.strokeData)) {
        console.log(`[SESSIONS API] Saving ${sessionData.strokeData.length} stroke data points for session ${sessionRecord.id}`);
        
        for (const stroke of sessionData.strokeData) {
          await prisma.strokeData.create({
            data: {
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
            },
          });
        }
      }

      created.push(sessionRecord);
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
