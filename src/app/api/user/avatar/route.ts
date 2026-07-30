import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { applyRateLimit } from "@/lib/rateLimit";
import {
  AVATAR_MAX_BYTES,
  AvatarValidationError,
  avatarImageUrl,
  avatarStorageDetails,
  createAvatarStoragePath,
  validateAvatarImage,
} from "@/lib/userAvatar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });
  const avatar = avatarStorageDetails(user?.image, session.user.id);

  if (!avatar) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const storage = getMocapStorage();
  if (!(await storage.exists(avatar.storagePath))) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const bytes = await storage.read(avatar.storagePath);
  return new Response(new Uint8Array(bytes) as BodyInit, {
    headers: {
      "Content-Type": avatar.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await applyRateLimit(
    req,
    session.user.id,
    "upload",
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });
  }

  try {
    if (file.size > AVATAR_MAX_BYTES) {
      throw new AvatarValidationError("Avatar image must be 2 MB or smaller");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const imageType = validateAvatarImage(bytes, file.type);
    const storagePath = createAvatarStoragePath(
      session.user.id,
      imageType.extension,
    );
    const storage = getMocapStorage();
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });

    await storage.appendBytes(storagePath, bytes);

    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { image: storagePath },
      });
    } catch (error) {
      await storage.delete(storagePath);
      throw error;
    }

    const oldAvatar = avatarStorageDetails(
      currentUser?.image,
      session.user.id,
    );
    if (oldAvatar) {
      try {
        await storage.delete(oldAvatar.storagePath);
      } catch (error) {
        console.error("Failed to remove replaced avatar:", error);
      }
    }

    return NextResponse.json({ image: avatarImageUrl(storagePath) });
  } catch (error) {
    if (error instanceof AvatarValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await applyRateLimit(
    req,
    session.user.id,
    "upload",
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });
  const avatar = avatarStorageDetails(user?.image, session.user.id);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: null },
  });

  if (avatar) {
    try {
      await getMocapStorage().delete(avatar.storagePath);
    } catch (error) {
      console.error("Failed to remove avatar file:", error);
    }
  }

  return NextResponse.json({ image: null });
}
