import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { imageExtension } from '@/lib/uploadValidation';

const AWARDS_DIR = path.join(process.cwd(), 'public', 'assets', 'awards');
const NEXT_DIR = path.join(process.cwd(), '.next');

/**
 * Clear Next.js image optimization cache
 * This removes cached optimized images in production builds.
 * Do not remove .next/dev/cache here: Turbopack writes to it while the dev
 * server is running, and deleting it during a request can trigger SST warnings.
 */
async function clearNextImageCache(): Promise<boolean> {
  const cachePaths = [
    path.join(NEXT_DIR, 'cache', 'images'),
  ];
  
  let cleared = false;
  
  for (const cachePath of cachePaths) {
    if (existsSync(cachePath)) {
      try {
        await rm(cachePath, { recursive: true, force: true });
        cleared = true;
      } catch (error) {
        console.error(`[ImageSave] Error clearing cache at ${cachePath}:`, error);
      }
    }
  }
  
  return cleared;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });

    const body = await request.json();
    const { awardId, imageData } = body;

    if (typeof awardId !== 'string' || !awardId || awardId.length > 200 || typeof imageData !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: awardId and imageData' },
        { status: 400 }
      );
    }

    // Bound decoded image size before allocating the base64 buffer.
    if (imageData.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be 10 MB or smaller' }, { status: 413 });
    }
    const match = imageData.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return NextResponse.json({ error: 'Expected a PNG, JPEG, or WebP data URL' }, { status: 400 });
    const buffer = Buffer.from(match[2], 'base64');
    const extension = imageExtension(buffer, match[1]);
    if (!extension) return NextResponse.json({ error: 'Image content does not match its type' }, { status: 400 });
    if (buffer.length > 10 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 10 MB or smaller' }, { status: 413 });
    const userDir = path.join(AWARDS_DIR, userId);
    await mkdir(userDir, { recursive: true });

    // Sanitize awardId for filename (replace special chars)
    const safeAwardId = awardId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeAwardId}.${extension}`;
    const filePath = path.join(userDir, filename);

    // Write the file
    await writeFile(filePath, buffer);
    for (const oldExtension of ['png', 'jpg', 'jpeg', 'webp']) {
      if (oldExtension !== extension) {
        await rm(path.join(userDir, `${safeAwardId}.${oldExtension}`), { force: true });
      }
    }

    // Clear Next.js image optimization cache to ensure fresh images are served
    const cacheCleared = await clearNextImageCache();

    // Return the public URL path
    const publicUrl = `/assets/awards/${userId}/${filename}`;

    return NextResponse.json({ 
      success: true,
      filePath: publicUrl,
      filename,
      cacheCleared
    });
  } catch (error) {
    console.error('Failed to save achievement image:', error);
    return NextResponse.json(
      { error: 'Failed to save image to filesystem' },
      { status: 500 }
    );
  }
}
