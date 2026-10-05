import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';

dotenv.config({ path: '.env.local' });
dotenv.config();

const customLookup = (hostname, options, callback) => {
  if (hostname === 'pkenrmorywmuvnzfoylp.supabase.co') {
    if (options && options.all) return callback(null, [{ address: '172.64.149.246', family: 4 }]);
    return callback(null, '172.64.149.246', 4);
  }
  return dns.lookup(hostname, options, callback);
};

setGlobalDispatcher(new Agent({ connect: { lookup: customLookup, timeout: 30000 } }));

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setAdedibuDraft() {
  console.log('Setting Adedibu clip into Social Studio as a Draft...');

  const videoUrl = 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/social/clips/Adedibu_0m29s_1m50s_9x16.mp4';
  const filmId = '8b012aac-4814-4cff-9717-e8632af57121';
  const title = 'Adedibu — Scene Clip (0:29 – 1:50)';

  const snapshot = {
    kind: 'studio_video',
    capturedAt: new Date().toISOString(),
    title,
    filmId,
    publicUrl: videoUrl,
    width: 1080,
    height: 1920,
    startTime: '0:29',
    endTime: '1:50',
    aspectRatio: '9:16'
  };

  // 1. Insert social_content_items
  const { data: item, error: itemErr } = await supabase
    .from('social_content_items')
    .insert({
      content_type: 'studio_video',
      title,
      source_entity_type: 'film',
      source_entity_id: filmId,
      source_snapshot: snapshot,
      status: 'draft',
      generation_method: 'local_clipper',
      generation_notes: 'Clipped from YouTube 0:29 to 1:50 (9:16 vertical render) and hosted on Cloudflare R2'
    })
    .select('id')
    .single();

  if (itemErr) {
    console.error('Failed to insert social_content_item:', itemErr);
    return;
  }

  console.log('✅ Created social_content_item:', item.id);

  // 2. Insert social_assets
  const { data: asset, error: assetErr } = await supabase
    .from('social_assets')
    .insert({
      content_item_id: item.id,
      format: 'video_vertical_9_16',
      storage_bucket: 'external',
      storage_path: 'social/clips/Adedibu_0m29s_1m50s_9x16.mp4',
      public_url: videoUrl,
      mime_type: 'video/mp4',
      width: 1080,
      height: 1920,
      render_metadata: {
        source: 'local_clipper',
        format: '9:16',
        startTime: '0:29',
        endTime: '1:50',
        fps: 30
      }
    })
    .select('id')
    .single();

  if (assetErr) {
    console.error('Failed to insert social_asset:', assetErr);
  } else {
    console.log('✅ Created social_asset:', asset.id);
  }

  // 3. Insert platform variants
  const platforms = ['tiktok', 'instagram', 'youtube', 'x', 'threads', 'facebook'];
  const caption = 'Experience the tension and drama of Adedibu (2026). Catch this dramatic highlight scene now! 🎬🍿\n\n#Adedibu #Nollywood #Muvidb';

  const variants = platforms.map(platform => ({
    content_item_id: item.id,
    platform,
    status: 'draft',
    title,
    caption,
    hashtags: ['Adedibu', 'Nollywood', 'Muvidb'],
    selected_asset_id: asset?.id || null,
    platform_options: { source: 'local_clipper', media_kind: 'video', aspect_ratio: '9:16' }
  }));

  const { error: varErr } = await supabase.from('social_platform_variants').insert(variants);
  if (varErr) {
    console.error('Failed to insert variants:', varErr);
  } else {
    console.log(`✅ Created platform variants for: ${platforms.join(', ')}`);
  }

  console.log('🎉 Adedibu clip is now active as a Draft in Social Studio!');
}

setAdedibuDraft().catch(console.error);
