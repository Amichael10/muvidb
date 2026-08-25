import { supabase } from './supabase.js';

const INTAKE_SOCIAL_PLATFORMS = ['instagram', 'facebook', 'threads', 'tiktok'] as const;

export const INTAKE_KINDS = ['unclassified', 'social_post', 'film', 'critic_review', 'credits', 'news'] as const;
export type SocialIntakeKind = (typeof INTAKE_KINDS)[number];

type IntakeMetadata = Record<string, any> & {
  intake_kind?: SocialIntakeKind;
  workflow_status?: 'received' | 'processing' | 'needs_review' | 'approved' | 'rejected' | 'applied' | 'failed';
  extracted_payload?: Record<string, any>;
  admin_notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  applied_entity_type?: string | null;
  applied_entity_id?: string | null;
};

function metadataOf(value: unknown): IntakeMetadata {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
}

function cleanText(value: unknown, max = 5000): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function cleanNumber(value: unknown, min: number, max: number): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function captionWithThreeHashtags(value: unknown, fallback: string): string {
  const source = cleanText(value, 2200) || fallback;
  let hashtagCount = 0;
  return source
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, match => {
      hashtagCount += 1;
      return hashtagCount <= 3 ? match : '';
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function publicSourceArtwork(metadata: IntakeMetadata): string | null {
  const value = cleanText(metadata.image_url || metadata.thumbnail_url, 2000);
  if (!value || !/^https:\/\//i.test(value)) return null;
  // Telegram file URLs contain the bot token. They may be shown transiently in
  // the private inbox, but must never be persisted as a publishable asset.
  if (/api\.telegram\.org\/file\/bot/i.test(value)) return null;
  return value;
}

/**
 * Converts a Telegram intake item into the canonical Social Studio queue.
 * It is idempotent, so repeated bot taps or admin clicks return the same draft.
 */
export async function createSocialDraftFromIntake(input: {
  intakeId: string;
  captions?: Record<string, unknown>;
  actorId?: string | null;
}) {
  const { data: item, error } = await supabase
    .from('social_news_events')
    .select('*')
    .eq('id', input.intakeId)
    .eq('source_type', 'telegram_bot')
    .maybeSingle();
  if (error) throw error;
  if (!item) throw Object.assign(new Error('Telegram intake item not found'), { status: 404 });

  const metadata = metadataOf(item.metadata);
  const existingId = cleanText(metadata.canonical_content_item_id, 80);
  if (existingId) return { id: existingId, existing: true };
  const { data: existingItems, error: existingError } = await supabase
    .from('social_content_items')
    .select('id')
    .eq('source_entity_type', 'social_news_event')
    .eq('source_entity_id', item.id)
    .in('status', ['generating', 'draft', 'ready_for_review', 'approved', 'scheduled'])
    .limit(1);
  if (existingError) throw existingError;
  if (existingItems?.[0]?.id) {
    metadata.canonical_content_item_id = existingItems[0].id;
    await supabase.from('social_news_events').update({ metadata, status: 'converted_to_draft' }).eq('id', item.id);
    return { id: existingItems[0].id, existing: true };
  }

  const supplied = input.captions && typeof input.captions === 'object' ? input.captions : {};
  const fallback = cleanText(item.description, 2200) || cleanText(item.title, 200) || 'Discover this story on MuviDB.';
  const title = cleanText(supplied.headline || item.title, 200) || 'Telegram social draft';
  const sourceSnapshot = {
    kind: 'telegram_intake',
    capturedAt: new Date().toISOString(),
    intakeId: item.id,
    title,
    description: cleanText(item.description, 10000),
    sourceUrl: cleanText(item.source_url, 2000),
    sourceType: item.event_type,
    imageUrl: publicSourceArtwork(metadata),
    videoAvailableInTelegram: Boolean(metadata.telegram_video_file_id),
  };

  const { data: contentItem, error: itemError } = await supabase
    .from('social_content_items')
    .insert({
      content_type: 'telegram_intake',
      title,
      source_entity_type: 'social_news_event',
      source_entity_id: item.id,
      source_snapshot: sourceSnapshot,
      status: 'generating',
      generation_method: input.actorId ? 'admin_intake' : 'telegram_bot',
      generation_notes: 'Verify source rights and facts before approval. Replace source artwork when necessary.',
      created_by: input.actorId || null,
    })
    .select('id')
    .single();
  if (itemError) throw itemError;

  let assetId: string | null = null;
  const artwork = sourceSnapshot.imageUrl;
  if (artwork) {
    const { data: asset, error: assetError } = await supabase
      .from('social_assets')
      .insert({
        content_item_id: contentItem.id,
        format: 'landscape_16_9',
        storage_bucket: 'external',
        storage_path: artwork,
        public_url: artwork,
        mime_type: /\.webp(?:$|\?)/i.test(artwork) ? 'image/webp' : /\.png(?:$|\?)/i.test(artwork) ? 'image/png' : 'image/jpeg',
        width: cleanNumber(metadata.image_width, 1, 10000) || 1280,
        height: cleanNumber(metadata.image_height, 1, 10000) || 720,
        file_size_bytes: 0,
        render_metadata: { source: 'telegram_intake', source_url: item.source_url, rights_confirmation_required: true },
      })
      .select('id')
      .single();
    if (assetError) {
      await supabase.from('social_content_items').update({ generation_notes: `Source artwork could not be attached: ${assetError.message}` }).eq('id', contentItem.id);
    } else {
      assetId = asset.id;
    }
  }

  const captions: Record<string, unknown> = {
    instagram: supplied.instagram_caption,
    facebook: supplied.facebook_caption || supplied.instagram_caption,
    threads: supplied.threads_post || supplied.x_post,
    tiktok: supplied.tiktok_caption || supplied.instagram_caption,
  };
  const variants = INTAKE_SOCIAL_PLATFORMS.map(platform => ({
    content_item_id: contentItem.id,
    platform,
    status: 'draft',
    caption: captionWithThreeHashtags(captions[platform], fallback),
    title: platform === 'facebook' ? title : null,
    hashtags: [],
    mentions: [],
    selected_asset_id: assetId,
    platform_options: {
      source_url: item.source_url || null,
      source_rights_confirmation_required: true,
      telegram_intake_id: item.id,
      playable_video_available_in_telegram: Boolean(metadata.telegram_video_file_id),
    },
  }));
  const { error: variantsError } = await supabase.from('social_platform_variants').insert(variants);
  if (variantsError) {
    await supabase.from('social_content_items').update({ status: 'failed', generation_notes: variantsError.message }).eq('id', contentItem.id);
    throw variantsError;
  }

  await supabase.from('social_content_items').update({ status: 'draft' }).eq('id', contentItem.id);
  metadata.intake_kind = 'social_post';
  metadata.workflow_status = 'needs_review';
  metadata.canonical_content_item_id = contentItem.id;
  await supabase
    .from('social_news_events')
    .update({ status: 'converted_to_draft', metadata, updated_at: new Date().toISOString() })
    .eq('id', item.id);

  return { id: contentItem.id, existing: false, assetAttached: Boolean(assetId) };
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `film-${Date.now()}`;
}

async function uniqueFilmSlug(title: string, year: number | null): Promise<string> {
  const base = slugify(`${title}${year ? `-${year}` : ''}`);
  let candidate = base;
  for (let suffix = 2; suffix < 50; suffix += 1) {
    const { data } = await supabase.from('films').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

export async function listSocialIntake(input: { limit?: number; workflowStatus?: string | null; kind?: string | null } = {}) {
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 100);
  const { data, error } = await supabase
    .from('social_news_events')
    .select('id,event_type,entity_type,entity_id,title,description,source_type,source_url,detected_at,event_date,urgency,confidence,status,draft_id,metadata,created_at,updated_at')
    .eq('source_type', 'telegram_bot')
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data || [])
    .map(row => {
      const metadata = metadataOf(row.metadata);
      return {
        ...row,
        metadata,
        intake_kind: metadata.intake_kind || (row.event_type === 'critic_review' ? 'critic_review' : 'unclassified'),
        workflow_status: metadata.workflow_status || (row.status === 'ignored' ? 'rejected' : 'received'),
        extracted_payload: metadata.extracted_payload || {},
      };
    })
    .filter(row => !input.workflowStatus || row.workflow_status === input.workflowStatus)
    .filter(row => !input.kind || row.intake_kind === input.kind);
}

export async function updateSocialIntake(input: {
  intakeId: string;
  title?: string;
  description?: string;
  kind?: string;
  payload?: Record<string, any>;
  workflowStatus?: string;
  adminNotes?: string | null;
}) {
  const { data: current, error } = await supabase
    .from('social_news_events')
    .select('id,metadata,status')
    .eq('id', input.intakeId)
    .eq('source_type', 'telegram_bot')
    .maybeSingle();
  if (error) throw error;
  if (!current) throw Object.assign(new Error('Telegram intake item not found'), { status: 404 });

  const metadata = metadataOf(current.metadata);
  if (input.kind && INTAKE_KINDS.includes(input.kind as SocialIntakeKind)) metadata.intake_kind = input.kind as SocialIntakeKind;
  if (input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)) {
    metadata.extracted_payload = { ...(metadata.extracted_payload || {}), ...input.payload };
  }
  if (input.workflowStatus) metadata.workflow_status = input.workflowStatus as IntakeMetadata['workflow_status'];
  if (input.adminNotes !== undefined) metadata.admin_notes = cleanText(input.adminNotes, 2000);

  const patch: Record<string, unknown> = { metadata, updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = cleanText(input.title, 200) || 'Telegram intake';
  if (input.description !== undefined) patch.description = cleanText(input.description, 10000);

  const { data, error: updateError } = await supabase
    .from('social_news_events')
    .update(patch)
    .eq('id', input.intakeId)
    .select('*')
    .single();
  if (updateError) throw updateError;
  return data;
}

export async function rejectSocialIntake(input: { intakeId: string; reason?: string | null }, actorId: string) {
  const { data: current, error } = await supabase
    .from('social_news_events')
    .select('id,metadata')
    .eq('id', input.intakeId)
    .eq('source_type', 'telegram_bot')
    .maybeSingle();
  if (error) throw error;
  if (!current) throw Object.assign(new Error('Telegram intake item not found'), { status: 404 });
  const metadata = metadataOf(current.metadata);
  metadata.workflow_status = 'rejected';
  metadata.rejected_by = actorId;
  metadata.rejected_at = new Date().toISOString();
  metadata.rejection_reason = cleanText(input.reason, 1000);
  const { error: updateError } = await supabase
    .from('social_news_events')
    .update({ status: 'ignored', metadata, updated_at: new Date().toISOString() })
    .eq('id', input.intakeId);
  if (updateError) throw updateError;
  return { ok: true, id: input.intakeId, workflow_status: 'rejected' };
}

export async function approveSocialIntake(input: { intakeId: string; payload?: Record<string, any> }, actorId: string) {
  const { data: item, error } = await supabase
    .from('social_news_events')
    .select('*')
    .eq('id', input.intakeId)
    .eq('source_type', 'telegram_bot')
    .maybeSingle();
  if (error) throw error;
  if (!item) throw Object.assign(new Error('Telegram intake item not found'), { status: 404 });

  const metadata = metadataOf(item.metadata);
  const kind = metadata.intake_kind || 'unclassified';
  const payload = { ...(metadata.extracted_payload || {}), ...(input.payload || {}) };
  let appliedEntityType: string | null = null;
  let appliedEntityId: string | null = null;

  if (kind === 'film') {
    const title = cleanText(payload.title || item.title, 200);
    const synopsis = cleanText(payload.synopsis || item.description, 10000);
    if (!title) throw Object.assign(new Error('Film title is required before approval'), { status: 400 });
    if (!synopsis || synopsis.length < 40) {
      throw Object.assign(new Error('Add a proper synopsis of at least 40 characters before approving this film'), { status: 400 });
    }

    const year = cleanNumber(payload.year, 1880, new Date().getFullYear() + 10);
    const runtime = cleanNumber(payload.runtime_minutes || payload.runtime, 1, 1000);
    const genres = Array.isArray(payload.genres)
      ? payload.genres.map((value: unknown) => cleanText(value, 50)).filter(Boolean)
      : String(payload.genres || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 12);
    const filmPatch: Record<string, unknown> = {
      title,
      synopsis,
      year,
      runtime_minutes: runtime,
      duration: runtime,
      genres,
      poster_url: cleanText(payload.poster_url || metadata.image_url, 2000),
      backdrop_url: cleanText(payload.backdrop_url, 2000),
      release_date: cleanText(payload.release_date, 30),
      status: ['released', 'upcoming', 'announced', 'filming', 'in_production', 'post-production'].includes(payload.status)
        ? payload.status
        : 'announced',
      content_type: cleanText(payload.content_type, 50) || 'movie',
      countries: Array.isArray(payload.countries) ? payload.countries.slice(0, 10) : ['Nigeria'],
      source: 'telegram_intake',
      trailer_external_url: /youtu(?:\.be|be\.com)/i.test(item.source_url || '') ? item.source_url : null,
      is_published: true,
      needs_review: false,
      updated_at: new Date().toISOString(),
    };

    const matchedFilmId = cleanText(payload.film_id || payload.matched_film_id, 80);
    if (matchedFilmId) {
      const { data: updated, error: filmError } = await supabase.from('films').update(filmPatch).eq('id', matchedFilmId).select('id').single();
      if (filmError) throw filmError;
      appliedEntityId = updated.id;
    } else {
      const { data: duplicate } = await supabase
        .from('films')
        .select('id,title,year')
        .ilike('title', title)
        .limit(5);
      const exact = (duplicate || []).find(candidate => candidate.title.trim().toLowerCase() === title.toLowerCase() && (!year || !candidate.year || candidate.year === year));
      if (exact) {
        throw Object.assign(new Error(`A matching film already exists (${exact.title}${exact.year ? `, ${exact.year}` : ''}). Select it as the existing film before approval.`), { status: 409 });
      }
      const slug = await uniqueFilmSlug(title, year);
      const { data: created, error: filmError } = await supabase.from('films').insert({ ...filmPatch, slug }).select('id').single();
      if (filmError) throw filmError;
      appliedEntityId = created.id;
    }
    appliedEntityType = 'film';
  } else if (kind === 'critic_review') {
    const filmId = cleanText(payload.film_id || item.entity_id, 80);
    const quote = cleanText(payload.quote, 4000);
    const criticName = cleanText(payload.critic_name, 200);
    if (!filmId) throw Object.assign(new Error('Match this review to a film before approval'), { status: 400 });
    if (!quote) throw Object.assign(new Error('Review quote is required before approval'), { status: 400 });
    if (!criticName && !payload.is_anonymous) throw Object.assign(new Error('Critic name is required before approval'), { status: 400 });
    const rawRating = cleanNumber(payload.rating, 0, 100);
    const ratingScale = cleanNumber(payload.rating_scale, 1, 100) || 10;
    const rating = rawRating == null ? null : Math.round(Math.min(10, (rawRating / ratingScale) * 10) * 10) / 10;
    const { data: created, error: reviewError } = await supabase
      .from('critic_reviews')
      .insert({
        film_id: filmId,
        critic_id: cleanText(payload.critic_id, 80),
        critic_name: payload.is_anonymous ? null : criticName,
        critic_title: cleanText(payload.critic_title || payload.publication, 250),
        quote,
        rating,
        review_url: cleanText(payload.review_url || item.source_url, 2000),
        is_anonymous: Boolean(payload.is_anonymous),
        is_featured: payload.is_featured !== false,
      })
      .select('id')
      .single();
    if (reviewError) throw reviewError;
    appliedEntityType = 'critic_review';
    appliedEntityId = created.id;
  } else {
    // News, credit extractions, and social ideas are approved as editorial
    // evidence. Their specialist editor performs the eventual catalogue write.
    appliedEntityType = kind;
  }

  metadata.extracted_payload = payload;
  metadata.workflow_status = appliedEntityId || ['news', 'social_post'].includes(kind) ? 'applied' : 'approved';
  metadata.approved_by = actorId;
  metadata.approved_at = new Date().toISOString();
  metadata.applied_entity_type = appliedEntityType;
  metadata.applied_entity_id = appliedEntityId;

  const { error: updateError } = await supabase
    .from('social_news_events')
    .update({
      status: item.draft_id ? 'converted_to_draft' : 'reviewed',
      entity_type: appliedEntityType,
      entity_id: appliedEntityId,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.intakeId);
  if (updateError) throw updateError;

  return { ok: true, id: input.intakeId, kind, workflow_status: metadata.workflow_status, appliedEntityType, appliedEntityId };
}
