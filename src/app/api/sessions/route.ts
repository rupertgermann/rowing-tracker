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
      const createdSession = await prisma.rowingSession.create({
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
      created.push(createdSession);
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
