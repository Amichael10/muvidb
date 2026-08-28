// Safe handling of user-contributed images. The threat model: a user could try
// to upload something that isn't really an image, an SVG with a script, or a
// "polyglot" file. Defences here:
//   * accept only PNG / JPEG / WebP (no SVG — SVG can carry scripts)
//   * verify the file's magic bytes, not just its extension/MIME
//   * re-encode through a <canvas>, which reads only pixels and re-emits a fresh
//     WebP — this destroys any embedded payload/metadata
//   * uploads land in a PRIVATE quarantine bucket (admin-only read); the public
//     image is only produced by re-encoding again at approval time
import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024; // Browser-safety cap; never uploaded as-is.
const TARGET_BYTES = 4.5 * 1024 * 1024;       // Leave headroom under Storage's 5 MB limit.
const MAX_DIM = 2000;                          // px, longest edge after processing.

// Verify the real file type from its leading bytes.
async function hasImageMagicBytes(file) {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp =
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; // WEBP
  return png || jpeg || webp;
}

export async function validateImage(file) {
  if (!file) return 'No file selected.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only PNG, JPEG or WebP images are allowed.';
  if (file.size > MAX_ORIGINAL_BYTES) return 'That photo is unusually large. Please choose one under 40 MB.';
  if (!(await hasImageMagicBytes(file))) return "That file doesn't look like a real image.";
  return null;
}

// Decode and re-encode to a clean WebP blob (strips metadata + any payload,
// caps dimensions). Runs in the browser; rejects if the image can't decode.
function canvasBlob(canvas, quality, mimeType = 'image/webp') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))), mimeType, quality);
  });
}

function reencodeImage(fileOrBlob, targetBytes, mimeType) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      let scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      let w = Math.max(1, Math.round(img.width * scale));
      let h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      try {
        // Most portraits land under the target on the first pass. If a very
        // detailed image does not, lower quality first and dimensions second.
        for (let sizePass = 0; sizePass < 4; sizePass += 1) {
          canvas.width = w;
          canvas.height = h;
          const context = canvas.getContext('2d', { alpha: false });
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(img, 0, 0, w, h);
          for (const quality of [0.88, 0.8, 0.72, 0.64, 0.56]) {
            const blob = await canvasBlob(canvas, quality, mimeType);
            if (blob.size <= targetBytes) {
              resolve(blob);
              return;
            }
          }
          // Keep the original aspect ratio while reducing both edges together.
          w = Math.max(1, Math.round(w * 0.82));
          h = Math.max(1, Math.round(h * 0.82));
        }
        reject(new Error('Could not compress image below upload limit'));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

export function reencodeToWebp(fileOrBlob, targetBytes = TARGET_BYTES) {
  return reencodeImage(fileOrBlob, targetBytes, 'image/webp');
}

export function reencodeToJpeg(fileOrBlob, targetBytes = TARGET_BYTES) {
  return reencodeImage(fileOrBlob, targetBytes, 'image/jpeg');
}

// Validate → re-encode → upload to the private quarantine bucket.
// Returns { path } or { error }.
export async function uploadContributionImage(file) {
  const err = await validateImage(file);
  if (err) return { error: err };

  let blob;
  try {
    blob = await reencodeToWebp(file);
  } catch {
    return { error: 'Could not process that image. Try a different file.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in to upload.' };

  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage
    .from('contributions')
    .upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (upErr) return { error: upErr.message };
  return { path };
}

// --- Admin side -----------------------------------------------------------

// Hosts whose image URLs are signed and expire (the `oh=`/`oe=` params), so a
// pasted link renders today and 404s within days. They're also on the server's
// SKIP_DOMAINS list, meaning the mirror cron will never rescue them.
const EPHEMERAL_HOST = /(cdninstagram\.com|fbcdn\.net|instagram\.f)/i;

export function isEphemeralImageUrl(url) {
  return !!url && EPHEMERAL_HOST.test(url);
}

// Admins are trusted, so their uploads skip the quarantine bucket and land
// straight in a public one. Validation and the canvas re-encode still run:
// they cost nothing here and keep a malformed file from being served off our
// own domain.
// Returns { url } or { error }.
export async function uploadAdminImage(file, bucket = 'film-images') {
  const err = await validateImage(file);
  if (err) return { error: err };

  let blob;
  try {
    blob = await reencodeToWebp(file);
  } catch {
    return { error: 'Could not process that image. Try a different file.' };
  }

  const path = `${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '31536000', // 1 year — the UUID name makes it immutable
    });
  if (upErr) return { error: upErr.message };

  const base = import.meta.env.VITE_SUPABASE_URL || '';
  return { url: `${base}/storage/v1/object/public/${bucket}/${path}` };
}

// Meta's Instagram publishing API accepts JPEG images for feed publishing.
// Carousel artwork is therefore re-encoded locally to JPEG before upload;
// this keeps compression free and prevents a later provider-side format error.
export async function uploadAdminSocialImage(file, bucket = 'film-images') {
  const err = await validateImage(file);
  if (err) return { error: err };

  let blob;
  try {
    blob = await reencodeToJpeg(file);
  } catch {
    return { error: 'Could not process that image. Try a different file.' };
  }

  const path = `social/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '31536000',
    });
  if (upErr) return { error: upErr.message };

  const base = import.meta.env.VITE_SUPABASE_URL || '';
  return { url: `${base}/storage/v1/object/public/${bucket}/${path}` };
}

