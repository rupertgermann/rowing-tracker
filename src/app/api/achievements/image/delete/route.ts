import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const AWARDS_DIR = path.join(process.cwd(), 'public', 'assets', 'awards');

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

    return NextResponse.json({ 
      success: true,
      deleted
    });
  } catch (error) {
    console.error('Failed to delete achievement image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image from filesystem' },
      { status: 500 }
    );
  }
}
