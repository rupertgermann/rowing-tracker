import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { applyRateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limit: 5 requests per minute for sensitive operations
    const rateLimitResponse = await applyRateLimit(req, session.user.id, "sensitive");
    if (rateLimitResponse) return rateLimitResponse;

    const userId = session.user.id;

    // Fetch all user data in parallel
    const [
      user,
      rowingSessions,
      personalRecords,
      earnedAwards,
      trainingPlans,
      chatSessions,
      aiInsights,
      generatedAchievements,
      memoryDocuments,
      userSettings,
    ] = await Promise.all([
      // User profile (excluding sensitive fields)
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // Rowing sessions with stroke data
      prisma.rowingSession.findMany({
        where: { userId },
        include: {
          strokeData: true,
        },
        orderBy: { timestamp: "desc" },
      }),

      // Personal records
      prisma.personalRecord.findMany({
        where: { userId },
        orderBy: { achievedAt: "desc" },
      }),

      // Earned awards
      prisma.earnedAward.findMany({
        where: { userId },
        orderBy: { earnedAt: "desc" },
      }),

      // Training plans with weeks and sessions
      prisma.trainingPlan.findMany({
        where: { userId },
        include: {
          weeks: {
            include: {
              sessions: {
                include: {
                  actualSessionLinks: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Chat sessions with messages
      prisma.chatSession.findMany({
        where: { userId },
        include: {
          messages: {
            orderBy: { timestamp: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // AI insights
      prisma.aIInsight.findMany({
        where: { userId },
        orderBy: { dateGenerated: "desc" },
      }),

      // Generated achievements (excluding binary image data)
      prisma.generatedAchievement.findMany({
        where: { userId },
        select: {
          id: true,
          awardId: true,
          story: true,
          imageUrl: true,
          hasImage: true,
          earnedAt: true,
          generatedAt: true,
        },
        orderBy: { generatedAt: "desc" },
      }),

      // Memory documents (excluding binary blob data)
      prisma.memoryDocument.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          extractedText: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      }),

      // User settings
      prisma.userSettings.findUnique({
        where: { userId },
      }),
    ]);

    // Compile export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportFormat: "GDPR-compliant data export",
      user: user,
      settings: userSettings,
      rowingSessions: rowingSessions.map((s) => ({
        ...s,
        strokeData: s.strokeData.map((sd) => ({
          timestamp: sd.timestamp,
          strokeIndex: sd.strokeIndex,
          split: sd.split,
          power: sd.power,
          strokeRate: sd.strokeRate,
          distance: sd.distance,
          heartRate: sd.heartRate,
        })),
      })),
      personalRecords,
      earnedAwards,
      trainingPlans,
      chatSessions: chatSessions.map((cs) => ({
        id: cs.id,
        title: cs.title,
        category: cs.category,
        createdAt: cs.createdAt,
        updatedAt: cs.updatedAt,
        messages: cs.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      })),
      aiInsights,
      generatedAchievements,
      memoryDocuments,
      statistics: {
        totalRowingSessions: rowingSessions.length,
        totalDistance: rowingSessions.reduce((sum, s) => sum + (s.distance || 0), 0),
        totalDuration: rowingSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        totalPersonalRecords: personalRecords.length,
        totalAwards: earnedAwards.length,
        totalTrainingPlans: trainingPlans.length,
        totalChatMessages: chatSessions.reduce((sum, cs) => sum + cs.messages.length, 0),
      },
    };

    // Return as downloadable JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const fileName = `rowing-tracker-export-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