const MAX_SOCIAL_VIDEO_BYTES = 50 * 1024 * 1024;

async function validateVideoSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  // WebM / EBML header (0x1A 0x45 0xDF 0xA3)
  const isWebM = bytes.length >= 4
    && bytes[0] === 0x1A
    && bytes[1] === 0x45
    && bytes[2] === 0xDF
    && bytes[3] === 0xA3;

  // ISO base media files (MP4/MOV) expose an `ftyp` or `moov` box near the beginning
  const isMp4OrMov = bytes.length >= 12
    && ((bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) ||
        (bytes[4] === 0x6D && bytes[5] === 0x6F && bytes[6] === 0x6F && bytes[7] === 0x76));

  return isWebM || isMp4OrMov;
}

// Social videos are already compressed media. Upload the video without canvas processing,
// while checking MIME, size and file signature. Supports MP4, WebM, and MOV.
export async function uploadAdminSocialVideo(file, bucket = 'social-published-assets') {
  if (!file) return { error: 'No video selected.' };
  const type = file.type || '';
  const isWebM = type === 'video/webm' || file.name?.toLowerCase().endsWith('.webm');
  const isMp4 = type === 'video/mp4' || file.name?.toLowerCase().endsWith('.mp4');
  const isMov = type === 'video/quicktime' || file.name?.toLowerCase().endsWith('.mov');

  if (!isWebM && !isMp4 && !isMov && !type.startsWith('video/')) {
    return { error: 'Please select a supported video format (.mp4, .webm, or .mov).' };
  }
  if (file.size > MAX_SOCIAL_VIDEO_BYTES) return { error: 'Video uploads are limited to 50 MB in Social Studio.' };
  if (!(await validateVideoSignature(file))) return { error: "That file doesn't look like a valid video (.mp4, .webm, or .mov)." };

  const ext = isWebM ? 'webm' : (isMov ? 'mov' : 'mp4');
  const contentType = isWebM ? 'video/webm' : (isMov ? 'video/quicktime' : 'video/mp4');
  const path = `social/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: false,
      cacheControl: '31536000',
    });
  if (upErr) return { error: upErr.message };

  const base = import.meta.env.VITE_SUPABASE_URL || '';
  return { url: `${base}/storage/v1/object/public/${bucket}/${path}`, mediaType: 'video' };
}

export async function uploadAdminSocialMedia(file, bucket = 'social-published-assets') {
  if (file?.type?.startsWith('video/')) return uploadAdminSocialVideo(file, bucket);
  const result = await uploadAdminSocialImage(file, bucket);
  return result.error ? result : { ...result, mediaType: 'image' };
}

// Short-lived signed URL so an admin can preview a quarantined image.
export async function signedContributionUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from('contributions').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

// On approval: download the quarantined file, re-encode it again (defence in
// depth, in the trusted admin's browser), publish to the public film-images
// bucket, and return the public URL. Returns null on failure.
// `folder` is typically 'people' (portrait) or 'posters' (film art).
export async function publishContributionImage(path, folder = 'people') {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('contributions').download(path);
  if (error || !data) return null;

  let clean;
  try {
    clean = await reencodeToWebp(data);
  } catch {
    return null;
  }

  const safeFolder = String(folder || 'people').replace(/[^a-z0-9_-]/gi, '') || 'people';
  const dest = `${safeFolder}/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage
    .from('film-images')
    .upload(dest, clean, { contentType: 'image/webp', upsert: true });
  if (upErr) return null;

  const base = import.meta.env.VITE_SUPABASE_URL || '';
  return `${base}/storage/v1/object/public/film-images/${dest}`;
}

export async function deleteContributionImage(path) {
  if (!path) return;
  try {
    await supabase.storage.from('contributions').remove([path]);
  } catch {
    /* best effort */
  }
}
