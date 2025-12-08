import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const AWARDS_DIR = path.join(process.cwd(), 'public', 'assets', 'awards');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { awardId, imageData } = body;

    if (!awardId || !imageData) {
      return NextResponse.json(
        { error: 'Missing required fields: awardId and imageData' },
        { status: 400 }
      );
    }

    // Ensure the awards directory exists
    if (!existsSync(AWARDS_DIR)) {
      await mkdir(AWARDS_DIR, { recursive: true });
    }

    // Extract base64 data from data URL
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { error: 'Invalid image data format. Expected base64 data URL.' },
        { status: 400 }
      );
    }

    const extension = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
    const base64Data = base64Match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Sanitize awardId for filename (replace special chars)
    const safeAwardId = awardId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeAwardId}.${extension}`;
    const filePath = path.join(AWARDS_DIR, filename);

    // Write the file
    await writeFile(filePath, buffer);

    // Return the public URL path
    const publicUrl = `/assets/awards/${filename}`;

    return NextResponse.json({ 
      success: true,
      filePath: publicUrl,
      filename
    });
  } catch (error) {
    console.error('Failed to save achievement image:', error);
    return NextResponse.json(
      { error: 'Failed to save image to filesystem' },
      { status: 500 }
    );
  }
}
