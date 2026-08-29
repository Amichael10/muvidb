import { NextResponse } from 'next/server';
import { createDriveUploadSession } from '@/lib/googleDrive';

export async function POST(req: Request) {
  try {
    const { fileName, mimeType, fileSize } = await req.json();
    if (!fileName || !fileSize) {
      return NextResponse.json({ error: 'Missing fileName or fileSize' }, { status: 400 });
    }
    const uploadUrl = await createDriveUploadSession(
      fileName,
      mimeType || 'video/mp4',
      Number(fileSize)
    );
    return NextResponse.json({ uploadUrl });
  } catch (error: any) {
    console.error('Upload session generation error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create upload session' }, { status: 500 });
  }
}
