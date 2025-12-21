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
          aiProvider: 'openai',
          aiModel: 'gpt-4o-mini',
          userProfileContext: null,
          userProfileRawInput: null,
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

    // Upsert settings
    const settings = await prisma.userSettings.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        theme: settingsData.theme,
        aiProvider: settingsData.aiProvider,
        aiModel: settingsData.aiModel,
        userProfileContext: settingsData.userProfileContext,
        userProfileRawInput: settingsData.userProfileRawInput,
      },
      create: {
        userId: session.user.id,
        theme: settingsData.theme || 'system',
        aiProvider: settingsData.aiProvider || 'openai',
        aiModel: settingsData.aiModel || 'gpt-4o-mini',
        userProfileContext: settingsData.userProfileContext,
        userProfileRawInput: settingsData.userProfileRawInput,
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
