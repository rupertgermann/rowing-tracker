import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/prs
 * Fetch all personal records for the authenticated user
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

    const prs = await prisma.personalRecord.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        distance: 'asc',
      },
    });

    return NextResponse.json({ prs });
  } catch (error) {
    console.error("Error fetching PRs:", error);
    return NextResponse.json(
      { error: "Failed to fetch personal records" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prs
 * Create or update personal records for the authenticated user
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

    const { prs: newPRs } = await req.json();

    if (!Array.isArray(newPRs) || newPRs.length === 0) {
      return NextResponse.json(
        { error: "Invalid PRs data" },
        { status: 400 }
      );
    }

    const updated = [];

    for (const prData of newPRs) {
      const existing = await prisma.personalRecord.findFirst({
        where: {
          userId: session.user.id,
          distance: prData.distance,
          recordType: prData.recordType || 'time',
        },
      });

      if (existing) {
        const shouldUpdate = prData.value < existing.bestTime;

        if (shouldUpdate && prData.sessionId) {
          const updatedPR = await prisma.personalRecord.update({
            where: { id: existing.id },
            data: {
              bestTime: prData.value,
              bestPace: prData.bestPace || existing.bestPace,
              avgPower: prData.avgPower || existing.avgPower,
              achievedAt: new Date(prData.achievedAt),
              sessionId: prData.sessionId,
            },
          });
          updated.push(updatedPR);
        } else {
          updated.push(existing);
        }
      } else {
        // Only create PR if we have a sessionId
        if (prData.sessionId) {
          const createdPR = await prisma.personalRecord.create({
            data: {
              userId: session.user.id,
              distance: prData.distance,
              bestTime: prData.value,
              bestPace: prData.bestPace || 0,
              avgPower: prData.avgPower || 0,
              achievedAt: new Date(prData.achievedAt),
              sessionId: prData.sessionId,
            },
          });
          updated.push(createdPR);
        }
      }
    }

    return NextResponse.json({ 
      prs: updated,
      count: updated.length 
    });
  } catch (error) {
    console.error("Error updating PRs:", error);
    return NextResponse.json(
      { error: "Failed to update personal records" },
      { status: 500 }
    );
  }
}
