import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/settings
 * Fetch user settings
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

    const settings = await prisma.userSettings.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({ 
        settings: {
          theme: 'system',
          units: 'metric',
          dateFormat: 'MM/DD/YYYY',
          timeFormat: '24h',
          language: 'en',
          defaultChartType: 'line',
          animationsEnabled: true,
          cloudAIEnabled: false,
          maxTokens: 4000,
          sessionsRevision: 0,
          insightsRevision: 0,
          userProfileContext: null,
          userProfileRawInput: null,
          aiConfig: null,
          customPromptsAi: null,
        }
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings
 * Create or update user settings
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

    const settingsData = await req.json();

    // Build update object with only provided fields
    const updateData: any = {};
    
    // User preferences
    if (settingsData.theme !== undefined) updateData.theme = settingsData.theme;
    if (settingsData.units !== undefined) updateData.units = settingsData.units;
    if (settingsData.dateFormat !== undefined) updateData.dateFormat = settingsData.dateFormat;
    if (settingsData.timeFormat !== undefined) updateData.timeFormat = settingsData.timeFormat;
    if (settingsData.language !== undefined) updateData.language = settingsData.language;
    if (settingsData.timeZone !== undefined) updateData.timeZone = settingsData.timeZone;
    if (settingsData.defaultChartType !== undefined) updateData.defaultChartType = settingsData.defaultChartType;
    if (settingsData.animationsEnabled !== undefined) updateData.animationsEnabled = settingsData.animationsEnabled;
    if (settingsData.showPromptSuggestions !== undefined) updateData.showPromptSuggestions = settingsData.showPromptSuggestions;
    if (settingsData.customPrompts !== undefined) updateData.customPrompts = settingsData.customPrompts;
    
    // Training settings
    if (settingsData.trainingZones !== undefined) updateData.trainingZones = settingsData.trainingZones;
    if (settingsData.preferredMetrics !== undefined) updateData.preferredMetrics = settingsData.preferredMetrics;
    if (settingsData.weeklyGoalType !== undefined) updateData.weeklyGoalType = settingsData.weeklyGoalType;
    if (settingsData.weeklyGoalTarget !== undefined) updateData.weeklyGoalTarget = settingsData.weeklyGoalTarget;
    if (settingsData.restDayAlerts !== undefined) updateData.restDayAlerts = settingsData.restDayAlerts;
    if (settingsData.adaptationEnabled !== undefined) updateData.adaptationEnabled = settingsData.adaptationEnabled;
    
    // Notification settings
    if (settingsData.sessionReminders !== undefined) updateData.sessionReminders = settingsData.sessionReminders;
    if (settingsData.weeklyProgress !== undefined) updateData.weeklyProgress = settingsData.weeklyProgress;
    if (settingsData.achievementAlerts !== undefined) updateData.achievementAlerts = settingsData.achievementAlerts;
    if (settingsData.planReminders !== undefined) updateData.planReminders = settingsData.planReminders;
    if (settingsData.adherenceAlerts !== undefined) updateData.adherenceAlerts = settingsData.adherenceAlerts;
    
    // AI settings
    if (settingsData.cloudAIEnabled !== undefined) updateData.cloudAIEnabled = settingsData.cloudAIEnabled;
    if (settingsData.maxTokens !== undefined) updateData.maxTokens = settingsData.maxTokens;
    if (settingsData.aiConfig !== undefined) updateData.aiConfig = settingsData.aiConfig;
    if (settingsData.customPromptsAi !== undefined) updateData.customPromptsAi = settingsData.customPromptsAi;

    // Revision markers (used for cache invalidation)
    if (settingsData.sessionsRevision !== undefined) updateData.sessionsRevision = settingsData.sessionsRevision;
    if (settingsData.insightsRevision !== undefined) updateData.insightsRevision = settingsData.insightsRevision;
    
    // User profile context
    if (settingsData.userProfileContext !== undefined) updateData.userProfileContext = settingsData.userProfileContext;
    if (settingsData.userProfileRawInput !== undefined) updateData.userProfileRawInput = settingsData.userProfileRawInput;
    
    // Dashboard and view settings
    if (settingsData.dashboardSettings !== undefined) updateData.dashboardSettings = settingsData.dashboardSettings;
    if (settingsData.sessionsViewSettings !== undefined) updateData.sessionsViewSettings = settingsData.sessionsViewSettings;
    if (settingsData.sessionAnalysisSettings !== undefined) updateData.sessionAnalysisSettings = settingsData.sessionAnalysisSettings;
    if (settingsData.chartSettings !== undefined) updateData.chartSettings = settingsData.chartSettings;
    if (settingsData.analyticsSettings !== undefined) updateData.analyticsSettings = settingsData.analyticsSettings;

    // Upsert settings
    const settings = await prisma.userSettings.upsert({
      where: {
        userId: session.user.id,
      },
      update: updateData,
      create: {
        userId: session.user.id,
        theme: settingsData.theme || 'system',
        units: settingsData.units || 'metric',
        dateFormat: settingsData.dateFormat || 'MM/DD/YYYY',
        timeFormat: settingsData.timeFormat || '24h',
        language: settingsData.language || 'en',
        defaultChartType: settingsData.defaultChartType || 'line',
        animationsEnabled: settingsData.animationsEnabled !== false,
        cloudAIEnabled: settingsData.cloudAIEnabled || false,
        maxTokens: settingsData.maxTokens || 4000,
        userProfileContext: settingsData.userProfileContext,
        userProfileRawInput: settingsData.userProfileRawInput,
        sessionsRevision: settingsData.sessionsRevision || 0,
        insightsRevision: settingsData.insightsRevision || 0,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
