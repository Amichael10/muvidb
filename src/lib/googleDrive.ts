import { google } from 'googleapis';
import { Readable } from 'stream';

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

/**
 * Creates a resumable direct upload URL to allow client-side streaming.
 * Completely bypasses Vercel 4.5MB request limits.
 */
export async function createDriveUploadSession(
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<string> {
  const token = await auth.getAccessToken();
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': fileSize.toString(),
      },
      body: JSON.stringify({
        name: `temp_${Date.now()}_${fileName}`,
        parents: [FOLDER_ID],
      }),
    }
  );

  const uploadUrl = res.headers.get('location');
  if (!uploadUrl) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to generate Google Drive resumable upload URL: ${errText || res.statusText}`);
  }
  return uploadUrl;
}

/**
 * Fetches stream of the video to send to Instagram/TikTok/YouTube
 */
export async function getVideoStreamFromDrive(fileId: string): Promise<Readable> {
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return response.data as Readable;
}

/**
 * Immediately deletes the video from Google Drive after posting to maintain 0 MB usage
 */
export async function deleteVideoFromDrive(fileId: string): Promise<void> {
  try {
    await drive.files.delete({ fileId });
    console.log(`[Cleanup] Deleted temporary video ${fileId} from Google Drive`);
  } catch (error) {
    console.error(`[Cleanup Error] Failed to delete file ${fileId}:`, error);
  }
}
