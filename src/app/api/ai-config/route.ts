import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  buildUserSettingsCreateData,
  USER_SETTINGS_DEFAULT_VALUES,
} from "@/lib/server/userSettings";

/**
 * GET /api/ai-config
 * Fetch user's AI configuration (without sensitive keys)
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
      select: {
        aiConfig: true,
        cloudAIEnabled: true,
        maxTokens: true,
      },
    });

    return NextResponse.json({ 
      config: settings || {
        aiConfig: null,
        cloudAIEnabled: USER_SETTINGS_DEFAULT_VALUES.cloudAIEnabled,
        maxTokens: USER_SETTINGS_DEFAULT_VALUES.maxTokens,
      }
    });
  } catch (error) {
    console.error("Error fetching AI config:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-config
 * Save user's AI configuration
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

    const configData = await req.json();

    const settings = await prisma.userSettings.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        aiConfig: configData.aiConfig,
        cloudAIEnabled: configData.cloudAIEnabled,
        maxTokens: configData.maxTokens,
      },
      create: buildUserSettingsCreateData(session.user.id, {
        aiConfig: configData.aiConfig,
        cloudAIEnabled:
          configData.cloudAIEnabled || USER_SETTINGS_DEFAULT_VALUES.cloudAIEnabled,
        maxTokens: configData.maxTokens || USER_SETTINGS_DEFAULT_VALUES.maxTokens,
      }),
      select: {
        aiConfig: true,
        cloudAIEnabled: true,
        maxTokens: true,
      },
    });

    return NextResponse.json({ config: settings });
  } catch (error) {
    console.error("Error saving AI config:", error);
    return NextResponse.json(
      { error: "Failed to save AI config" },
      { status: 500 }
    );
  }
}
