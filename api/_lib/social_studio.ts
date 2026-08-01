import type { User } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase.js';
import { isValidAuth } from './auth.js';
import { MockSocialPlatformAdapter } from '../../src/features/social-studio/platforms/mock-adapter.js';
import { SocialPlatformError } from '../../src/features/social-studio/platforms/platform-errors.js';
import { nextRetryAvailableAt } from '../../src/features/social-studio/domain/transitions.js';
import type { SocialContentType } from '../../src/features/social-studio/domain/content-types.js';
import { preferredAssetFormat, type SocialPlatform } from '../../src/features/social-studio/domain/platform-types.js';
import {
  PLATFORM_CAPTION_LIMITS,
  buildVariantContent,
} from '../../src/features/social-studio/content/caption-builder.js';
import { ASSET_FORMAT_DIMENSIONS, renderSnapshotAssets, type SocialAssetFormat } from './social_render.js';
import type { SocialSourceSnapshot } from '../../src/features/social-studio/content/snapshots.js';
import {
  SOURCE_ENTITY_TYPES,
  buildActorSpotlightSnapshot,
  buildUpcomingMovieSnapshot,
  collectSnapshotWarnings,
} from '../../src/features/social-studio/content/snapshots.js';

type SocialActor = {
  id: string;
  email?: string;
  role: 'admin';
};

type HttpError = Error & { status?: number };

function httpError(status: number, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}

export function isSocialStudioEnabled(): boolean {
  return ['true', '1', 'yes'].includes(String(process.env.SOCIAL_STUDIO_ENABLED || '').toLowerCase());
}

export function getSocialPublishMode(): 'mock' | 'disabled' {
  const mode = String(process.env.SOCIAL_PUBLISH_MODE || 'mock').toLowerCase();
  return mode === 'mock' ? 'mock' : 'disabled';
}

function bearerToken(req: VercelRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw?.startsWith('Bearer ')) return null;
  const token = raw.slice('Bearer '.length).trim();
  return token && token !== 'undefined' ? token : null;
}

export async function requireSocialStudioAdmin(req: VercelRequest): Promise<SocialActor> {
  const token = bearerToken(req);
  if (!token) throw httpError(401, 'Missing admin session');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw httpError(401, 'Invalid admin session');

  const user = data.user as User;
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) throw httpError(403, 'Unable to verify admin role');
  if (profile?.role !== 'admin') throw httpError(403, 'Social Studio requires a full admin account');

  return {
    id: user.id,
    email: user.email,
    role: 'admin',
  };
}

export async function requireSocialPublisherAuth(req: VercelRequest): Promise<void> {
  const auth = await isValidAuth(req);
  if (!auth.valid) throw httpError(401, auth.reason || 'Unauthorized');
}

