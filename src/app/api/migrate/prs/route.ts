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
            recordType: localPR.recordType || 'time',
          },
        });

        if (existing) {
          // Update if the local PR is better
          const shouldUpdate = localPR.recordType === 'time' 
            ? localPR.value < existing.value
            : localPR.value > existing.value;

          if (shouldUpdate) {
            await prisma.personalRecord.update({
              where: { id: existing.id },
              data: {
                value: localPR.value,
                achievedAt: new Date(localPR.achievedAt),
                sessionId: null, // Can't link to old localStorage session
              },
            });
            migratedCount++;
          }
        } else {
          // Create new PR
          await prisma.personalRecord.create({
            data: {
              userId: session.user.id,
              distance: localPR.distance,
              value: localPR.value,
              recordType: localPR.recordType || 'time',
              achievedAt: new Date(localPR.achievedAt),
              sessionId: null,
            },
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
