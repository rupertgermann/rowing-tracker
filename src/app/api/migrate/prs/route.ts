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
          const updateData: any = {
            achievedAt: new Date(localPR.achievedAt),
            sessionId: null, // Can't link to old localStorage session
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
          // Create new PR
          const createData: any = {
            userId: session.user.id,
            distance: localPR.distance,
            achievedAt: new Date(localPR.achievedAt),
            sessionId: null,
          };

          // Set value based on record type
          if (localPR.recordType === 'time') {
            createData.bestTime = localPR.value;
          } else if (localPR.recordType === 'pace') {
            createData.bestPace = localPR.value;
          } else if (localPR.recordType === 'power') {
            createData.avgPower = localPR.value;
          } else {
            // Default to time if no record type specified
            createData.bestTime = localPR.value;
          }

          await prisma.personalRecord.create({
            data: createData,
          });
          migratedCount++;
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
