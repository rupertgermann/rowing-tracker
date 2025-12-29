import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 1. Calculate Sessions size
    const sessions = await prisma.rowingSession.findMany({
      where: { userId: session.user.id },
      include: { strokeData: true }
    });
    const sessionsSize = new TextEncoder().encode(JSON.stringify(sessions)).length;

    // 2. Calculate Chat History size
    const chatSessions = await prisma.chatSession.findMany({
      where: { userId: session.user.id },
      include: { messages: true }
    });
    const chatHistorySize = new TextEncoder().encode(JSON.stringify(chatSessions)).length;

    // 3. Calculate Training Plans size
    const trainingPlans = await prisma.trainingPlan.findMany({
      where: { userId: session.user.id },
      include: { 
        weeks: {
          include: { sessions: true }
        }
      }
    });
    const trainingPlansSize = new TextEncoder().encode(JSON.stringify(trainingPlans)).length;

    // 4. Calculate Insights Archive size
    const insights = await prisma.aIInsight.findMany({
      where: { userId: session.user.id }
    });
    const insightsSize = new TextEncoder().encode(JSON.stringify(insights)).length;

    // 5. Calculate Settings size
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id }
    });
    const settingsSize = userSettings ? new TextEncoder().encode(JSON.stringify(userSettings)).length : 0;

    return NextResponse.json({
      usage: {
        sessions: sessionsSize,
        chatHistory: chatHistorySize,
        trainingPlans: trainingPlansSize,
        insightsArchive: insightsSize,
        settings: settingsSize,
        total: sessionsSize + chatHistorySize + trainingPlansSize + insightsSize + settingsSize
      }
    });
  } catch (error) {
    console.error("Error calculating storage usage:", error);
    return NextResponse.json(
      { error: "Failed to calculate storage usage" },
      { status: 500 }
    );
  }
}
