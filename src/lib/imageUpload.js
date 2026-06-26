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
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIM = 1600;              // px, longest edge

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
  if (file.size > MAX_BYTES) return 'Image must be under 5 MB.';
  if (!(await hasImageMagicBytes(file))) return "That file doesn't look like a real image.";
  return null;
}

// Decode and re-encode to a clean WebP blob (strips metadata + any payload,
// caps dimensions). Runs in the browser; rejects if the image can't decode.
export function reencodeToWebp(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))), 'image/webp', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
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

// Short-lived signed URL so an admin can preview a quarantined image.
export async function signedContributionUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from('contributions').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

// On approval: download the quarantined file, re-encode it again (defence in
// depth, in the trusted admin's browser), publish to the public film-images
// bucket, and return the public URL. Returns null on failure.
export async function publishContributionImage(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('contributions').download(path);
  if (error || !data) return null;

  let clean;
  try {
    clean = await reencodeToWebp(data);
  } catch {
    return null;
  }

  const dest = `people/${crypto.randomUUID()}.webp`;
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
