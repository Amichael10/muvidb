import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { supabase } from './supabase.js';
import { uploadToR2 } from './r2.js';

const BUCKET = 'person-media-pending';
const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export function mediaError(message: string, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }

export async function createPendingMediaUpload(userId: string, personId: string, mimeType: string, byteSize: number, bytes?: Buffer) {
  if (!MIME_EXT[mimeType] || !Number.isInteger(byteSize) || byteSize < 1 || byteSize > 32 * 1024 * 1024) {
    throw mediaError('Use JPG, PNG, WebP, GIF, MP4, WebM, or MOV up to 32 MB');
  }
  const { count, error: countError } = await supabase.from('person_media_uploads').select('id', { count: 'exact', head: true }).is('reviewed_at', null);
  if (countError) throw mediaError('Upload capacity check unavailable', 503);
  if ((count || 0) >= 1000) throw mediaError('Upload review queue is full; please try again after review', 429);
  const id = randomUUID();
  const path = `${userId}/${id}.${MIME_EXT[mimeType]}`;
  const { error } = await supabase.from('person_media_uploads').insert({ id, uploaded_by: userId, person_id: personId,
    storage_path: path, mime_type: mimeType, byte_size: byteSize });
  if (error) throw mediaError('Unable to prepare upload', 503);
  let uploadUrl: string | undefined;
  if (bytes) {
    const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
    if (storageError) throw mediaError('Unable to store upload', 503);
  } else {
    const { data, error: storageError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (storageError || !data) throw mediaError('Unable to prepare upload', 503);
    uploadUrl = data.signedUrl;
  }
  if (!bytes) return { key: id, uploadUrl, publicUrl: `pending-media:${id}`, url: `pending-media:${id}` };
  const { data: preview, error: previewError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (previewError || !preview) throw mediaError('Unable to prepare private preview', 503);
  return { key: id, uploadUrl, publicUrl: preview.signedUrl, url: preview.signedUrl };
}

async function findPendingUpload(value: string) {
  let id: string | undefined;
  if (value.startsWith('pending-media:')) id = value.slice('pending-media:'.length);
  else {
    let url: URL;
    try { url = new URL(value); } catch { throw mediaError('Invalid media URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw mediaError('Use an HTTP or HTTPS media URL');
    const projectUrl = new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co');
    if (url.origin === projectUrl.origin && url.pathname.startsWith(`/storage/v1/object/sign/${BUCKET}/`)) {
      id = url.pathname.match(/\/([0-9a-f-]{36})\.[a-z0-9]+$/i)?.[1];
      if (!id) throw mediaError('Invalid pending upload');
    } else return null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw mediaError('Invalid pending upload');
  const { data, error } = await supabase.from('person_media_uploads').select('*').eq('id', id!).maybeSingle();
  if (error) throw mediaError('Unable to check upload', 503);
  if (!data) throw mediaError('Pending upload not found', 404);
  return data;
}

export async function resolveMediaSubmissionUrl(value: string, userId: string, personId: string, isAdmin: boolean, approve: boolean, expectedType?: string) {
  if (!value || value.length > 4096) throw mediaError('Invalid media URL');
  const upload = await findPendingUpload(value);
  if (!upload) return value;
  if (upload.person_id !== personId || (!isAdmin && upload.uploaded_by !== userId)) throw mediaError('Upload access denied', 403);
  if (expectedType && !upload.mime_type.startsWith(`${expectedType === 'photo' ? 'image' : 'video'}/`)) throw mediaError('Upload type does not match the media');
  if (!approve) return `pending-media:${upload.id}`;
  if (!isAdmin) throw mediaError('Administrator approval required', 403);
  if (upload.approved_url) return upload.approved_url;
  const { data: file, error } = await supabase.storage.from(BUCKET).download(upload.storage_path);
  if (error || !file) throw mediaError('Upload has not finished; retry after it completes', 409);
  if (file.size > 32 * 1024 * 1024 || file.size !== upload.byte_size) throw mediaError('Upload size does not match the submission');
  let bytes = Buffer.from(await file.arrayBuffer());
  let mimeType = upload.mime_type;
  let extension = MIME_EXT[mimeType];
  if (mimeType.startsWith('image/')) {
    try { bytes = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().jpeg({ quality: 90 }).toBuffer(); }
    catch { throw mediaError('The uploaded image could not be validated'); }
    mimeType = 'image/jpeg'; extension = 'jpg';
  } else {
    const mp4 = bytes.subarray(4, 8).toString() === 'ftyp';
    const webm = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if ((mimeType === 'video/webm' && !webm) || (mimeType !== 'video/webm' && !mp4)) throw mediaError('The uploaded video format is invalid');
  }
  const published = await uploadToR2(`media/approved/${personId}/${randomUUID()}.${extension}`, bytes, mimeType);
  const { error: recordError } = await supabase.from('person_media_uploads').update({ approved_url: published.url, reviewed_at: new Date().toISOString() }).eq('id', upload.id);
  if (recordError) throw mediaError('Unable to record approved upload', 503);
  await supabase.storage.from(BUCKET).remove([upload.storage_path]);
  return published.url;
}

export async function privateMediaPreview(value: string | null) {
  if (!value || !value.startsWith('pending-media:')) return value;
  const upload = await findPendingUpload(value);
  if (upload!.approved_url) return upload!.approved_url;
  if (upload!.reviewed_at) return '';
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(upload!.storage_path, 3600);
  if (error || !data) throw mediaError('Unable to create private preview', 503);
  return data.signedUrl;
}

export async function discardPendingMedia(value: string | null) {
  if (!value || !value.startsWith('pending-media:')) return;
  const upload = await findPendingUpload(value);
  if (!upload || upload.approved_url) return;
  const { error } = await supabase.storage.from(BUCKET).remove([upload.storage_path]);
  if (error) throw mediaError('Unable to discard rejected upload', 503);
  const { error: recordError } = await supabase.from('person_media_uploads').update({ reviewed_at: new Date().toISOString() }).eq('id', upload.id);
  if (recordError) throw mediaError('Unable to close rejected upload', 503);
}
