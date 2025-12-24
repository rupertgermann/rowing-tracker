import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { rm } from "fs/promises";
import path from "path";

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
            ...(docData.name !== undefined ? { name: docData.name } : {}),
            ...(docData.type !== undefined ? { type: docData.type } : {}),
            ...(docData.mimeType !== undefined ? { mimeType: docData.mimeType } : {}),
            ...(docData.size !== undefined ? { size: docData.size } : {}),
            ...(docData.description !== undefined ? { description: docData.description } : {}),
            ...(docData.extractedText !== undefined ? { extractedText: docData.extractedText } : {}),
            ...(docData.tags !== undefined ? { tags: docData.tags } : {}),
            ...(docData.content !== undefined ? { content: docData.content } : {}),
            ...(docData.status !== undefined ? { status: docData.status } : {}),
          },
        });

        savedDocuments.push(updated);
      } else {
        // Create new document
        const created = await prisma.memoryDocument.create({
          data: {
            userId: session.user.id,
            name: docData.name,
            type: docData.type,
            source: docData.source || 'user',
            mimeType: docData.mimeType || 'application/octet-stream',
            size: docData.size,
            description: docData.description,
            extractedText: docData.extractedText,
            tags: docData.tags || [],
            content: docData.content,
            status: docData.status,
            uploadedAt: docData.uploadedAt ? new Date(docData.uploadedAt) : new Date(),
          },
        });

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

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    const existing = await prisma.memoryDocument.findFirst({
      where: {
        id: documentId,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const existingAny = existing as any;
    if (existingAny.filePath) {
      const fullPath = path.join(process.cwd(), "storage", existingAny.filePath);
      await rm(fullPath, { force: true });
    }

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
