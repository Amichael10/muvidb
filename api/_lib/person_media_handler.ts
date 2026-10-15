import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { supabase } from './supabase.js';
import { handleCors } from './cors.js';
import { requireRequestQuota } from './request_quota.js';
import { createPendingMediaUpload, discardPendingMedia, mediaError, privateMediaPreview, resolveMediaSubmissionUrl } from './person_media_uploads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ['showreel', 'monologue', 'scene_clip', 'interview', 'headshot', 'production_still', 'red_carpet', 'behind_the_scenes'];
function text(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

export async function handlePersonMedia(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in to submit media' });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return res.status(401).json({ error: 'Invalid session' });
    const userId = auth.user.id;
    const { data: profile, error: profileError } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
    if (profileError || !profile) return res.status(403).json({ error: 'User profile unavailable' });
    const isAdmin = ['admin', 'admin_limited'].includes(profile.role);
    const payload = req.body || {};
    const personId = text(payload.person_id || payload.personId || req.query.personId, 36);
    const action = req.query.action || payload.action;
    const id = text(payload.id || req.query.id, 36);
    let existing: any = null;
    if (id) {
      if (!UUID.test(id)) throw mediaError('Invalid media ID');
      const { data, error } = await supabase.from('person_media').select('*').eq('id', id).maybeSingle();
      if (error) throw mediaError('Unable to load media', 503);
      if (!data) throw mediaError('Media not found', 404);
      existing = data;
      if (!isAdmin && (data.uploaded_by !== userId || data.status !== 'pending')) throw mediaError('Media edit access denied', 403);
    }
    if (req.method === 'GET') {
      if (!isAdmin) throw mediaError('Administrator access required', 403);
      if (!UUID.test(personId) && req.query.status !== 'pending') throw mediaError('Invalid person ID');
      let query = supabase.from('person_media').select('*, people(id,name,slug), films(id,title,year,poster_url)');
      query = UUID.test(personId) ? query.eq('person_id', personId) : query.eq('status', 'pending');
      const { data, error } = await query.order('created_at', { ascending: false }).limit(personId ? 200 : 50);
      if (error) throw mediaError('Unable to load media', 503);
      const records = await Promise.all((data || []).map(async (item: any) => ({ ...item,
        url: await privateMediaPreview(item.url), thumbnail_url: await privateMediaPreview(item.thumbnail_url),
      })));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ data: records });
    }
    if (req.method === 'DELETE') {
      if (!existing) throw mediaError('Media ID required');
      if (existing.status === 'pending' || existing.status === 'rejected') {
        await discardPendingMedia(existing.url); await discardPendingMedia(existing.thumbnail_url);
      }
      const { error } = await supabase.from('person_media').delete().eq('id', id);
      if (error) throw mediaError('Unable to delete media', 503);
      return res.status(200).json({ success: true });
    }
    if (!UUID.test(personId)) throw mediaError('Invalid person ID');
    if (existing && existing.person_id !== personId) throw mediaError('Cannot move media to another person');
    if (action === 'presign' || action === 'upload') {
      if (req.method !== 'POST') throw mediaError('Use POST for uploads', 405);
      if (!(await requireRequestQuota(req, res, 'person-media-upload', userId))) return;
      if (action === 'presign') {
        return res.status(200).json({ success: true, ...await createPendingMediaUpload(userId, personId, text(payload.mimeType, 80), Number(payload.fileSize)) });
      }
      if (typeof payload.fileBase64 !== 'string' || payload.fileBase64.length > 4 * 1024 * 1024) throw mediaError('Image upload exceeds 3 MB');
      let bytes: Buffer;
      try {
        const original = Buffer.from(payload.fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
        bytes = await sharp(original, { limitInputPixels: 40000000 }).rotate().jpeg({ quality: 90 }).toBuffer();
      } catch { throw mediaError('Please upload a valid raster image'); }
      return res.status(200).json({ success: true, ...await createPendingMediaUpload(userId, personId, 'image/jpeg', bytes.length, bytes) });
    }
    if (action === 'preview-upload') {
      const reference = `pending-media:${text(payload.key, 36)}`;
      const checked = await resolveMediaSubmissionUrl(reference, userId, personId, isAdmin, false);
      return res.status(200).json({ url: await privateMediaPreview(checked) });
    }
    if (!(await requireRequestQuota(req, res, 'person-media-submit', userId))) return;
    const mediaType = text(payload.media_type || existing?.media_type, 10);
    if (!['photo', 'video'].includes(mediaType)) throw mediaError('Choose photo or video');
    const category = ({ editorial: 'production_still', audition: 'monologue' } as Record<string, string>)[payload.category] || text(payload.category || existing?.category, 40);
    if (!CATEGORIES.includes(category)) throw mediaError('Invalid media category');
    const title = text(payload.title || existing?.title, 300);
    if (!title) throw mediaError('Title required');
    const status = isAdmin ? text(payload.status || existing?.status || 'approved', 20) : 'pending';
    if (!['pending', 'approved', 'rejected'].includes(status)) throw mediaError('Invalid moderation status');
    const approve = status === 'approved';
    const originalUrl = text(payload.url || existing?.url, 4096);
    const originalThumbnail = text(payload.thumbnail_url ?? existing?.thumbnail_url, 4096);
    const url = await resolveMediaSubmissionUrl(originalUrl, userId, personId, isAdmin, approve, mediaType);
    const thumbnail = originalThumbnail ? await resolveMediaSubmissionUrl(originalThumbnail, userId, personId, isAdmin, approve, 'photo') : null;
    const filmId = text(payload.film_id, 36);
    if (filmId && !UUID.test(filmId)) throw mediaError('Invalid film ID');
    const fields = { person_id: personId, media_type: mediaType, category, title, status, url,
      thumbnail_url: thumbnail, description: text(payload.description ?? existing?.description, 5000) || null,
      film_id: filmId || existing?.film_id || null, character_name: text(payload.character_name ?? existing?.character_name, 200) || null,
      photographer_credit: text(payload.photographer_credit ?? existing?.photographer_credit, 200) || null,
      embed_provider: text(payload.embed_provider ?? existing?.embed_provider, 30) || null,
      embed_id: text(payload.embed_id ?? existing?.embed_id, 100) || null,
      duration_seconds: Math.max(0, Math.min(7200, Math.floor(Number(payload.duration_seconds ?? existing?.duration_seconds) || 0))),
      year: Number.isInteger(Number(payload.year)) && Number(payload.year) >= 1880 && Number(payload.year) <= 2100 ? Number(payload.year) : existing?.year || null,
      is_primary: payload.is_primary == null ? Boolean(existing?.is_primary) : payload.is_primary === true,
      uploaded_by: existing?.uploaded_by || userId, updated_at: new Date().toISOString(),
    };
    const query = existing ? supabase.from('person_media').update(fields).eq('id', id) : supabase.from('person_media').insert(fields);
    const { data, error } = await query.select('*, films(id,title,year,poster_url,slug)').single();
    if (error) throw mediaError('Unable to save media', 503);
    if (approve && fields.is_primary) {
      const { error: primaryError } = await supabase.from('person_media').update({ is_primary: false })
        .eq('person_id', personId).eq('media_type', mediaType).neq('id', data.id).eq('status', 'approved');
      if (primaryError) throw mediaError('Media saved; unable to update its primary position', 503);
      if (mediaType === 'photo') {
        const { error: photoError } = await supabase.from('people').update({ photo_url: url }).eq('id', personId);
        if (photoError) throw mediaError('Media approved; unable to update the main portrait', 503);
      }
    }
    if (status === 'rejected') { await discardPendingMedia(url); await discardPendingMedia(thumbnail); }
    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('[person-media]', error);
    const status = [400, 403, 404, 405, 409, 429, 503].includes(error?.statusCode) ? error.statusCode : 500;
    return res.status(status).json({ error: status === 500 ? 'Unable to process media' : error.message });
  }
}
