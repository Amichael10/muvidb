import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDriveUploadSession } from '../src/lib/googleDrive.js';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { fileName, mimeType, fileSize } = body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: 'Missing fileName or fileSize' });
    }

    const uploadUrl = await createDriveUploadSession(
      fileName,
      mimeType || 'video/mp4',
      Number(fileSize)
    );

    return res.status(200).json({ uploadUrl });
  } catch (error: any) {
    console.error('Upload session generation error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to create upload session' });
  }
}
