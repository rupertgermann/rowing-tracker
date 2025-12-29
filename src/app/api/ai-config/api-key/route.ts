import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";

/**
 * Encryption utilities for API keys
 */
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function encryptApiKey(apiKey: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decryptApiKey(encrypted: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(iv, "hex")
  );
  
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * GET /api/ai-config/api-key
 * Retrieve decrypted API key for a provider
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Provider parameter required" },
        { status: 400 }
      );
    }

    const apiKey = await prisma.userApiKey.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider,
        },
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { apiKey: null },
        { status: 200 }
      );
    }

    // Decrypt the API key
    try {
      const decrypted = decryptApiKey(apiKey.encryptedKey, apiKey.encryptedKey.substring(0, 32), apiKey.encryptedKey.substring(32, 64));
      return NextResponse.json({ apiKey: decrypted });
    } catch (error) {
      console.error("Failed to decrypt API key:", error);
      return NextResponse.json(
        { error: "Failed to decrypt API key" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching API key:", error);
    return NextResponse.json(
      { error: "Failed to fetch API key" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-config/api-key
 * Save encrypted API key for a provider
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

    const { provider, apiKey } = await req.json();

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and apiKey required" },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const { encrypted, iv, authTag } = encryptApiKey(apiKey);
    const encryptedData = `${iv}:${authTag}:${encrypted}`;

    // Create hash for verification
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const savedKey = await prisma.userApiKey.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider,
        },
      },
      update: {
        encryptedKey: encryptedData,
        keyHash,
      },
      create: {
        userId: session.user.id,
        provider,
        encryptedKey: encryptedData,
        keyHash,
      },
    });

    return NextResponse.json({ 
      success: true,
      provider: savedKey.provider,
    });
  } catch (error) {
    console.error("Error saving API key:", error);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-config/api-key
 * Delete API key for a provider
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

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Provider parameter required" },
        { status: 400 }
      );
    }

    await prisma.userApiKey.delete({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
