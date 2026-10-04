import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { getCorsHeaders } from './cors.js';
import { uploadToR2 } from './r2.js';

function cors(req: VercelRequest, res: VercelResponse) {
  const headers = getCorsHeaders(req);
  res.setHeader('Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, DELETE, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

export async function handlePersonMedia(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'DELETE') {
      const id = String(req.query.id || req.body?.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Missing media id' });

      const { error } = await supabase.from('person_media').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // Presign action for direct large video/photo upload straight from browser to Cloudflare R2
    if (req.method === 'POST' && (req.query.action === 'presign' || payload.action === 'presign')) {
      const { fileName, mimeType, personName, personId } = payload;
      const { createR2UploadUrl } = await import('./r2.js');
      const safeName = (fileName || 'media.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
      const folderName = (personName || personId || 'general').trim();
      const key = `media/actors/${folderName}/${Date.now()}_${safeName}`;

      const presigned = await createR2UploadUrl(key, mimeType || 'video/mp4', 1800);
      return res.status(200).json({ success: true, uploadUrl: presigned.uploadUrl, publicUrl: presigned.publicUrl, key: presigned.key });
    }

    // Direct base64 upload action directly to Cloudflare R2 under actor's folder
    if (req.method === 'POST' && (req.query.action === 'upload' || payload.action === 'upload')) {
      const { fileBase64, fileName, mimeType, personName, personId } = payload;
      if (!fileBase64) {
        return res.status(400).json({ error: 'fileBase64 is required for upload' });
      }

      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const fileBytes = Buffer.from(base64Data, 'base64');
      const safeName = (fileName || 'cover.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const folderName = (personName || personId || 'general').trim();
      const key = `media/actors/${folderName}/${Date.now()}_${safeName}`;

      const uploaded = await uploadToR2(key, fileBytes, mimeType || 'image/jpeg');
      return res.status(200).json({ success: true, url: uploaded.url, key: uploaded.key });
    }

    if (req.method === 'POST' || req.method === 'PUT') {

      if (!payload.person_id) {
        return res.status(400).json({ error: 'Missing person_id' });
      }
      if (!payload.url || !payload.title) {
        return res.status(400).json({ error: 'Title and URL are required' });
      }

      // If set as primary, un-primary other items of same media_type for this person
      if (payload.is_primary && payload.media_type) {
        await supabase
          .from('person_media')
          .update({ is_primary: false })
          .eq('person_id', payload.person_id)
          .eq('media_type', payload.media_type);
      }

      if (payload.id) {
        // Update
        const { id, films, created_at, ...updateFields } = payload;
        const { data, error } = await supabase
          .from('person_media')
          .update({
            ...updateFields,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*, films(id, title, year, poster_url, slug)')
          .single();

        if (error) throw error;
        return res.status(200).json({ data });
      } else {
        // Insert
        const { films, id, ...insertFields } = payload;
        const { data, error } = await supabase
          .from('person_media')
          .insert({
            ...insertFields,
            status: insertFields.status || 'approved',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('*, films(id, title, year, poster_url, slug)')
          .single();

        if (error) throw error;
        return res.status(200).json({ data });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('handlePersonMedia error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
