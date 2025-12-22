import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/insights
 * Fetch all AI insights for the authenticated user
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

    const insights = await prisma.aIInsight.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        dateGenerated: 'desc',
      },
    });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/insights
 * Create or update AI insights
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

    const { insights } = await req.json();

    if (!Array.isArray(insights)) {
      return NextResponse.json(
        { error: "Invalid insights data" },
        { status: 400 }
      );
    }

    const savedInsights = [];

    for (const insightData of insights) {
      // Check if insight exists
      const existing = await prisma.aIInsight.findFirst({
        where: {
          id: insightData.id,
          userId: session.user.id,
        },
      });

      if (existing) {
        // Update existing insight
        const updated = await prisma.aIInsight.update({
          where: { id: existing.id },
          data: {
            type: insightData.type,
            title: insightData.title,
            description: insightData.description,
            priority: insightData.priority || 'medium',
            category: insightData.category,
            source: insightData.source || 'manual',
            actionable: insightData.actionable || false,
            confidence: insightData.confidence,
            evidence: insightData.evidence || [],
            archived: insightData.archived || false,
            archivedAt: insightData.archivedAt ? new Date(insightData.archivedAt) : null,
          },
        });
        savedInsights.push(updated);
      } else {
        // Create new insight
        const created = await prisma.aIInsight.create({
          data: {
            userId: session.user.id,
            type: insightData.type,
            title: insightData.title,
            description: insightData.description,
            priority: insightData.priority || 'medium',
            category: insightData.category,
            source: insightData.source || 'manual',
            actionable: insightData.actionable || false,
            confidence: insightData.confidence,
            evidence: insightData.evidence || [],
            dateGenerated: insightData.dateGenerated ? new Date(insightData.dateGenerated) : new Date(),
            archived: insightData.archived || false,
            archivedAt: insightData.archivedAt ? new Date(insightData.archivedAt) : null,
          },
        });
        savedInsights.push(created);
      }
    }

    return NextResponse.json({ 
      insights: savedInsights,
      count: savedInsights.length 
    });
  } catch (error) {
    console.error("Error saving insights:", error);
    return NextResponse.json(
      { error: "Failed to save insights" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/insights
 * Delete an insight
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

    const { insightId } = await req.json();

    await prisma.aIInsight.delete({
      where: {
        id: insightId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting insight:", error);
    return NextResponse.json(
      { error: "Failed to delete insight" },
      { status: 500 }
    );
  }
}
