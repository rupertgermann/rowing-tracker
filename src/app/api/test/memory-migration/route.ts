import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/test/memory-migration
 * Test endpoint to verify memory migration infrastructure
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

    // Get memory document count
    const documentCount = await prisma.memoryDocument.count({
      where: {
        userId: session.user.id,
      },
    });

    // Get memory blob count
    const blobCount = await prisma.memoryBlob.count();

    // Get storage stats
    const documents = await prisma.memoryDocument.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        size: true,
        type: true,
        blob: {
          select: {
            id: true,
          },
        },
      },
    });

    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
    const docsWithBlobs = documents.filter(doc => doc.blob).length;

    return NextResponse.json({
      success: true,
      userId: session.user.id,
      documents: {
        count: documentCount,
        totalSize,
        withBlobs: docsWithBlobs,
        byType: documents.reduce((acc, doc) => {
          acc[doc.type] = (acc[doc.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      blobs: {
        count: blobCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in memory migration test:", error);
    return NextResponse.json(
      { error: "Failed to test memory migration", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test/memory-migration
 * Test creating a memory document with blob
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

    const { name, type, mimeType, blobData } = await req.json();

    if (!name || !type || !mimeType) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, mimeType" },
        { status: 400 }
      );
    }

    // Create test document
    const document = await prisma.memoryDocument.create({
      data: {
        userId: session.user.id,
        name,
        type,
        source: 'user',
        mimeType,
        size: blobData ? Buffer.byteLength(blobData, 'base64') : 0,
        description: 'Test document',
        tags: ['test'],
      },
    });

    // Create blob if provided
    if (blobData) {
      await prisma.memoryBlob.create({
        data: {
          documentId: document.id,
          data: Buffer.from(blobData, 'base64'),
        },
      });
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        type: document.type,
        size: document.size,
        hasBlob: !!blobData,
      },
    });
  } catch (error) {
    console.error("Error creating test memory document:", error);
    return NextResponse.json(
      { error: "Failed to create test memory document", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/test/memory-migration
 * Test deleting a memory document
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

    const { documentId } = await req.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    // Verify document belongs to user
    const document = await prisma.memoryDocument.findFirst({
      where: {
        id: documentId,
        userId: session.user.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete document (blob will cascade delete)
    await prisma.memoryDocument.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting test memory document:", error);
    return NextResponse.json(
      { error: "Failed to delete test memory document", details: String(error) },
      { status: 500 }
    );
  }
}
