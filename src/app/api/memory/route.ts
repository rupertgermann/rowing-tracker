import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/memory
 * Fetch all memory documents for the authenticated user
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

    const documents = await prisma.memoryDocument.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        blob: true,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error fetching memory documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch memory documents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory
 * Create or update memory documents
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

    const savedDocuments = [];

    for (const docData of documents) {
      // Check if document exists
      const existing = await prisma.memoryDocument.findFirst({
        where: {
          id: docData.id,
          userId: session.user.id,
        },
      });

      if (existing) {
        // Update existing document
        const updated = await prisma.memoryDocument.update({
          where: { id: existing.id },
          data: {
            name: docData.name,
            type: docData.type,
            size: docData.size,
            description: docData.description,
            tags: docData.tags,
          },
        });

        // Update blob if provided
        if (docData.blobData) {
          await prisma.memoryBlob.upsert({
            where: { documentId: existing.id },
            update: {
              data: Buffer.from(docData.blobData, 'base64'),
            },
            create: {
              documentId: existing.id,
              data: Buffer.from(docData.blobData, 'base64'),
            },
          });
        }

        savedDocuments.push(updated);
      } else {
        // Create new document
        const created = await prisma.memoryDocument.create({
          data: {
            userId: session.user.id,
            name: docData.name,
            type: docData.type,
            size: docData.size,
            description: docData.description,
            tags: docData.tags,
            uploadedAt: docData.uploadedAt ? new Date(docData.uploadedAt) : new Date(),
          },
        });

        // Create blob if provided
        if (docData.blobData) {
          await prisma.memoryBlob.create({
            data: {
              documentId: created.id,
              data: Buffer.from(docData.blobData, 'base64'),
            },
          });
        }

        savedDocuments.push(created);
      }
    }

    return NextResponse.json({ 
      documents: savedDocuments,
      count: savedDocuments.length 
    });
  } catch (error) {
    console.error("Error saving memory documents:", error);
    return NextResponse.json(
      { error: "Failed to save memory documents" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/memory
 * Delete a memory document
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

    await prisma.memoryDocument.delete({
      where: {
        id: documentId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting memory document:", error);
    return NextResponse.json(
      { error: "Failed to delete memory document" },
      { status: 500 }
    );
  }
}