async function countRows(table: string, filters?: (query: any) => any): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filters) query = filters(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function getSocialStudioSummary() {
  const enabled = isSocialStudioEnabled();
  const publishMode = getSocialPublishMode();
  const base = {
    enabled,
    publishMode,
    assetBucket: process.env.SOCIAL_ASSET_BUCKET || 'social-published-assets',
    defaultTimezone: process.env.SOCIAL_DEFAULT_TIMEZONE || 'Africa/Lagos',
  };

  if (!enabled) {
    return {
      ...base,
      counts: {
        contentItems: 0,
        draftItems: 0,
        scheduledItems: 0,
        queuedJobs: 0,
        failedJobs: 0,
        connections: 0,
        templates: 0,
      },
    };
  }

  const [
    contentItems,
    draftItems,
    scheduledItems,
    queuedJobs,
    failedJobs,
    connections,
    templates,
  ] = await Promise.all([
    countRows('social_content_items'),
    countRows('social_content_items', query => query.eq('status', 'draft')),
    countRows('social_content_items', query => query.eq('status', 'scheduled')),
    countRows('social_publish_jobs', query => query.in('status', ['queued', 'retrying'])),
    countRows('social_publish_jobs', query => query.in('status', ['failed', 'dead_letter'])),
    countRows('social_connections'),
    countRows('social_templates', query => query.eq('is_active', true)),
  ]);

  return {
    ...base,
    counts: {
      contentItems,
      draftItems,
      scheduledItems,
      queuedJobs,
      failedJobs,
      connections,
      templates,
    },
  };
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

async function insertSocialEvent(input: {
  contentItemId: string;
  platformVariantId?: string;
  eventType: string;
  eventData?: Record<string, unknown>;
}) {
  await supabase.from('social_content_events').insert({
    content_item_id: input.contentItemId,
    platform_variant_id: input.platformVariantId || null,
    event_type: input.eventType,
    event_data: input.eventData || {},
  });
}

async function recalculateContentStatus(contentItemId: string) {
  const { data: variants, error } = await supabase
    .from('social_platform_variants')
    .select('status')
    .eq('content_item_id', contentItemId);
  if (error) throw error;

  const statuses = asArray(variants).map((row: any) => row.status);
  if (!statuses.length) return;

  const success = statuses.filter(status => status === 'published' || status === 'uploaded_as_draft').length;
  const failed = statuses.filter(status => status === 'failed').length;
  const pending = statuses.filter(status => ['approved', 'scheduled', 'publishing'].includes(status)).length;

  let nextStatus = 'publishing';
  if (pending > 0) nextStatus = success > 0 ? 'partially_published' : 'publishing';
  else if (success > 0 && failed > 0) nextStatus = 'partially_published';
  else if (success > 0) nextStatus = 'published';
  else if (failed > 0) nextStatus = 'failed';

  await supabase
    .from('social_content_items')
    .update({ status: nextStatus })
    .eq('id', contentItemId);
}

async function processJob(job: any, lockedBy: string, now: Date) {
  const attemptCount = Number(job.attempt_count || 0) + 1;
  const nowIso = now.toISOString();

  const { data: claimed, error: claimError } = await supabase
    .from('social_publish_jobs')
    .update({
      status: 'processing',
      locked_at: nowIso,
      locked_by: lockedBy,
      started_at: nowIso,
      attempt_count: attemptCount,
    })
    .eq('id', job.id)
    .in('status', ['queued', 'retrying'])
    .select('id')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) return { jobId: job.id, status: 'skipped', reason: 'already_claimed' };

  const { data: variant, error: variantError } = await supabase
    .from('social_platform_variants')
    .select('*')
    .eq('id', job.platform_variant_id)
    .single();
  if (variantError) throw variantError;

  const { data: contentItem, error: contentError } = await supabase
    .from('social_content_items')
    .select('id,status,source_snapshot')
    .eq('id', variant.content_item_id)
    .single();
  if (contentError) throw contentError;

  let assetUrl: string | null = null;
  if (variant.selected_asset_id) {
    const { data: asset, error: assetError } = await supabase
      .from('social_assets')
      .select('public_url')
      .eq('id', variant.selected_asset_id)
      .maybeSingle();
    if (assetError) throw assetError;
    assetUrl = asset?.public_url || null;
  }

  await supabase.from('social_platform_variants').update({ status: 'publishing' }).eq('id', variant.id);
  await supabase.from('social_content_items').update({ status: 'publishing' }).eq('id', contentItem.id);
  await insertSocialEvent({
    contentItemId: contentItem.id,
    platformVariantId: variant.id,
    eventType: 'publishing_started',
    eventData: { job_id: job.id, platform: variant.platform, mode: 'mock' },
  });

  const adapter = new MockSocialPlatformAdapter();

  try {
    const result = await adapter.publish({
      jobId: job.id,
      variantId: variant.id,
      platform: variant.platform,
      caption: variant.caption || '',
      title: variant.title,
      assetUrl,
      scheduledFor: job.scheduled_for,
      options: variant.platform_options,
      sourceSnapshot: contentItem.source_snapshot,
    });

    const completedAt = new Date().toISOString();
    await supabase
      .from('social_platform_variants')
      .update({
        status: result.variantStatus,
        external_post_id: result.externalPostId,
        external_permalink: result.externalPermalink,
        published_at: completedAt,
        last_error_code: null,
        last_error_message: null,
      })
      .eq('id', variant.id);

    await supabase
      .from('social_publish_jobs')
      .update({
        status: 'succeeded',
        provider_publish_id: result.providerPublishId,
        provider_response: result.providerResponse,
        completed_at: completedAt,
        last_error_code: null,
        last_error_message: null,
        last_error_details: null,
      })
      .eq('id', job.id);

    await insertSocialEvent({
      contentItemId: contentItem.id,
      platformVariantId: variant.id,
      eventType: 'publishing_succeeded',
      eventData: {
        job_id: job.id,
        platform: variant.platform,
        external_post_id: result.externalPostId,
        provider_publish_id: result.providerPublishId,
      },
    });

    await recalculateContentStatus(contentItem.id);
    return { jobId: job.id, status: 'succeeded', platform: variant.platform };
  } catch (err: any) {
    const platformError = err instanceof SocialPlatformError
      ? err
      : new SocialPlatformError({
          platform: variant.platform,
          code: 'mock_unknown_failure',
          message: err?.message || 'Mock publish failed',
        });

    const canRetry = platformError.retryable && attemptCount < Number(job.max_attempts || 5);
    const nextStatus = canRetry ? 'retrying' : platformError.retryable ? 'dead_letter' : 'failed';
    const nextAvailable = canRetry ? nextRetryAvailableAt(now, attemptCount).toISOString() : job.available_at;

    await supabase
      .from('social_platform_variants')
      .update({
        status: 'failed',
        last_error_code: platformError.code,
        last_error_message: platformError.message,
      })
      .eq('id', variant.id);

    await supabase
      .from('social_publish_jobs')
      .update({
        status: nextStatus,
        available_at: nextAvailable,
        last_error_code: platformError.code,
        last_error_message: platformError.message,
        last_error_details: {
          retryable: platformError.retryable,
          reconnect_required: platformError.reconnectRequired,
          details: platformError.details || null,
        },
        completed_at: canRetry ? null : new Date().toISOString(),
      })
      .eq('id', job.id);

    await insertSocialEvent({
      contentItemId: contentItem.id,
      platformVariantId: variant.id,
      eventType: canRetry ? 'publishing_retried' : 'publishing_failed',
      eventData: {
        job_id: job.id,
        platform: variant.platform,
        error_code: platformError.code,
        retryable: platformError.retryable,
      },
    });

    await recalculateContentStatus(contentItem.id);
    return { jobId: job.id, status: nextStatus, platform: variant.platform, error: platformError.message };
  }
}

export async function runSocialPublisher(input: {
  limit?: number;
  lockedBy?: string;
  now?: Date;
} = {}) {
  if (!isSocialStudioEnabled()) {
    return { skipped: true, reason: 'social_studio_disabled', processed: 0, results: [] };
  }

  if (getSocialPublishMode() !== 'mock') {
    return { skipped: true, reason: 'social_publish_mode_not_mock', processed: 0, results: [] };
  }

  const now = input.now || new Date();
  const nowIso = now.toISOString();
  const limit = Math.min(Math.max(input.limit || 10, 1), 25);

  const { data: jobs, error } = await supabase
    .from('social_publish_jobs')
    .select('id,platform_variant_id,status,scheduled_for,available_at,attempt_count,max_attempts')
    .in('status', ['queued', 'retrying'])
    .lte('available_at', nowIso)
    .lte('scheduled_for', nowIso)
    .order('available_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  const results = [];
  for (const job of jobs || []) {
    results.push(await processJob(job, input.lockedBy || 'social-publisher', now));
  }

  return {
    skipped: false,
    processed: results.filter(result => result.status !== 'skipped').length,
    results,
  };
}

/**
 * Statuses that mean an existing item for the same source is still in play.
 * Regenerating over one of these would leave two competing posts for the same
 * person or film, so generation is refused and the caller is pointed at it.
 */
const ACTIVE_CONTENT_STATUSES = [
  'generating',
  'draft',
  'ready_for_review',
  'approved',
  'scheduled',
  'publishing',
  'partially_published',
  'published',
];

async function loadActorSpotlightSource(personId: string, capturedAt: string) {
  const { data: person, error } = await supabase
    .from('people')
    .select('id,name,slug,photo_url,photo_cutout_url,photo_cutout_status,nationality,known_for_department,bio')
    .eq('id', personId)
    .maybeSingle();

  if (error) throw error;
  if (!person) throw httpError(404, 'Person not found');

  // Billing order ranks the headline roles; nulls sort last so leads win.
  const { data: credits, error: creditsError } = await supabase
    .from('credits')
    .select('character_name,billing_order,films!inner(id,title,slug,year,release_date,poster_url,is_published)')
    .eq('person_id', personId)
    .eq('films.is_published', true)
    .order('billing_order', { ascending: true, nullsFirst: false })
    .limit(12);

  if (creditsError) throw creditsError;

  return buildActorSpotlightSnapshot({ person, credits: credits || [], capturedAt });
}

async function loadUpcomingMovieSource(filmId: string, capturedAt: string) {
  const { data: film, error } = await supabase
    .from('films')
    .select(
      'id,title,slug,poster_url,backdrop_url,backdrop,release_date,year,synopsis,tagline,genres,countries,languages,liked_percent,coming_soon,is_published',
    )
    .eq('id', filmId)
    .maybeSingle();

  if (error) throw error;
  if (!film) throw httpError(404, 'Film not found');

  const { data: credits, error: creditsError } = await supabase
    .from('credits')
    .select('character_name,billing_order,people!inner(id,name)')
    .eq('film_id', filmId)
    .eq('role', 'actor')
    .order('billing_order', { ascending: true, nullsFirst: false })
    .limit(8);

  if (creditsError) throw creditsError;

  return buildUpcomingMovieSnapshot({ film, credits: credits || [], capturedAt });
}

function getAssetBucket(): string {
  return process.env.SOCIAL_ASSET_BUCKET || 'social-published-assets';
}

/**
 * Formats a template asks for, falling back to the three the renderer supports.
 * `template_config.formats` is authored data, so unknown values are dropped
 * rather than trusted into the renderer.
 */
function templateFormats(config: unknown): SocialAssetFormat[] {
  const raw = (config as any)?.formats;
  const known = Object.keys(ASSET_FORMAT_DIMENSIONS) as SocialAssetFormat[];
  if (!Array.isArray(raw)) return known;

  const picked = raw.filter((value): value is SocialAssetFormat => known.includes(value));
  return picked.length ? picked : known;
}

type StoredAsset = { id: string; format: SocialAssetFormat; publicUrl: string; width: number; height: number };

/**
 * Renders every format for a content item, uploads each PNG to the asset
 * bucket, and records a `social_assets` row per format.
 *
 * Storage paths are keyed by content item and format, and uploads use upsert so
 * regenerating an item overwrites its assets instead of orphaning them.
 */
async function renderAndStoreAssets(input: {
  contentItemId: string;
  snapshot: SocialSourceSnapshot;
  templateVersion: number | null;
  formats: SocialAssetFormat[];
}): Promise<{ rows: StoredAsset[]; error?: string }> {
  const bucket = getAssetBucket();

  try {
    const rendered = await renderSnapshotAssets({ snapshot: input.snapshot, formats: input.formats });
    const rows: StoredAsset[] = [];

    for (const asset of rendered) {
      const storagePath = `${input.contentItemId}/${asset.format}.png`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, asset.png, { contentType: 'image/png', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      const { data: assetRow, error: assetError } = await supabase
        .from('social_assets')
        .upsert(
          {
            content_item_id: input.contentItemId,
            format: asset.format,
            storage_bucket: bucket,
            storage_path: storagePath,
            public_url: urlData.publicUrl,
            mime_type: 'image/png',
            width: asset.width,
            height: asset.height,
            file_size_bytes: asset.png.length,
            template_version: input.templateVersion,
            render_metadata: { used_artwork: asset.usedArtwork },
          },
          { onConflict: 'content_item_id,format' },
        )
        .select('id')
        .single();

      if (assetError) throw assetError;

      rows.push({
        id: assetRow.id,
        format: asset.format,
        publicUrl: urlData.publicUrl,
        width: asset.width,
        height: asset.height,
      });
    }

    return { rows };
  } catch (err) {
    return { rows: [], error: (err as Error).message || 'unknown render error' };
  }
}

/**
 * Creates one content item plus a draft variant per requested platform.
 *
 * The item is inserted as `generating` and only moves to `draft` once its
 * variants exist, so a failure part-way through leaves an obviously incomplete
 * item rather than an empty one that looks ready to review. Asset rendering
 * will later slot into that same `generating` window.
 */
export async function generateSocialDraft(
  input: {
    contentType: SocialContentType;
    sourceEntityId: string;
    templateSlug: string;
    platforms: SocialPlatform[];
  },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');

  const sourceEntityType = SOURCE_ENTITY_TYPES[input.contentType];
  const capturedAt = new Date().toISOString();

  const { data: template, error: templateError } = await supabase
    .from('social_templates')
    .select('id,slug,version,is_active,template_config')
    .eq('slug', input.templateSlug)
    .maybeSingle();

  if (templateError) throw templateError;
  if (!template) throw httpError(404, `Template ${input.templateSlug} not found`);
  if (!template.is_active) throw httpError(409, `Template ${input.templateSlug} is not active`);

  const { data: existing, error: existingError } = await supabase
    .from('social_content_items')
    .select('id,status')
    .eq('content_type', input.contentType)
    .eq('source_entity_id', input.sourceEntityId)
    .in('status', ACTIVE_CONTENT_STATUSES)
    .limit(1);

  if (existingError) throw existingError;
  if (existing?.length) {
    throw httpError(409, `An active ${input.contentType} already exists for this source (${existing[0].id})`);
  }

  const snapshot =
    input.contentType === 'actor_spotlight'
      ? await loadActorSpotlightSource(input.sourceEntityId, capturedAt)
      : await loadUpcomingMovieSource(input.sourceEntityId, capturedAt);

  const warnings = collectSnapshotWarnings(snapshot);
  const title =
    snapshot.kind === 'actor_spotlight' ? `Actor Spotlight — ${snapshot.name}` : `Upcoming Movie — ${snapshot.title}`;

  const { data: contentItem, error: insertError } = await supabase
    .from('social_content_items')
    .insert({
      content_type: input.contentType,
      title,
      source_entity_type: sourceEntityType,
      source_entity_id: input.sourceEntityId,
      source_snapshot: snapshot,
      template_id: template.id,
      status: 'generating',
      generation_method: 'template',
      generation_notes: warnings.length ? warnings.join(' ') : null,
      created_by: actor.id,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;

  // Assets are rendered inside the `generating` window, before variants exist,
  // because each variant needs to point at one. A render failure degrades to a
  // caption-only draft rather than failing generation — the item is still
  // reviewable and can be re-rendered later.
  const assets = await renderAndStoreAssets({
    contentItemId: contentItem.id,
    snapshot,
    templateVersion: template.version,
    formats: templateFormats(template.template_config),
  });

  if (assets.error) warnings.push(`Asset rendering failed: ${assets.error}`);

  const assetIdByFormat = new Map<string, string>(assets.rows.map(row => [row.format as string, row.id]));
  const availableFormats: string[] = assets.rows.map(row => row.format);

  const variantRows = input.platforms.map(platform => {
    const content = buildVariantContent({ snapshot, platform });
    const format = preferredAssetFormat(platform, availableFormats);
    return {
      content_item_id: contentItem.id,
      platform,
      status: 'draft',
      caption: content.caption,
      title: content.title,
      hashtags: content.hashtags,
      selected_asset_id: format ? assetIdByFormat.get(format) ?? null : null,
      platform_options: {
        caption_limit: PLATFORM_CAPTION_LIMITS[platform].captionLimit,
        asset_format: format,
      },
    };
  });

  const { data: variants, error: variantError } = await supabase
    .from('social_platform_variants')
    .insert(variantRows)
    .select('id,platform,status,caption,title,hashtags,selected_asset_id');

  if (variantError) {
    // Leave the item behind in a terminal state instead of deleting it, so the
    // failure stays visible in the dashboard and the event log explains it.
    await supabase.from('social_content_items').update({ status: 'failed' }).eq('id', contentItem.id);
    await insertSocialEvent({
      contentItemId: contentItem.id,
      eventType: 'draft_generation_failed',
      eventData: { error: variantError.message },
    });
    throw variantError;
  }

  await supabase.from('social_content_items').update({ status: 'draft' }).eq('id', contentItem.id);

  await insertSocialEvent({
    contentItemId: contentItem.id,
    eventType: 'draft_generated',
    eventData: {
      actor_id: actor.id,
      content_type: input.contentType,
      template_slug: template.slug,
      platforms: input.platforms,
      warnings,
    },
  });

  return {
    contentItem: { id: contentItem.id, title, status: 'draft', contentType: input.contentType },
    variants: variants || [],
    assets: assets.rows,
    warnings,
  };
}

export function socialHttpErrorPayload(err: unknown) {
  const typed = err as HttpError;
  return {
    status: typed.status || 500,
    body: { error: typed.message || 'Social Studio request failed' },
  };
}
