import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/generated-achievements
 * Fetch all generated achievements (AI-generated award images/stories)
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

    const achievements = await prisma.generatedAchievement.findMany({
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({ achievements });
  } catch (error) {
    console.error("Error fetching generated achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch generated achievements" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/generated-achievements
 * Create or update generated achievements
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

    const { achievements } = await req.json();

    if (!Array.isArray(achievements)) {
      return NextResponse.json(
        { error: "Invalid achievements data" },
        { status: 400 }
      );
    }

    const savedAchievements = [];

    for (const achData of achievements) {
      if (!achData?.awardId) {
        continue;
      }

      // Check if achievement exists
      const existing = await prisma.generatedAchievement.findFirst({
        where: {
          userId: session.user.id,
          awardId: achData.awardId,
        },
      });

      if (existing) {
        // Update existing achievement
        const updated = await prisma.generatedAchievement.update({
          where: { id: existing.id },
          data: {
            story: achData.story ?? undefined,
            imageUrl: achData.imageUrl ?? undefined,
            hasImage: achData.hasImage ?? undefined,
            earnedAt: achData.earnedAt ? new Date(achData.earnedAt) : undefined,
            generatedAt: achData.generatedAt ? new Date(achData.generatedAt) : undefined,
          },
        });
        savedAchievements.push(updated);
      } else {
        // Create new achievement
        const created = await prisma.generatedAchievement.create({
          data: {
            userId: session.user.id,
            awardId: achData.awardId,
            story: achData.story ?? null,
            imageUrl: achData.imageUrl ?? null,
            hasImage: Boolean(achData.hasImage) || Boolean(achData.imageUrl),
            earnedAt: achData.earnedAt ? new Date(achData.earnedAt) : null,
            generatedAt: achData.generatedAt ? new Date(achData.generatedAt) : new Date(),
          },
        });
        savedAchievements.push(created);
      }
    }

    return NextResponse.json({ 
      achievements: savedAchievements,
      count: savedAchievements.length 
    });
  } catch (error) {
    console.error("Error saving generated achievements:", error);
    return NextResponse.json(
      { error: "Failed to save generated achievements" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/generated-achievements
 * Delete a generated achievement
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

    const { awardId } = await req.json();

    await prisma.generatedAchievement.deleteMany({
      where: {
        userId: session.user.id,
        awardId: awardId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting generated achievement:", error);
    return NextResponse.json(
      { error: "Failed to delete generated achievement" },
      { status: 500 }
    );
  }
}
