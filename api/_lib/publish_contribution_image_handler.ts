import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';
import { handleCors } from './cors.js';

export async function handlePublishContributionImage(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();

    // Verify admin authentication
    const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
    if (!token) {
      return res.status(401).json({ error: 'Sign in to publish images' });
    }

    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();

    const isAdmin = ['admin', 'admin_limited'].includes(profile?.role || '');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const payload = req.body || {};
    const imagePath = String(payload.path || payload.image_path || '').trim();
    const folder = String(payload.folder || 'posters').trim().toLowerCase();

    if (!imagePath) {
      return res.status(400).json({ error: 'Missing image path' });
    }

    // 1. Download file from quarantined 'contributions' bucket using service role key
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from('contributions')
      .download(imagePath);

    let rawBuffer: Buffer | null = null;
    if (!dlErr && fileBlob) {
      rawBuffer = Buffer.from(await fileBlob.arrayBuffer());
    } else {
      // If direct download by path failed, try signed URL or check if it's already a full URL
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        const resp = await fetch(imagePath);
        if (resp.ok) {
          rawBuffer = Buffer.from(await resp.arrayBuffer());
        }
      }
    }

    if (!rawBuffer || rawBuffer.length === 0) {
      console.error('[publishContributionImage] Could not download image:', imagePath, dlErr);
      return res.status(404).json({
        error: `Could not download image from contributions storage (${dlErr?.message || 'not found'})`,
      });
    }

    // 2. Validate and re-encode to high quality WebP using sharp
    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(rawBuffer, { limitInputPixels: 50_000_000 })
        .rotate()
        .webp({ quality: 88, effort: 4 })
        .toBuffer();
    } catch (sharpErr) {
      console.warn('[publishContributionImage] Sharp re-encode failed, using raw buffer:', sharpErr);
      webpBuffer = rawBuffer;
    }

    const fileUuid = crypto.randomUUID();
    const targetBucket = ['posters', 'people', 'backdrops', 'film-images'].includes(folder)
      ? folder
      : 'film-images';

    const fileName = `${fileUuid}.webp`;

    // 3. Upload to target bucket
    const { error: upErr1 } = await supabase.storage
      .from(targetBucket)
      .upload(fileName, webpBuffer, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '31536000',
      });

    const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';

    if (!upErr1) {
      const publicUrl = `${base.replace(/\/$/, '')}/storage/v1/object/public/${targetBucket}/${fileName}`;
      // Clean up original quarantined image (best-effort)
      await supabase.storage.from('contributions').remove([imagePath]).catch(() => {});
      return res.status(200).json({ success: true, url: publicUrl });
    }

    console.warn(`[publishContributionImage] Target bucket upload to ${targetBucket} failed, trying film-images:`, upErr1);

    // 4. Fallback upload to film-images bucket
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '') || 'posters';
    const dest = `${safeFolder}/${fileName}`;
    const { error: upErr2 } = await supabase.storage
      .from('film-images')
      .upload(dest, webpBuffer, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '31536000',
      });

    if (upErr2) {
      console.error('[publishContributionImage] Both upload attempts failed:', upErr2);
      return res.status(500).json({ error: `Upload failed: ${upErr2.message}` });
    }

    const publicUrl = `${base.replace(/\/$/, '')}/storage/v1/object/public/film-images/${dest}`;
    await supabase.storage.from('contributions').remove([imagePath]).catch(() => {});
    return res.status(200).json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('[publishContributionImage] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Server error publishing image' });
  }
}
