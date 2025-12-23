import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/awards
 * Fetch all earned awards for the authenticated user
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

    const awards = await prisma.earnedAward.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });

    return NextResponse.json({ awards });
  } catch (error) {
    console.error("Error fetching awards:", error);
    return NextResponse.json(
      { error: "Failed to fetch awards" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/awards
 * Create new earned awards for the authenticated user
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

    const { awards: newAwards } = await req.json();

    if (!Array.isArray(newAwards) || newAwards.length === 0) {
      return NextResponse.json(
        { error: "Invalid awards data" },
        { status: 400 }
      );
    }

    const created = [];

    for (const awardData of newAwards) {
      // Check if award already exists
      const existing = await prisma.earnedAward.findFirst({
        where: {
          userId: session.user.id,
          awardId: awardData.awardId,
        },
      });

      if (!existing) {
        const createdAward = await prisma.earnedAward.create({
          data: {
            userId: session.user.id,
            awardId: awardData.awardId,
            earnedAt: new Date(awardData.earnedAt),
          },
        });
        created.push(createdAward);
      } else {
        created.push(existing);
      }
    }

    return NextResponse.json({ 
      awards: created,
      count: created.length 
    });
  } catch (error) {
    console.error("Error creating awards:", error);
    return NextResponse.json(
      { error: "Failed to create awards" },
      { status: 500 }
    );
  }
}
