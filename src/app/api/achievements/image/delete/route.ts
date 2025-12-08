import { NextRequest, NextResponse } from 'next/server';
import { unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const AWARDS_DIR = path.join(process.cwd(), 'public', 'assets', 'awards');
const NEXT_DIR = path.join(process.cwd(), '.next');

/**
 * Clear Next.js image optimization cache
 * This removes all cached optimized images, forcing regeneration on next request
 * Handles both production (.next/cache/images) and dev/Turbopack (.next/dev/cache/images)
 */
async function clearNextImageCache(): Promise<boolean> {
  const cachePaths = [
    // Production cache
    path.join(NEXT_DIR, 'cache', 'images'),
    path.join(NEXT_DIR, 'cache', 'fetch-cache'),
    // Development/Turbopack cache
    path.join(NEXT_DIR, 'dev', 'cache', 'images'),
    path.join(NEXT_DIR, 'dev', 'cache'),
  ];
  
  let cleared = false;
  
  for (const cachePath of cachePaths) {
    if (existsSync(cachePath)) {
      try {
        await rm(cachePath, { recursive: true, force: true });
        console.log(`[ImageDelete] Cleared Next.js cache: ${cachePath}`);
        cleared = true;
      } catch (error) {
        console.error(`[ImageDelete] Error clearing cache at ${cachePath}:`, error);
      }
    }
  }
  
  if (!cleared) {
    console.log('[ImageDelete] No cache directories found to clear');
  }
  
  return cleared;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { awardId } = body;

    if (!awardId) {
      return NextResponse.json(
        { error: 'Missing required field: awardId' },
        { status: 400 }
      );
    }

    // Sanitize awardId for filename
    const safeAwardId = awardId.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Try common extensions
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    let deleted = false;

    for (const ext of extensions) {
      const filePath = path.join(AWARDS_DIR, `${safeAwardId}.${ext}`);
      if (existsSync(filePath)) {
        await unlink(filePath);
        deleted = true;
        break;
      }
    }

    // Clear Next.js image optimization cache
    let cacheCleared = false;
    if (deleted) {
      cacheCleared = await clearNextImageCache();
    }

    return NextResponse.json({ 
      success: true,
      deleted,
      cacheCleared
    });
  } catch (error) {
    console.error('Failed to delete achievement image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image from filesystem' },
      { status: 500 }
    );
  }
}
