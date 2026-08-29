/**
 * Hook & utilities for direct client-side HD video uploads to Google Drive staging buffer.
 * Bypasses Vercel's 4.5MB serverless limit and handles up to 500MB video files.
 */

export async function uploadHDVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // 1. Validate up to 500MB (no longer blocked at 50MB)
  const MAX_SIZE = 500 * 1024 * 1024; // 500MB
  if (file.size > MAX_SIZE) {
    throw new Error('Video file size exceeds the 500MB limit.');
  }

  const resolvedMime = file.type || (file.name.toLowerCase().endsWith('.webm') ? 'video/webm' : (file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'video/webm'));

  // 2. Request direct upload URL from backend
  const sessionRes = await fetch('/api/drive/create-upload-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: resolvedMime,
      fileSize: file.size,
    }),
  });

  const resData = await sessionRes.json().catch(() => ({}));
  const { uploadUrl, error } = resData;
  if (error || !uploadUrl) {
    throw new Error(error || 'Could not obtain Google Drive upload URL');
  }

  // 3. Upload directly to Google Drive with progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', resolvedMime);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.id); // Google Drive File ID
        } catch {
          resolve(uploadUrl);
        }
      } else {
        reject(new Error(`Upload failed with status code ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during video upload'));
    xhr.send(file);
  });
}
