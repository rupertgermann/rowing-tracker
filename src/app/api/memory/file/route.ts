import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return new Response(JSON.stringify({ error: "Missing documentId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const doc = await prisma.memoryDocument.findFirst({
    where: {
      id: documentId,
      userId: session.user.id,
    },
  });

  if (!doc || !doc.filePath) {
    return new Response(JSON.stringify({ error: "Document not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fullPath = path.join(process.cwd(), "storage", doc.filePath);
  const buffer = await readFile(fullPath);

  return new Response(buffer, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${String(doc.name || '').replace(/\"/g, "")}"`,
    },
  });
}
