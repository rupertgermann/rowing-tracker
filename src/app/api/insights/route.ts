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

    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { sessionsRevision: true, insightsRevision: true },
    });

    return NextResponse.json({
      insights,
      sessionsRevision: settings?.sessionsRevision ?? 0,
      insightsRevision: settings?.insightsRevision ?? 0,
    });
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

    const { insights, markAsCurrent } = await req.json();

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

    if (markAsCurrent) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { sessionsRevision: true },
      });

      await prisma.userSettings.upsert({
        where: { userId: session.user.id },
        update: {
          insightsRevision: settings?.sessionsRevision ?? 0,
        },
        create: {
          userId: session.user.id,
          theme: 'system',
          units: 'metric',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '24h',
          language: 'en',
          defaultChartType: 'line',
          animationsEnabled: true,
          cloudAIEnabled: false,
          maxTokens: 4000,
          insightsRevision: settings?.sessionsRevision ?? 0,
        },
      });
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
 * Delete insight(s) - single insight by ID or all insights for cache invalidation
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

    const body = await req.json().catch(() => ({}));
    const { insightId, archivedOnly } = body;

    if (insightId) {
      // Delete single insight
      await prisma.aIInsight.delete({
        where: {
          id: insightId,
          userId: session.user.id,
        },
      });
      console.log(`[INSIGHTS API] Deleted insight ${insightId}`);
    } else if (archivedOnly) {
      // Delete only archived insights (for "Clear Insights Archive" functionality)
      const result = await prisma.aIInsight.deleteMany({
        where: {
          userId: session.user.id,
          archived: true, // Only delete archived insights
        },
      });
      console.log(`[INSIGHTS API] Deleted ${result.count} archived insights`);
    } else {
      // Delete all insights for cache invalidation
      const result = await prisma.aIInsight.deleteMany({
        where: {
          userId: session.user.id,
          archived: false, // Only delete non-archived insights
        },
      });
      console.log(`[INSIGHTS API] Deleted ${result.count} insights for cache invalidation`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting insight:", error);
    return NextResponse.json(
      { error: "Failed to delete insight" },
      { status: 500 }
    );
  }
}
