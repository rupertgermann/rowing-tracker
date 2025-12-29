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

    const { prs } = await req.json();

    if (!Array.isArray(prs) || prs.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    let migratedCount = 0;

    for (const localPR of prs) {
      try {
        // Check if PR already exists
        const existing = await prisma.personalRecord.findFirst({
          where: {
            userId: session.user.id,
            distance: localPR.distance,
          },
        });

        if (existing) {
          // Update if the local PR is better
          let shouldUpdate = false;
          const updateData: { achievedAt: Date; bestTime?: number; bestPace?: number; avgPower?: number } = {
            achievedAt: new Date(localPR.achievedAt),
          };

          // Update based on record type
          if (localPR.recordType === 'time' && localPR.value < existing.bestTime) {
            updateData.bestTime = localPR.value;
            shouldUpdate = true;
          } else if (localPR.recordType === 'pace' && localPR.value < existing.bestPace) {
            updateData.bestPace = localPR.value;
            shouldUpdate = true;
          } else if (localPR.recordType === 'power' && localPR.value > existing.avgPower) {
            updateData.avgPower = localPR.value;
            shouldUpdate = true;
          }

          if (shouldUpdate) {
            await prisma.personalRecord.update({
              where: { id: existing.id },
              data: updateData,
            });
            migratedCount++;
          }
        } else {
          // Skip creating new PRs from localStorage migration
          // PersonalRecord schema requires sessionId which we don't have for old localStorage data
          console.log(`Skipping creation of PR for distance ${localPR.distance} - no sessionId available`);
        }
      } catch (error) {
        console.error(`Error migrating PR ${localPR.distance}:`, error);
      }
    }

    return NextResponse.json({ 
      count: migratedCount,
      message: `Successfully migrated ${migratedCount} personal records`
    });
  } catch (error) {
    console.error("PR migration error:", error);
    return NextResponse.json(
      { error: "Failed to migrate personal records" },
      { status: 500 }
    );
  }
}
