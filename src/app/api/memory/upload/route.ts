import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const description = (formData.get("description") as string | null) || null;
    const tagsRaw = (formData.get("tags") as string | null) || "";
    const tags = tagsRaw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const uploadedAtRaw = (formData.get("uploadedAt") as string | null) || null;
    const uploadedAt = uploadedAtRaw ? new Date(uploadedAtRaw) : new Date();

    const type = (file.type || "").startsWith("image/") ? "image" : (file.type === "application/pdf" ? "pdf" : "note");

    const created = await prisma.memoryDocument.create({
      data: {
        userId: session.user.id,
        name: file.name,
        type,
        source: "user",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        description,
        tags,
        uploadedAt,
      },
    });

    const storageDir = path.join(process.cwd(), "storage", "memory", session.user.id);
    await mkdir(storageDir, { recursive: true });

    const filename = `${created.id}_${safeFilename(file.name)}`;
    const fullPath = path.join(storageDir, filename);

    const arrayBuffer = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(arrayBuffer));

    const filePath = path.posix.join("memory", session.user.id, filename);

    const updated = await prisma.memoryDocument.update({
      where: { id: created.id },
      data: { filePath } as any,
    });

    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error("Error uploading memory document:", error);
    return NextResponse.json(
      { error: "Failed to upload memory document" },
      { status: 500 }
    );
  }
}
