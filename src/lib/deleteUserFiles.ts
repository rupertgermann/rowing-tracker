import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getMocapStorage } from "@/lib/mocap/storage";
import { avatarStorageDetails } from "@/lib/userAvatar";

// Keep database pointers until every deletion succeeds, so partial cleanup can be retried.
export async function deleteUserFiles(user: { id: string; image: string | null }) {
  if (!/^[a-zA-Z0-9_-]+$/.test(user.id)) {
    throw new Error("Invalid account file owner");
  }

  const sessions = await prisma.mocapSession.findMany({
    where: { userId: user.id },
    select: { videoStoragePath: true, poseStreamPath: true },
  });
  const storage = getMocapStorage();
  for (const session of sessions) {
    await storage.delete(session.videoStoragePath);
    await storage.delete(session.poseStreamPath);
  }
  const avatar = avatarStorageDetails(user.image, user.id);
  if (avatar) await storage.delete(avatar.storagePath);

  await fs.rm(path.join(process.cwd(), "storage", "memory", user.id), { recursive: true, force: true });
  await fs.rm(path.join(process.cwd(), "public", "assets", "awards", user.id), { recursive: true, force: true });
}
