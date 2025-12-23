import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/memory/migrate
 * Migrate memory documents from IndexedDB to database
 * This endpoint is called from the client after fetching documents from IndexedDB
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

    const { documents } = await req.json();

    if (!Array.isArray(documents)) {
      return NextResponse.json(
        { error: "Invalid documents data" },
        { status: 400 }
      );
    }

    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const docData of documents) {
      try {
        // Check if document already exists in database
        const existing = await prisma.memoryDocument.findFirst({
          where: {
            id: docData.id,
            userId: session.user.id,
          },
        });

        if (existing) {
          // Skip if already migrated
          continue;
        }

        // Create new document
        const created = await prisma.memoryDocument.create({
          data: {
            id: docData.id,
            userId: session.user.id,
            name: docData.name,
            type: docData.type,
            source: docData.source,
            mimeType: docData.mimeType,
            size: docData.size,
            description: docData.description,
            extractedText: docData.extractedText,
            tags: docData.tags || [],
            content: docData.content,
            status: docData.status,
            uploadedAt: docData.uploadedAt ? new Date(docData.uploadedAt) : new Date(),
          },
        });

        // Create blob if provided
        if (docData.blobData) {
          try {
            await prisma.memoryBlob.create({
              data: {
                documentId: created.id,
                data: Buffer.from(docData.blobData, 'base64'),
              },
            });
          } catch (blobError) {
            console.error(`Failed to create blob for document ${docData.id}:`, blobError);
            errors.push(`Blob for ${docData.id}: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`);
            failed++;
            continue;
          }
        }

        migrated++;
      } catch (error) {
        failed++;
        errors.push(`Document ${docData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: failed === 0,
      migrated,
      failed,
      total: documents.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error migrating memory documents:", error);
    return NextResponse.json(
      { error: "Failed to migrate memory documents", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/memory/migrate
 * Get migration status
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

    // Count documents in database
    const documentCount = await prisma.memoryDocument.count({
      where: {
        userId: session.user.id,
      },
    });

    // Count blobs in database
    const blobCount = await prisma.memoryBlob.count();

    return NextResponse.json({
      success: true,
      documentCount,
      blobCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting migration status:", error);
    return NextResponse.json(
      { error: "Failed to get migration status" },
      { status: 500 }
    );
  }
}
