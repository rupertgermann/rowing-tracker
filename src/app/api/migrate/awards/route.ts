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

    const { awards } = await req.json();

    if (!Array.isArray(awards) || awards.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    let migratedCount = 0;

    for (const localAward of awards) {
      try {
        // Check if award already exists
        const existing = await prisma.earnedAward.findFirst({
          where: {
            userId: session.user.id,
            awardId: localAward.awardId,
          },
        });

        if (existing) {
          console.log(`Award already exists: ${localAward.awardId}`);
          continue;
        }

        // Create award
        await prisma.earnedAward.create({
          data: {
            userId: session.user.id,
            awardId: localAward.awardId,
            earnedAt: new Date(localAward.earnedAt),
          },
        });

        migratedCount++;
      } catch (error) {
        console.error(`Error migrating award ${localAward.awardId}:`, error);
      }
    }

    return NextResponse.json({ 
      count: migratedCount,
      message: `Successfully migrated ${migratedCount} awards`
    });
  } catch (error) {
    console.error("Award migration error:", error);
    return NextResponse.json(
      { error: "Failed to migrate awards" },
      { status: 500 }
    );
  }
}
