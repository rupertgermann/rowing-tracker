import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/test/settings-sync
 * Test endpoint to verify settings database persistence
 * Returns current user settings and database status
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

    // Fetch current settings
    const settings = await prisma.userSettings.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    // Fetch API keys count
    const apiKeyCount = await prisma.userApiKey.count({
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      userId: session.user.id,
      userEmail: session.user.email,
      settingsExists: !!settings,
      settingsData: settings ? {
        theme: settings.theme,
        units: settings.units,
        language: settings.language,
        cloudAIEnabled: settings.cloudAIEnabled,
        maxTokens: settings.maxTokens,
        hasUserProfileContext: !!settings.userProfileContext,
        hasAIConfig: !!settings.aiConfig,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      } : null,
      apiKeyCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in settings sync test:", error);
    return NextResponse.json(
      { error: "Failed to test settings sync", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test/settings-sync
 * Test saving settings to database
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

    const testData = await req.json();

    // Save test settings
    const settings = await prisma.userSettings.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        theme: testData.theme || "system",
        units: testData.units || "metric",
        language: testData.language || "en",
      },
      create: {
        userId: session.user.id,
        theme: testData.theme || "system",
        units: testData.units || "metric",
        language: testData.language || "en",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
      settings: {
        theme: settings.theme,
        units: settings.units,
        language: settings.language,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error saving test settings:", error);
    return NextResponse.json(
      { error: "Failed to save test settings", details: String(error) },
      { status: 500 }
    );
  }
}
