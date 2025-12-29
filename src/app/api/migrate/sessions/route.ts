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
            energy: localSession.totalCalories || 0,
            strokeCount: localSession.strokeCount || 0,
            avgPower: localSession.avgPower || 0,
            maxPower: localSession.maxPower || 0,
            wattPerKg: localSession.wattPerKg || 0,
            avgSplit: localSession.avgSplit || 0,
            minSplit: localSession.minSplit || 0,
            avgWork: localSession.avgWork || 0,
            avgStrokeLength: localSession.avgStrokeLength || 0,
            avgStrokeRate: localSession.avgStrokeRate || 0,
            maxStrokeRate: localSession.maxStrokeRate || 0,
            sourceFile: 'localStorage_migration',
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
