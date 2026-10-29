import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { supabase } from './supabase.js';
import { handleCors } from './cors.js';
import { requireRequestQuota } from './request_quota.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = [
  'poster', 'backdrop', 'production_still', 'behind_the_scenes',
  'red_carpet', 'premiere', 'screencap', 'wallpaper', 'trailer', 'clip'
];

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function handleFilmMedia(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    const filmId = text(payload.film_id || payload.filmId || req.query.filmId, 36);
    const id = text(payload.id || req.query.id, 36);

    // Public GET for approved media of a film
    if (req.method === 'GET') {
      if (!UUID.test(filmId)) {
        return res.status(400).json({ error: 'Invalid or missing filmId' });
      }

      const { data, error } = await supabase
        .from('film_media')
        .select('*')
        .eq('film_id', filmId)
        .eq('status', 'approved')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      return res.status(200).json({ data: data || [] });
    }

    // Mutations require authentication
    const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in to manage film media' });

    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return res.status(401).json({ error: 'Invalid session' });
    const userId = auth.user.id;

    const { data: profile } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
    const isAdmin = ['admin', 'admin_limited'].includes(profile?.role || '');

    if (req.method === 'DELETE') {
      if (!id || !UUID.test(id)) return res.status(400).json({ error: 'Invalid media ID' });

      let query = supabase.from('film_media').delete().eq('id', id);
      if (!isAdmin) {
        query = query.eq('uploaded_by', userId);
      }
      const { error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    // POST / PUT: Upload or Save
    if (!UUID.test(filmId)) return res.status(400).json({ error: 'Invalid film ID' });

    const action = req.query.action || payload.action;

    // Direct buffer upload to storage bucket
    if (action === 'upload') {
      if (!(await requireRequestQuota(req, res, 'film-media-upload', userId))) return;

      if (typeof payload.fileBase64 !== 'string' || payload.fileBase64.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image upload exceeds 8 MB' });
      }

      let bytes: Buffer;
      try {
        const raw = Buffer.from(payload.fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
        bytes = await sharp(raw, { limitInputPixels: 50000000 }).rotate().jpeg({ quality: 90 }).toBuffer();
      } catch {
        return res.status(400).json({ error: 'Please upload a valid raster image' });
      }

      const fileName = `${filmId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { data: storageData, error: sErr } = await supabase.storage
        .from('film-media')
        .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true });

      if (sErr) return res.status(500).json({ error: sErr.message });

      const { data: pubUrl } = supabase.storage.from('film-media').getPublicUrl(fileName);
      return res.status(200).json({ success: true, url: pubUrl.publicUrl, key: fileName });
    }

    // Record creation or update
    const mediaType = text(payload.media_type || payload.mediaType || 'photo', 10);
    const category = text(payload.category || 'production_still', 40);
    const title = text(payload.title || '', 300);
    const description = text(payload.description || '', 1000);
    const url = text(payload.url, 2000);

    if (!url) return res.status(400).json({ error: 'Media URL is required' });

    const record = {
      film_id: filmId,
      media_type: mediaType,
      category: CATEGORIES.includes(category) ? category : 'production_still',
      title: title || null,
      description: description || null,
      url,
      thumbnail_url: text(payload.thumbnail_url || payload.thumbnailUrl || url, 2000) || null,
      r2_key: text(payload.r2_key || payload.r2Key || payload.key, 300) || null,
      embed_provider: text(payload.embed_provider || payload.embedProvider, 30) || null,
      embed_id: text(payload.embed_id || payload.embedId, 100) || null,
      width: Number(payload.width) || null,
      height: Number(payload.height) || null,
      aspect_ratio: text(payload.aspect_ratio || payload.aspectRatio, 20) || null,
      photographer_credit: text(payload.photographer_credit || payload.photographerCredit, 200) || null,
      year: Number(payload.year) || null,
      is_primary: Boolean(payload.is_primary || payload.isPrimary),
      sort_order: Number(payload.sort_order || payload.sortOrder) || 0,
      status: isAdmin ? (payload.status || 'approved') : 'approved',
      uploaded_by: userId,
      updated_at: new Date().toISOString()
    };

    if (id && UUID.test(id)) {
      const { data, error } = await supabase
        .from('film_media')
        .update(record)
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    const { data, error } = await supabase
      .from('film_media')
      .insert(record)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  } catch (err: any) {
    console.error('[film-media]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
