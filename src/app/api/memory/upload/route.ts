import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import { validMemoryFile } from "@/lib/uploadValidation";
import { MEMORY_CONFIG } from "@/lib/memoryStorage";

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const maxBodySize = MEMORY_CONFIG.maxFileSize + 64 * 1024;
    if (Number(req.headers.get("Content-Length")) > maxBodySize) {
      return NextResponse.json({ error: "Upload request is too large" }, { status: 413 });
    }
    let received = 0;
    let bodyTooLarge = false;
    const limitedBody = req.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBodySize) {
          bodyTooLarge = true;
          throw new Error("Upload request is too large");
        }
        controller.enqueue(chunk);
      },
    }));
    let formData: FormData;
    try {
      formData = await new Response(limitedBody, { headers: req.headers }).formData();
    } catch (error) {
      if (bodyTooLarge) return NextResponse.json({ error: "Upload request is too large" }, { status: 413 });
      throw error;
    }
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MEMORY_CONFIG.maxFileSize) {
      return NextResponse.json({ error: "File must be 10 MB or smaller" }, { status: 413 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validMemoryFile(bytes, file.type)) {
      return NextResponse.json({ error: "Upload a valid JPEG, PNG, GIF, WebP, or PDF file" }, { status: 400 });
    }
    const description = formData.get("description");
    const tagsRaw = formData.get("tags");
    const uploadedAtRaw = formData.get("uploadedAt");
    if ((description !== null && typeof description !== "string") ||
        (tagsRaw !== null && typeof tagsRaw !== "string") ||
        (uploadedAtRaw !== null && typeof uploadedAtRaw !== "string")) {
      return NextResponse.json({ error: "Invalid document metadata" }, { status: 400 });
    }
    const uploadedAt = uploadedAtRaw ? new Date(uploadedAtRaw) : new Date();
    if (Number.isNaN(uploadedAt.getTime())) {
      return NextResponse.json({ error: "Invalid upload date" }, { status: 400 });
    }
    const userId = session.user.id;
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
    }

    const documentId = randomUUID();
    const filename = `${documentId}_${safeFilename(file.name)}`;
    const filePath = path.posix.join("memory", userId, filename);
    const created = await prisma.$transaction(async (tx) => {
      // Serialize quota reservations for this user, including concurrent uploads.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const usage = await tx.memoryDocument.aggregate({ where: { userId, size: { gt: 0 } }, _sum: { size: true } });
      if ((usage._sum.size ?? 0) + bytes.length > MEMORY_CONFIG.maxTotalStorage) return null;
      return tx.memoryDocument.create({
        data: {
          id: documentId,
          userId,
          filePath,
          name: file.name,
          type: file.type === "application/pdf" ? "pdf" : "image",
          source: "user",
          mimeType: file.type,
          size: bytes.length,
          description,
          tags: (tagsRaw || "").split(",").map(tag => tag.trim()).filter(Boolean),
          uploadedAt,
        },
      });
    });
    if (!created) return NextResponse.json({ error: "Memory storage limit of 50 MB exceeded" }, { status: 413 });

    const storageDir = path.join(process.cwd(), "storage", "memory", userId);
    const fullPath = path.join(storageDir, filename);
    try {
      await mkdir(storageDir, { recursive: true });
      await writeFile(fullPath, bytes);
      return NextResponse.json({ document: created });
    } catch (error) {
      try {
        await unlink(fullPath);
      } catch (cleanupError) {
        if (!cleanupError || typeof cleanupError !== "object" || !("code" in cleanupError) || cleanupError.code !== "ENOENT") {
          throw cleanupError;
        }
      }
      await prisma.memoryDocument.delete({ where: { id: created.id } });
      throw error;
    }
  } catch (error) {
    console.error("Error uploading memory document:", error);
    return NextResponse.json(
      { error: "Failed to upload memory document" },
      { status: 500 }
    );
  }
}
