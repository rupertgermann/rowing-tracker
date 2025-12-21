import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { sessions } = await req.json();

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    let migratedCount = 0;

    for (const localSession of sessions) {
      try {
        // Check if session already exists (by timestamp and distance to avoid duplicates)
        const existing = await prisma.rowingSession.findFirst({
          where: {
            userId: session.user.id,
            timestamp: new Date(localSession.timestamp),
            distance: localSession.distance,
          },
        });

        if (existing) {
          console.log(`Session already exists: ${localSession.id}`);
          continue;
        }

        // Create session
        await prisma.rowingSession.create({
          data: {
            userId: session.user.id,
            timestamp: new Date(localSession.timestamp),
            distance: localSession.distance,
            duration: localSession.duration,
            avgPace: localSession.avgPace || null,
            avgSplit: localSession.avgSplit || null,
            avgStrokeRate: localSession.avgStrokeRate || null,
            avgHeartRate: localSession.avgHeartRate || null,
            avgPower: localSession.avgPower || null,
            totalCalories: localSession.totalCalories || null,
            sessionType: localSession.sessionType || 'steady_state',
            notes: localSession.notes || null,
            strokeData: localSession.strokeData || null,
          },
        });

        migratedCount++;
      } catch (error) {
        console.error(`Error migrating session ${localSession.id}:`, error);
      }
    }

    return NextResponse.json({ 
      count: migratedCount,
      message: `Successfully migrated ${migratedCount} sessions`
    });
  } catch (error) {
    console.error("Session migration error:", error);
    return NextResponse.json(
      { error: "Failed to migrate sessions" },
      { status: 500 }
    );
  }
}
