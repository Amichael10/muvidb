import type { User } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase.js';
import { isValidAuth } from './auth.js';
import { MockSocialPlatformAdapter } from './social-studio/platforms/mock-adapter.js';
import { ThreadsPlatformAdapter } from './social-studio/platforms/threads-adapter.js';
import { InstagramPlatformAdapter } from './social-studio/platforms/instagram-adapter.js';
import { FacebookPlatformAdapter } from './social-studio/platforms/facebook-adapter.js';
import { TikTokPlatformAdapter } from './social-studio/platforms/tiktok-adapter.js';
import { SocialPlatformError } from './social-studio/platforms/platform-errors.js';
import type { SocialPlatformAdapter } from './social-studio/platforms/social-platform-adapter.js';
import { getThreadsPublishingCredentials, getPlatformPublishingCredentials, isThreadsLivePublishingEnabled } from './threads_oauth.js';
import { assertContentTransition, nextRetryAvailableAt } from './social-studio/domain/transitions.js';
import type { SocialContentStatus } from './social-studio/domain/statuses.js';
import { parseGenerateDraftRequest, createPublishJobIdempotencyKey } from './social-studio/domain/validation.js';
import { deleteFromR2 } from './r2.js';
export { parseGenerateDraftRequest };
import type { SocialContentType } from './social-studio/domain/content-types.js';
import { preferredAssetFormat, type SocialPlatform } from './social-studio/domain/platform-types.js';
import {
  PLATFORM_CAPTION_LIMITS,
  buildVariantContent,
} from './social-studio/content/caption-builder.js';
import { ASSET_FORMAT_DIMENSIONS, renderSnapshotAssets, type SocialAssetFormat } from './social_render.js';
import { htmlTemplateFormats, isHtmlSocialTemplate } from './social_html_templates.js';
import type { SocialSourceSnapshot, SnapshotWatchlistPick } from './social-studio/content/snapshots.js';
import {
  SOURCE_ENTITY_TYPES,
  buildActorSpotlightSnapshot,
  buildBirthdaySpotlightSnapshot,
  buildUpcomingMovieSnapshot,
  buildTheatrePlaySnapshot,
  collectSnapshotWarnings,
} from './social-studio/content/snapshots.js';

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

export function getSocialPublishMode(): 'mock' | 'live' | 'disabled' {
  const mode = String(process.env.SOCIAL_PUBLISH_MODE || 'mock').toLowerCase();
  if (mode === 'mock' || mode === 'live') return mode;
  return 'disabled';
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
  let role = String(user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase();

  try {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role) {
      role = String(profile.role).toLowerCase();
    }
  } catch (dbErr) {
    console.warn('Social Studio: Failed checking users table for role:', dbErr);
  }

  if (role !== 'admin' && role !== 'admin_limited') {
    throw httpError(403, 'Social Studio requires a full admin account');
  }

  return {
    id: user.id,
    email: user.email,
    role: 'admin',
  };
}

export async function requireSocialPublisherAuth(req: VercelRequest): Promise<void> {
  const cronAuth = await isValidAuth(req);
  if (cronAuth.valid) return;
  try {
    await requireSocialStudioAdmin(req);
    return;
  } catch {
    throw httpError(401, cronAuth.reason || 'Unauthorized');
  }
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
    countRows('social_connections', query => query.eq('status', 'connected')),
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

/** Create a real Social Studio draft for a video rendered by MuviDB Studio. */
export async function createEditorVideoDraft(input: {
  title: string;
  publicUrl: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  captions: Partial<Record<SocialPlatform, string>>;
  platforms: SocialPlatform[];
}, actor: SocialActor) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  const title = String(input.title || '').trim().slice(0, 180) || 'MuviDB Studio video';
  const url = String(input.publicUrl || '').trim();
  const bucket = getAssetBucket();
  const isSupabaseAsset = url.startsWith('https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/');
  const isR2Asset = /^https:\/\//i.test(url) && Boolean(input.storagePath);
  if (!isSupabaseAsset && !isR2Asset) throw httpError(400, 'Editor video must be stored in MuviDB media storage');
  const platforms = [...new Set(input.platforms)].filter((p): p is SocialPlatform => ['instagram', 'facebook', 'threads', 'tiktok'].includes(p));
  if (!platforms.length) throw httpError(400, 'Choose at least one social platform');

  const sourceId = crypto.randomUUID();
  const snapshot = { kind: 'studio_video', capturedAt: new Date().toISOString(), title, publicUrl: url, width: input.width, height: input.height };
  const { data: contentItem, error: itemError } = await supabase.from('social_content_items').insert({
    content_type: 'studio_video', title, source_entity_type: 'studio_video', source_entity_id: sourceId,
    source_snapshot: snapshot, status: 'generating', generation_method: 'studio_export', created_by: actor.id,
  }).select('id').single();
  if (itemError) throw itemError;

  const { data: asset, error: assetError } = await supabase.from('social_assets').insert({
    content_item_id: contentItem.id, format: input.width >= input.height ? 'video_square_1_1' : 'video_vertical_9_16', storage_bucket: isR2Asset ? 'external' : bucket,
    storage_path: input.storagePath, public_url: url, mime_type: input.mimeType || 'video/webm',
    width: Math.max(1, Math.round(input.width || 1080)), height: Math.max(1, Math.round(input.height || 1920)),
    file_size_bytes: Math.max(0, Math.round(input.fileSizeBytes || 0)), render_metadata: { source: 'opencut' },
  }).select('id').single();
  if (assetError) throw assetError;

  const variants = platforms.map(platform => ({
    content_item_id: contentItem.id, platform, status: 'draft', title,
    caption: String(input.captions?.[platform] || '').trim() || title,
    hashtags: [], mentions: [], selected_asset_id: asset.id,
    platform_options: { source: 'opencut', media_kind: 'video' },
  }));
  const { error: variantsError } = await supabase.from('social_platform_variants').insert(variants);
  if (variantsError) throw variantsError;
  await supabase.from('social_content_items').update({ status: 'draft' }).eq('id', contentItem.id);
  await insertSocialEvent({ contentItemId: contentItem.id, eventType: 'studio_video_exported', eventData: { actor_id: actor.id, platforms } });
  return { id: contentItem.id, title, status: 'draft', platforms };
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

  // If published successfully across all scheduled targets, delete the media files from Supabase Storage immediately
  if (nextStatus === 'published') {
    await cleanupContentItemAssets(contentItemId).catch(err => {
      console.warn(`[Social Studio] Immediate asset cleanup notice for ${contentItemId}:`, err?.message);
    });
  }
}

export async function cleanupContentItemAssets(contentItemId: string) {
  const [{ data: assets, error: assetError }, { data: variants, error: variantError }] = await Promise.all([
    supabase
      .from('social_assets')
      .select('id,storage_bucket,storage_path')
      .eq('content_item_id', contentItemId),
    supabase
      .from('social_platform_variants')
      .select('platform_options')
      .eq('content_item_id', contentItemId),
  ]);

  if (assetError) throw assetError;
  if (variantError) throw variantError;

  const byBucket = new Map<string, string[]>();
  for (const asset of assets) {
    if (asset.storage_bucket && asset.storage_path && asset.storage_bucket !== 'external') {
      const paths = byBucket.get(asset.storage_bucket) || [];
      paths.push(asset.storage_path);
      byBucket.set(asset.storage_bucket, paths);
    }
  }

  for (const [bucket, paths] of byBucket) {
    if (paths.length) {
      await supabase.storage.from(bucket).remove(paths);
    }
  }

  // Drive is used as temporary staging for large videos. It is not represented
  // by a Supabase storage path, so clean those files explicitly once every
  // selected platform has accepted the post.
  const driveFileIds = new Set<string>();
  const r2Keys = new Set<string>();
  for (const variant of variants || []) {
    const options = variant?.platform_options || {};
    const directId = options.drive_file_id || options.driveFileId;
    if (typeof directId === 'string' && directId) driveFileIds.add(directId);
    const directR2Key = options.r2_key || options.r2Key;
    if (typeof directR2Key === 'string' && directR2Key) r2Keys.add(directR2Key);
    for (const asset of Array.isArray(options.carousel_assets) ? options.carousel_assets : []) {
      const assetId = asset?.drive_file_id || asset?.driveFileId;
      if (typeof assetId === 'string' && assetId) driveFileIds.add(assetId);
      const r2Key = asset?.r2_key || asset?.r2Key;
      if (typeof r2Key === 'string' && r2Key) r2Keys.add(r2Key);
    }
  }
  if (driveFileIds.size) {
    const { deleteVideoFromDrive } = await import('./google_drive.js');
    await Promise.allSettled([...driveFileIds].map(fileId => deleteVideoFromDrive(fileId)));
  }
  if (r2Keys.size) {
    await Promise.allSettled([...r2Keys].map(key => deleteFromR2(key)));
  }
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

  // A queued row can outlive a cancelled or reopened schedule. Never let that
  // stale job publish merely because it was claimed a few milliseconds before
  // the cancellation request updated the queue.
  if (!['scheduled', 'publishing'].includes(variant.status) || !['scheduled', 'publishing', 'partially_published'].includes(contentItem.status)) {
    await supabase
      .from('social_publish_jobs')
      .update({
        status: 'cancelled',
        completed_at: nowIso,
        locked_at: null,
        locked_by: null,
        last_error_code: 'schedule_no_longer_active',
        last_error_message: 'The schedule was cancelled before publishing began.',
      })
      .eq('id', job.id)
      .eq('status', 'processing');
    return { jobId: job.id, status: 'skipped', reason: 'schedule_no_longer_active' };
  }

  let assetUrl: string | null = null;
  let assetUrls: string[] = Array.isArray(variant.platform_options?.carousel_asset_urls)
    ? variant.platform_options.carousel_asset_urls.filter(
        (url: unknown): url is string => typeof url === 'string' && /^https:\/\//i.test(url),
      )
    : [];

  if (variant.selected_asset_id) {
    const { data: asset, error: assetError } = await supabase
      .from('social_assets')
      .select('public_url')
      .eq('id', variant.selected_asset_id)
      .maybeSingle();
    if (assetError) throw assetError;
    assetUrl = asset?.public_url || null;
  }
  if (!assetUrl) {
    assetUrl = variant.platform_options?.asset_url ||
      variant.platform_options?.video_url ||
      variant.platform_options?.media_url ||
      variant.platform_options?.custom_asset_url ||
      null;
  }
  if (assetUrls.length) assetUrl = assetUrls[0];
  else if (assetUrl) assetUrls = [assetUrl];

  await supabase.from('social_platform_variants').update({ status: 'publishing' }).eq('id', variant.id);
  await supabase.from('social_content_items').update({ status: 'publishing' }).eq('id', contentItem.id);
  await insertSocialEvent({
    contentItemId: contentItem.id,
    platformVariantId: variant.id,
    eventType: 'publishing_started',
    eventData: { job_id: job.id, platform: variant.platform, mode: getSocialPublishMode() },
  });

  try {
    let adapter: SocialPlatformAdapter;
    const publishMode = getSocialPublishMode();
    if (publishMode === 'mock') {
      adapter = new MockSocialPlatformAdapter();
    } else if (publishMode === 'live' && variant.platform === 'threads') {
      const { connection, accessToken } = await getThreadsPublishingCredentials();
      adapter = new ThreadsPlatformAdapter({
        accessToken,
        userId: connection.external_account_id,
        apiVersion: process.env.THREADS_GRAPH_API_VERSION,
      });
    } else if (publishMode === 'live' && variant.platform === 'instagram') {
      const { connection, accessToken } = await getPlatformPublishingCredentials('instagram');
      adapter = new InstagramPlatformAdapter({
        accessToken,
        instagramAccountId: connection.external_account_id,
        apiVersion: process.env.META_GRAPH_API_VERSION,
      });
    } else if (publishMode === 'live' && variant.platform === 'facebook') {
      const { connection, accessToken } = await getPlatformPublishingCredentials('facebook');
      adapter = new FacebookPlatformAdapter({
        accessToken,
        pageId: connection.external_account_id,
        apiVersion: process.env.META_GRAPH_API_VERSION,
      });
    } else if (publishMode === 'live' && variant.platform === 'tiktok') {
      const { connection, accessToken } = await getPlatformPublishingCredentials('tiktok');
      adapter = new TikTokPlatformAdapter({
        accessToken,
        openId: connection.external_account_id,
      });
    } else {
      throw new SocialPlatformError({
        platform: variant.platform,
        code: 'social_provider_not_configured',
        message: `${variant.platform} live publishing is not configured yet.`,
      });
    }

    const result = adapter instanceof TikTokPlatformAdapter && job.provider_publish_id
      ? await adapter.checkPublishStatus(
          String(job.provider_publish_id),
          variant.platform_options?.tiktok?.post_mode === 'MEDIA_UPLOAD' ? 'MEDIA_UPLOAD' : 'DIRECT_POST',
        )
      : await adapter.publish({
          jobId: job.id,
          variantId: variant.id,
          platform: variant.platform,
          caption: variant.caption || '',
          title: variant.title,
          assetUrl,
          assetUrls,
          scheduledFor: job.scheduled_for,
          options: variant.platform_options,
          sourceSnapshot: contentItem.source_snapshot,
        });

    if (result.variantStatus === 'publishing') {
      const nextCheck = new Date(Date.now() + 60_000).toISOString();
      await Promise.all([
        supabase
          .from('social_platform_variants')
          .update({
            status: 'publishing',
            external_post_id: result.externalPostId,
            last_error_code: null,
            last_error_message: null,
          })
          .eq('id', variant.id),
        supabase
          .from('social_publish_jobs')
          .update({
            status: 'retrying',
            provider_publish_id: result.providerPublishId,
            provider_response: result.providerResponse,
            available_at: nextCheck,
            locked_at: null,
            locked_by: null,
            completed_at: null,
            last_error_code: null,
            last_error_message: null,
            last_error_details: null,
          })
          .eq('id', job.id),
      ]);
      await insertSocialEvent({
        contentItemId: contentItem.id,
        platformVariantId: variant.id,
        eventType: 'platform_processing',
        eventData: {
          job_id: job.id,
          platform: variant.platform,
          provider_publish_id: result.providerPublishId,
          next_status_check: nextCheck,
        },
      });
      await recalculateContentStatus(contentItem.id);
      return { jobId: job.id, status: 'platform_processing', platform: variant.platform };
    }

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
          code: 'social_unknown_failure',
          message: err?.message || 'Social publishing failed',
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

  if (getSocialPublishMode() === 'disabled') {
    return { skipped: true, reason: 'social_publish_mode_disabled', processed: 0, results: [] };
  }

  const now = input.now || new Date();
  const nowIso = now.toISOString();
  const limit = Math.min(Math.max(input.limit || 10, 1), 25);

  // 1. Recover stale processing locks (e.g. jobs stuck in processing for > 10 mins from crashed runs)
  const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data: staleJobs } = await supabase
    .from('social_publish_jobs')
    .select('id,platform_variant_id')
    .eq('status', 'processing')
    .lt('locked_at', staleThreshold);

  if (staleJobs?.length) {
    const staleIds = staleJobs.map(job => job.id);
    await supabase
      .from('social_publish_jobs')
      .update({ status: 'retrying', locked_at: null, locked_by: null, available_at: nowIso })
      .in('id', staleIds);
    // A timed-out request must not leave its variant stuck in the UI. Returning
    // it to scheduled lets this run (or the next one) retry it safely.
    await supabase
      .from('social_platform_variants')
      .update({ status: 'scheduled', last_error_code: 'publisher_timeout_recovered', last_error_message: 'Previous publish attempt timed out; retrying.' })
      .in('id', staleJobs.map(job => job.platform_variant_id))
      .eq('status', 'publishing');
  }

  // 2. Auto-heal: ensure any scheduled variants with scheduled_for <= now have a queued publish job
  const { data: scheduledVariants } = await supabase
    .from('social_platform_variants')
    .select('id, content_item_id, platform, scheduled_for, status')
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso);

  for (const variant of scheduledVariants || []) {
    const scheduledIso = variant.scheduled_for || nowIso;
    const idempotencyKey = createPublishJobIdempotencyKey({
      contentItemId: variant.content_item_id,
      platform: variant.platform as SocialPlatform,
      scheduledFor: scheduledIso,
    });
    
    const { data: existingJob } = await supabase
      .from('social_publish_jobs')
      .select('id, status')
      .eq('platform_variant_id', variant.id)
      .maybeSingle();

    if (!existingJob) {
      await supabase
        .from('social_publish_jobs')
        .insert({
          platform_variant_id: variant.id,
          status: 'queued',
          scheduled_for: scheduledIso,
          available_at: scheduledIso,
          idempotency_key: idempotencyKey,
        });
    } else if (existingJob.status === 'cancelled') {
      await supabase
        .from('social_publish_jobs')
        .update({
          status: 'queued',
          available_at: scheduledIso,
          scheduled_for: scheduledIso,
          completed_at: null,
          locked_at: null,
          locked_by: null,
        })
        .eq('id', existingJob.id);
    }
  }

  const { data: jobs, error } = await supabase
    .from('social_publish_jobs')
    .select('id,platform_variant_id,status,scheduled_for,available_at,attempt_count,max_attempts,provider_publish_id,provider_response')
    .in('status', ['queued', 'retrying'])
    .lte('available_at', nowIso)
    .lte('scheduled_for', nowIso)
    .order('available_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  // Publish each platform independently. A slow/asynchronous provider such as
  // Threads must not block Instagram, Facebook, or TikTok in the same run.
  const results = await Promise.all(
    (jobs || []).map(job => processJob(job, input.lockedBy || 'social-publisher', now)),
  );

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

async function loadPersonSource(
  personId: string,
  capturedAt: string,
  contentType: SocialContentType,
) {
  const { data: person, error } = await supabase
    .from('people')
    .select('id,name,slug,photo_url,photo_cutout_url,photo_cutout_status,nationality,known_for_department,bio,date_of_birth,instagram_url,twitter_url,tiktok_url,youtube_handle')
    .eq('id', personId)
    .maybeSingle();

  if (error) throw error;
  if (!person) throw httpError(404, 'Person not found');

  // Billing order ranks the headline roles; nulls sort last so leads win.
  const { data: credits, error: creditsError } = await supabase
    .from('credits')
    .select('role,character_name,billing_order,films!inner(id,title,slug,year,release_date,poster_url,is_published)')
    .eq('person_id', personId)
    .eq('films.is_published', true)
    .order('billing_order', { ascending: true, nullsFirst: false })
    .limit(12);

  if (creditsError) throw creditsError;

  // Both person cards share this query; only the snapshot shape differs.
  return contentType === 'birthday_spotlight'
    ? buildBirthdaySpotlightSnapshot({ person, credits: credits || [], capturedAt })
    : buildActorSpotlightSnapshot({ person, credits: credits || [], capturedAt });
}

async function loadUpcomingMovieSource(filmId: string, capturedAt: string) {
  const { data: film, error } = await supabase
    .from('films')
    .select(
      'id,title,slug,poster_url,backdrop_url,backdrop,release_date,year,release_type,source,synopsis,tagline,genres,countries,languages,liked_percent,coming_soon,is_published,is_in_cinemas,streaming_links,youtube_watch_url',
    )
    .eq('id', filmId)
    .maybeSingle();

  if (error) throw error;
  if (!film) throw httpError(404, 'Film not found');

  const [creditsResult, channelVideoResult] = await Promise.all([
    supabase
      .from('credits')
      .select('role,character_name,billing_order,people!inner(id,name,instagram_url)')
      .eq('film_id', filmId)
      .order('billing_order', { ascending: true, nullsFirst: false })
      .limit(40),
    supabase
      .from('channel_videos')
      .select('published_at,channels!inner(name,channel_handle)')
      .eq('film_id', filmId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (creditsResult.error) throw creditsResult.error;
  if (channelVideoResult.error) throw channelVideoResult.error;

  const linkedChannel = (channelVideoResult.data as any)?.channels;
  const filmWithChannel = {
    ...film,
    youtube_channel_name: linkedChannel?.name || null,
    youtube_channel_handle: linkedChannel?.channel_handle || null,
  };

  return buildUpcomingMovieSnapshot({ film: filmWithChannel, credits: creditsResult.data || [], capturedAt, castLimit: 8 });
}

async function loadSelectedCriticReview(filmId: string, criticReviewId: string) {
  const { data: review, error } = await supabase
    .from('critic_reviews')
    .select('id,film_id,quote,rating,critic_name,critic_title,avatar_url')
    .eq('id', criticReviewId)
    .eq('film_id', filmId)
    .maybeSingle();

  if (error) throw error;
  if (!review) throw httpError(404, 'That critic review is not available for the selected film');

  return {
    id: review.id,
    quote: review.quote,
    rating: review.rating === null ? null : Number(review.rating),
    criticName: review.critic_name,
    criticTitle: review.critic_title,
    avatarUrl: review.avatar_url,
  };
}

function watchlistPickFrom(snapshot: Awaited<ReturnType<typeof loadUpcomingMovieSource>>): SnapshotWatchlistPick {
  return {
    filmId: snapshot.filmId,
    title: snapshot.title,
    year: snapshot.year,
    posterUrl: snapshot.posterUrl,
    backdropUrl: snapshot.backdropUrl,
    watchAvailability: snapshot.watchAvailability,
    synopsis: snapshot.synopsis,
    tagline: snapshot.tagline,
    youtubeChannelName: snapshot.youtubeChannelName,
  };
}

async function loadPlaySource(playId: string, capturedAt: string) {
  const { data: play, error } = await supabase
    .from('plays')
    .select('id,title,slug,poster_url,backdrop_url,year,venue,city,country,run_start_date,run_end_date,performance_time,synopsis,playwright,director,status')
    .eq('id', playId)
    .maybeSingle();

  if (error) throw error;
  if (!play) throw httpError(404, 'Theatre play not found');

  return buildTheatrePlaySnapshot({ play, capturedAt });
}

function getAssetBucket(): string {
  return process.env.SOCIAL_ASSET_BUCKET || 'social-published-assets';
}

/**
 * Formats a template asks for, falling back to the three the renderer supports.
 * `template_config.formats` is authored data, so unknown values are dropped
 * rather than trusted into the renderer.
 */
function templateFormats(config: unknown, templateSlug?: string | null): SocialAssetFormat[] {
  if (templateSlug) {
    const htmlFormats = htmlTemplateFormats(templateSlug);
    if (htmlFormats?.length) return htmlFormats;
  }

  const raw = (config as any)?.formats;
  const known = Object.keys(ASSET_FORMAT_DIMENSIONS) as SocialAssetFormat[];
  if (!Array.isArray(raw)) return known;

  const picked = raw.filter((value): value is SocialAssetFormat => known.includes(value));
  return picked.length ? picked : known;
}

type StoredAsset = { id: string; format: SocialAssetFormat; publicUrl: string; width: number; height: number; slide?: number };

export function defaultContentTypeForSeries(seriesSlug: string, candidateType: string): SocialContentType {
  if (seriesSlug === 'critics_say' || seriesSlug === 'one_film_two_takes') return 'critics_say';
  if (seriesSlug === 'where_to_watch') return 'where_to_watch';
  if (seriesSlug === 'weekend_watchlist') return 'weekend_watchlist';
  if (seriesSlug === 'whats_on_stage') return 'whats_on_stage';
  if (seriesSlug === 'film_conversation') return 'film_conversation';
  if (candidateType === 'play') return 'whats_on_stage';
  if (candidateType === 'person') return 'actor_spotlight';
  return 'upcoming_movie';
}

export function defaultTemplateSlugForSeries(seriesSlug: string, candidateType: string): string {
  if (seriesSlug === 'critics_say' || seriesSlug === 'one_film_two_takes') return 'critics-say-v1';
  if (seriesSlug === 'weekend_watchlist') return 'watchlist-this-week-v1';
  if (seriesSlug === 'whats_on_stage') return 'on-stage-theatre-v1';
  if (seriesSlug === 'film_conversation') return 'nollywood-debate-v1';
  if (seriesSlug === 'new_and_upcoming') return 'now-showing-cinemas-v1';
  if (candidateType === 'play') return 'on-stage-theatre-v1';
  if (candidateType === 'person') return 'actor-spotlight-v1';
  return 'upcoming-movie-v1';
}

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
  templateSlug?: string | null;
  templateVersion: number | null;
  formats: SocialAssetFormat[];
}): Promise<{ rows: StoredAsset[]; carouselAssets?: Record<string, StoredAsset[]>; error?: string }> {
  const bucket = getAssetBucket();

  try {
    const rendered = await renderSnapshotAssets({
      snapshot: input.snapshot,
      formats: input.formats,
      templateSlug: input.templateSlug,
    });
    const rows: StoredAsset[] = [];
    const carouselAssets: Record<string, StoredAsset[]> = {};

    for (const asset of rendered) {
      const storagePath = `${input.contentItemId}/${asset.format}${asset.slide && asset.slide > 1 ? `-slide-${asset.slide}` : ''}.png`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, asset.png, { contentType: 'image/png', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      // Carousel slides share a format, so only the first slide is represented
      // by a social_assets row; all slides remain addressable by their storage URL.
      const shouldPersistRow = !asset.slide || asset.slide === 1;
      const { data: assetRow, error: assetError } = shouldPersistRow ? await supabase
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
        .single() : { data: { id: `${input.contentItemId}-${asset.format}-${asset.slide}` }, error: null };

      if (assetError) throw assetError;

      const stored: StoredAsset = {
        id: assetRow.id,
        format: asset.format,
        publicUrl: urlData.publicUrl,
        width: asset.width,
        height: asset.height,
        slide: asset.slide,
      };
      if (asset.slide) (carouselAssets[asset.format] ||= []).push(stored);
      if (!asset.slide || asset.slide === 1) rows.push(stored);
    }

    return { rows, carouselAssets };
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
    sourceEntityIds?: string[];
    criticReviewId?: string | null;
    templateSlug: string;
    platforms: SocialPlatform[];
    destinationId?: string | null;
    isAdHoc?: boolean;
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
  // HTML templates are bundled with the API. Keep generation functional when
  // a deployment is ahead of the database migration that registers the row.
  // The nullable template_id remains null until the migration is applied.
  const effectiveTemplate = template || (isHtmlSocialTemplate(input.templateSlug)
    ? {
        id: null,
        slug: input.templateSlug,
        version: 1,
        is_active: true,
        template_config: {
          renderer: 'html',
          formats: htmlTemplateFormats(input.templateSlug),
        },
      }
    : null);
  if (!effectiveTemplate) throw httpError(404, `Template ${input.templateSlug} not found`);
  if (!effectiveTemplate.is_active) throw httpError(409, `Template ${input.templateSlug} is not active`);

  let snapshot =
    sourceEntityType === 'person'
      ? await loadPersonSource(input.sourceEntityId, capturedAt, input.contentType)
      : sourceEntityType === 'play'
        ? await loadPlaySource(input.sourceEntityId, capturedAt)
        : await loadUpcomingMovieSource(input.sourceEntityId, capturedAt);

  if (input.contentType === 'weekend_watchlist' && snapshot.kind === 'upcoming_movie') {
    const filmIds = input.sourceEntityIds?.length ? input.sourceEntityIds : [input.sourceEntityId];
    const uniqueFilmIds = [...new Set(filmIds)];
    const films = await Promise.all(uniqueFilmIds.map(id => loadUpcomingMovieSource(id, capturedAt)));
    snapshot = { ...snapshot, watchlistPicks: films.map(watchlistPickFrom) };
  }

  if (input.contentType === 'critics_say' && input.criticReviewId && snapshot.kind === 'upcoming_movie') {
    snapshot = {
      ...snapshot,
      criticReview: await loadSelectedCriticReview(input.sourceEntityId, input.criticReviewId),
    };
  }

  const warnings = collectSnapshotWarnings(snapshot);
  const title =
    snapshot.kind === 'actor_spotlight'
      ? `Actor Spotlight — ${snapshot.name}`
      : snapshot.kind === 'birthday_spotlight'
        ? `Birthday Spotlight — ${snapshot.name}`
        : snapshot.kind === 'whats_on_stage'
          ? `What's On Stage — ${snapshot.title}`
          : input.contentType === 'weekend_watchlist'
            ? `Weekend Watchlist — ${snapshot.title}`
            : `Upcoming Movie — ${snapshot.title}`;

  const { data: contentItem, error: insertError } = await supabase
    .from('social_content_items')
    .insert({
      content_type: input.contentType,
      title,
      source_entity_type: sourceEntityType,
      source_entity_id: input.sourceEntityId,
      source_snapshot: snapshot,
      template_id: effectiveTemplate.id,
      destination_id: input.destinationId || null,
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
    templateSlug: effectiveTemplate.slug,
    templateVersion: effectiveTemplate.version,
    formats: templateFormats(effectiveTemplate.template_config, effectiveTemplate.slug),
  });

  if (assets.error) warnings.push(`Asset rendering failed: ${assets.error}`);

  const assetIdByFormat = new Map<string, string>(assets.rows.map(row => [row.format as string, row.id]));
  const availableFormats: string[] = assets.rows.map(row => row.format);

  const variantRows = input.platforms.map(platform => {
    const content = buildVariantContent({ snapshot, platform });
    const format = preferredAssetFormat(platform, availableFormats);
    const slideAssets = format ? (assets.carouselAssets?.[format] || []) : [];
    const useCarousel = input.contentType === 'critics_say' && platform !== 'tiktok' && slideAssets.length >= 2;
    return {
      content_item_id: contentItem.id,
      platform,
      status: input.isAdHoc ? 'approved' : 'draft',
      caption: content.caption,
      title: content.title,
      hashtags: content.hashtags,
      selected_asset_id: format ? assetIdByFormat.get(format) ?? null : null,
      platform_options: {
        caption_limit: PLATFORM_CAPTION_LIMITS[platform].captionLimit,
        asset_format: format,
        ...(useCarousel
          ? {
              post_format: 'carousel',
              carousel_assets: slideAssets.map((asset, index) => ({
                id: asset.id,
                publicUrl: asset.publicUrl,
                mediaType: 'image',
                position: index,
                format: asset.format,
              })),
              carousel_asset_urls: slideAssets.map(asset => asset.publicUrl),
            }
          : { post_format: 'single' }),
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

  await supabase.from('social_content_items').update({ status: input.isAdHoc ? 'approved' : 'draft' }).eq('id', contentItem.id);

  await insertSocialEvent({
    contentItemId: contentItem.id,
    eventType: 'draft_generated',
    eventData: {
      actor_id: actor.id,
      content_type: input.contentType,
      template_slug: effectiveTemplate.slug,
      platforms: input.platforms,
      source_entity_ids: input.sourceEntityIds || [input.sourceEntityId],
      critic_review_id: input.criticReviewId || null,
      warnings,
    },
  });

  return {
    contentItem: { id: contentItem.id, title, status: input.isAdHoc ? 'approved' : 'draft', contentType: input.contentType },
    variants: variants || [],
    assets: assets.rows,
    warnings,
  };
}

/** Review actions a full admin can take, and the status each moves an item to. */
const REVIEW_ACTIONS = {
  submit: 'ready_for_review',
  approve: 'approved',
  reject: 'rejected',
  reopen: 'draft',
} as const;

export type SocialReviewAction = keyof typeof REVIEW_ACTIONS;

export function isSocialReviewAction(value: unknown): value is SocialReviewAction {
  return typeof value === 'string' && value in REVIEW_ACTIONS;
}

/** Saves an administrator's final caption without regenerating the draft artwork. */
export async function updateSocialVariantCaption(
  input: { variantId: string; caption: string },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');

  const caption = typeof input.caption === 'string' ? input.caption.trim() : '';
  if (!caption) throw httpError(400, 'Caption cannot be empty');

  const { data: variant, error } = await supabase
    .from('social_platform_variants')
    .select('id,content_item_id,platform,status')
    .eq('id', input.variantId)
    .maybeSingle();

  if (error) throw error;
  if (!variant) throw httpError(404, 'Platform caption was not found');
  if (['publishing', 'published'].includes(variant.status)) {
    throw httpError(409, 'A caption cannot be changed after publishing has started');
  }

  const platform = variant.platform as SocialPlatform;
  const limit = PLATFORM_CAPTION_LIMITS[platform]?.captionLimit || 2200;
  if (caption.length > limit) {
    throw httpError(400, `Caption exceeds the ${limit}-character limit for ${platform}`);
  }

  const { error: updateError } = await supabase
    .from('social_platform_variants')
    .update({ caption })
    .eq('id', variant.id);
  if (updateError) throw updateError;

  await insertSocialEvent({
    contentItemId: variant.content_item_id,
    eventType: 'caption_edited',
    eventData: { actor_id: actor.id, platform, variant_id: variant.id },
  });

  return { success: true, id: variant.id, platform, caption };
}

export async function updateSocialVariantOptions(
  input: { variantId: string; options: Record<string, unknown> },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  const { data: variant, error } = await supabase
    .from('social_platform_variants')
    .select('id,content_item_id,platform,status,platform_options')
    .eq('id', input.variantId)
    .maybeSingle();
  if (error) throw error;
  if (!variant) throw httpError(404, 'Platform post was not found');
  if (['publishing', 'published', 'uploaded_as_draft'].includes(variant.status)) {
    throw httpError(409, 'Publishing has already started, so these settings can no longer be changed');
  }

  const nextOptions = { ...(variant.platform_options || {}) } as Record<string, unknown>;
  if (variant.platform === 'tiktok') {
    const raw = (input.options?.tiktok || input.options || {}) as Record<string, unknown>;
    const privacyLevels = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
    const postModes = ['DIRECT_POST', 'MEDIA_UPLOAD'];
    nextOptions.tiktok = {
      privacy_level: privacyLevels.includes(String(raw.privacy_level)) ? raw.privacy_level : 'SELF_ONLY',
      post_mode: postModes.includes(String(raw.post_mode)) ? raw.post_mode : 'DIRECT_POST',
      disable_comment: Boolean(raw.disable_comment),
      disable_duet: Boolean(raw.disable_duet),
      disable_stitch: Boolean(raw.disable_stitch),
      auto_add_music: Boolean(raw.auto_add_music),
      brand_content_toggle: Boolean(raw.brand_content_toggle),
      brand_organic_toggle: Boolean(raw.brand_organic_toggle),
      is_aigc: Boolean(raw.is_aigc),
      photo_cover_index: Math.max(0, Math.floor(Number(raw.photo_cover_index) || 0)),
      video_cover_timestamp_ms: Math.max(0, Math.floor(Number(raw.video_cover_timestamp_ms) || 0)),
    };
  } else {
    throw httpError(400, 'Advanced publishing settings are not available for this platform yet');
  }

  const { error: updateError } = await supabase
    .from('social_platform_variants')
    .update({ platform_options: nextOptions })
    .eq('id', variant.id);
  if (updateError) throw updateError;
  await insertSocialEvent({
    contentItemId: variant.content_item_id,
    platformVariantId: variant.id,
    eventType: 'platform_options_edited',
    eventData: { actor_id: actor.id, platform: variant.platform },
  });
  return { success: true, id: variant.id, platform: variant.platform, platformOptions: nextOptions };
}

const NON_EDITABLE_CONTENT_STATUSES = ['publishing', 'partially_published', 'published'] as const;
const NON_EDITABLE_VARIANT_STATUSES = ['publishing', 'published', 'uploaded_as_draft'] as const;

async function assertContentItemCanBeChanged(contentItemId: string) {
  const { data: item, error } = await supabase
    .from('social_content_items')
    .select('id,title,status,social_platform_variants(id,status,platform)')
    .eq('id', contentItemId)
    .maybeSingle();

  if (error) throw error;
  if (!item) throw httpError(404, 'Content item not found');
  if (NON_EDITABLE_CONTENT_STATUSES.includes(item.status as any)) {
    throw httpError(409, 'This post can no longer be changed because publishing has started');
  }

  const variants = asArray(item.social_platform_variants as any[]);
  if (variants.some(variant => NON_EDITABLE_VARIANT_STATUSES.includes(variant.status as any))) {
    throw httpError(409, 'This post can no longer be changed because one of its platform posts is already publishing or published');
  }

  const variantIds = variants.map(variant => variant.id);
  if (variantIds.length) {
    const { count, error: jobError } = await supabase
      .from('social_publish_jobs')
      .select('id', { count: 'exact', head: true })
      .in('platform_variant_id', variantIds)
      .eq('status', 'processing');
    if (jobError) throw jobError;
    if (count) throw httpError(409, 'This post is being published right now and can no longer be changed');
  }

  return { item, variants, variantIds };
}

/** Returns any pre-publication queue item to an editable draft without regenerating it. */
export async function prepareSocialContentItemForEdit(
  input: { contentItemId: string },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  const { item, variantIds } = await assertContentItemCanBeChanged(input.contentItemId);
  const now = new Date().toISOString();

  if (variantIds.length) {
    const { error: jobError } = await supabase
      .from('social_publish_jobs')
      .update({ status: 'cancelled', completed_at: now })
      .in('platform_variant_id', variantIds)
      .in('status', ['queued', 'retrying']);
    if (jobError) throw jobError;

    const { error: variantError } = await supabase
      .from('social_platform_variants')
      .update({ status: 'draft', scheduled_for: null })
      .in('id', variantIds)
      .in('status', ['draft', 'approved', 'scheduled', 'failed', 'skipped']);
    if (variantError) throw variantError;
  }

  const { error: updateError } = await supabase
    .from('social_content_items')
    .update({
      status: 'draft',
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
    })
    .eq('id', input.contentItemId);
  if (updateError) throw updateError;

  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: 'queue_item_opened_for_edit',
    eventData: { actor_id: actor.id, from: item.status, cancelled_schedule: item.status === 'scheduled' },
  });

  return { id: item.id, title: item.title, from: item.status, status: 'draft' };
}

/** Saves the queue editor's title and platform captions in one guarded request. */
export async function updateSocialContentItemDraft(
  input: { contentItemId: string; title: string; variants: Array<{ id: string; caption: string }> },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  const title = String(input.title || '').trim();
  if (!title) throw httpError(400, 'Post title cannot be empty');
  if (title.length > 180) throw httpError(400, 'Post title is too long');

  const { variants: existingVariants } = await assertContentItemCanBeChanged(input.contentItemId);
  const existingById = new Map(existingVariants.map(variant => [variant.id, variant]));
  const updates = Array.isArray(input.variants) ? input.variants : [];
  if (!updates.length) throw httpError(400, 'At least one platform caption is required');

  for (const update of updates) {
    const existing = existingById.get(update.id);
    if (!existing) throw httpError(400, 'A platform caption does not belong to this post');
    const caption = String(update.caption || '').trim();
    if (!caption) throw httpError(400, 'Platform captions cannot be empty');
    const platform = (existing as any).platform as SocialPlatform;
    const limit = PLATFORM_CAPTION_LIMITS[platform]?.captionLimit || 2200;
    if (caption.length > limit) throw httpError(400, `${platform} caption exceeds ${limit} characters`);
  }

  const { error: itemError } = await supabase
    .from('social_content_items')
    .update({ title })
    .eq('id', input.contentItemId);
  if (itemError) throw itemError;

  for (const update of updates) {
    const { error: variantError } = await supabase
      .from('social_platform_variants')
      .update({ caption: String(update.caption).trim() })
      .eq('id', update.id)
      .eq('content_item_id', input.contentItemId);
    if (variantError) throw variantError;
  }

  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: 'queue_item_edited',
    eventData: { actor_id: actor.id, variant_ids: updates.map(update => update.id) },
  });

  return { success: true, id: input.contentItemId, title, status: 'draft' };
}

/** Permanently removes an unpublished queue item and its database-owned render files. */
export async function deleteSocialContentItem(
  input: { contentItemId: string },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  const { item, variantIds } = await assertContentItemCanBeChanged(input.contentItemId);

  if (variantIds.length) {
    const { error: jobError } = await supabase
      .from('social_publish_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .in('platform_variant_id', variantIds)
      .in('status', ['queued', 'retrying']);
    if (jobError) throw jobError;
  }

  await cleanupContentItemAssets(input.contentItemId).catch(error => {
    console.warn(`Social Studio: queue item ${item.id} cleanup was incomplete`, error);
  });

  const { error: deleteError } = await supabase
    .from('social_content_items')
    .delete()
    .eq('id', input.contentItemId);
  if (deleteError) throw deleteError;

  return { success: true, id: item.id, title: item.title, deletedBy: actor.id };
}

/**
 * Moves a content item through the review states.
 *
 * The legal moves live in `transitions.ts` and are enforced here rather than in
 * the UI, so a stale browser tab cannot approve an item somebody else already
 * rejected. Variants follow the item: approving an item approves its draft
 * variants, which is what makes them eligible for scheduling.
 */
export async function reviewContentItem(
  input: { contentItemId: string; action: SocialReviewAction; reason?: string | null },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');

  const target = REVIEW_ACTIONS[input.action];
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';

  if (input.action === 'reject' && !reason) {
    throw httpError(400, 'A rejection reason is required');
  }

  const { data: item, error } = await supabase
    .from('social_content_items')
    .select('id,status,title')
    .eq('id', input.contentItemId)
    .maybeSingle();

  if (error) throw error;
  if (!item) throw httpError(404, 'Content item not found');

  // The transition table permits self-transitions, which for a review action
  // would silently re-stamp approved_by/approved_at and lose the original
  // reviewer. A no-op review is a mistake, so it is refused outright.
  if (item.status === target) {
    throw httpError(409, `Content item is already ${target}`);
  }

  try {
    assertContentTransition(item.status as SocialContentStatus, target as SocialContentStatus);
  } catch (transitionError) {
    throw httpError(409, (transitionError as Error).message);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: target };

  if (input.action === 'approve') {
    patch.approved_by = actor.id;
    patch.approved_at = now;
    patch.rejection_reason = null;
  } else if (input.action === 'reject') {
    patch.rejected_by = actor.id;
    patch.rejected_at = now;
    patch.rejection_reason = reason;
  } else if (input.action === 'reopen') {
    // Reopening clears the previous verdict so the next reviewer starts clean.
    patch.approved_by = null;
    patch.approved_at = null;
    patch.rejected_by = null;
    patch.rejected_at = null;
    patch.rejection_reason = null;
  }

  const { error: updateError } = await supabase
    .from('social_content_items')
    .update(patch)
    .eq('id', input.contentItemId);
  if (updateError) throw updateError;

  // Approval cascades to variants so the scheduler has something to pick up;
  // reopening pulls them back to draft. Only untouched variants move, so a
  // variant already published or skipped is left alone.
  if (input.action === 'approve') {
    await supabase
      .from('social_platform_variants')
      .update({ status: 'approved' })
      .eq('content_item_id', input.contentItemId)
      .eq('status', 'draft');
  } else if (input.action === 'reopen') {
    await supabase
      .from('social_platform_variants')
      .update({ status: 'draft' })
      .eq('content_item_id', input.contentItemId)
      .eq('status', 'approved');
  }

  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: `review_${input.action}`,
    eventData: { actor_id: actor.id, from: item.status, to: target, reason: reason || null },
  });

  return { id: item.id, title: item.title, from: item.status, status: target };
}

/**
 * Schedules an approved item for publication.
 *
 * Writes `scheduled_for` on every approved variant, moves them to `scheduled`,
 * and enqueues one `social_publish_jobs` row each. The publisher already drains
 * that queue, so this is the last link in the chain.
 *
 * Jobs carry a deterministic idempotency key of
 * `social:<item>:<platform>:<time>`, and the column is unique — rescheduling to
 * the same instant cannot double-post.
 */
export async function scheduleContentItem(
  input: { contentItemId: string; scheduledFor: string },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');

  const when = new Date(input.scheduledFor);
  if (Number.isNaN(when.getTime())) throw httpError(400, 'scheduledFor must be a valid date');

  // A minute of slack absorbs clock skew between the browser and the server.
  if (when.getTime() < Date.now() - 60_000) {
    throw httpError(400, 'scheduledFor is in the past');
  }

  const { data: item, error } = await supabase
    .from('social_content_items')
    .select('id,status,title')
    .eq('id', input.contentItemId)
    .maybeSingle();

  if (error) throw error;
  if (!item) throw httpError(404, 'Content item not found');

  // Scheduling is idempotent for already-scheduled posts. This is important
  // for the Publish Now action, which may be called by an older cached client
  // that still sends a schedule request before invoking the publisher.
  if (item.status === 'scheduled') {
    return { id: item.id, title: item.title, status: item.status, alreadyScheduled: true };
  }

  // Keep one-click scheduling while still honouring the review state machine and
  // recording both audit events. A draft cannot legally jump straight to
  // approved; it must first become ready_for_review.
  if (item.status === 'draft') {
    await reviewContentItem({ contentItemId: input.contentItemId, action: 'submit' }, actor);
    item.status = 'ready_for_review';
  }

  if (item.status === 'ready_for_review') {
    await reviewContentItem({ contentItemId: input.contentItemId, action: 'approve' }, actor);
    item.status = 'approved';
  }

  if (item.status !== 'approved') {
    throw httpError(409, `Only approved items can be scheduled (this one is ${item.status})`);
  }

  try {
    assertContentTransition(item.status as SocialContentStatus, 'scheduled');
  } catch (transitionError) {
    throw httpError(409, (transitionError as Error).message);
  }

  const { data: variants, error: variantError } = await supabase
    .from('social_platform_variants')
    .select('id,platform,status,selected_asset_id,platform_options')
    .eq('content_item_id', input.contentItemId)
    .eq('status', 'approved');

  if (variantError) throw variantError;
  if (!variants?.length) throw httpError(409, 'No approved variants to schedule');

  for (const variant of variants) {
    const urls = Array.isArray(variant.platform_options?.carousel_asset_urls)
      ? variant.platform_options.carousel_asset_urls.filter((url: unknown) => typeof url === 'string')
      : [];
    if (urls.length > 1) {
      const limit = variant.platform === 'threads' ? 20 : variant.platform === 'tiktok' ? 35 : 10;
      if (urls.length > limit) {
        throw httpError(400, `${variant.platform} allows at most ${limit} carousel items; this draft has ${urls.length}`);
      }
      const containsVideo = urls.some((url: string) => /\.mp4(?:$|\?)/i.test(url));
      if (containsVideo && ['facebook', 'tiktok'].includes(variant.platform)) {
        throw httpError(400, `${variant.platform} does not support video inside a carousel. Use images only or remove that platform.`);
      }
    }
  }

  // Every platform here posts media. Scheduling a variant with no asset would
  // only fail later inside the publisher, so it is caught up front and names
  // the offending platforms.
  const missingAsset = variants
    .filter(variant =>
      !variant.selected_asset_id &&
      (!Array.isArray(variant.platform_options?.carousel_asset_urls) || !variant.platform_options.carousel_asset_urls.length),
    )
    .map(v => v.platform);
  if (missingAsset.length) {
    throw httpError(409, `These variants have no rendered asset: ${missingAsset.join(', ')}`);
  }

  const scheduledForIso = when.toISOString();
  const jobRows = variants.map(variant => ({
    platform_variant_id: variant.id,
    status: 'queued',
    scheduled_for: scheduledForIso,
    available_at: scheduledForIso,
    completed_at: null,
    locked_at: null,
    locked_by: null,
    last_error_code: null,
    last_error_message: null,
    last_error_details: null,
    idempotency_key: createPublishJobIdempotencyKey({
      contentItemId: input.contentItemId,
      platform: variant.platform as SocialPlatform,
      scheduledFor: scheduledForIso,
    }),
  }));

  const { data: scheduledVariants, error: scheduleVariantError } = await supabase
    .from('social_platform_variants')
    .update({ status: 'scheduled', scheduled_for: scheduledForIso })
    .eq('content_item_id', input.contentItemId)
    .eq('status', 'approved')
    .select('id');
  if (scheduleVariantError) throw scheduleVariantError;
  if ((scheduledVariants || []).length !== variants.length) {
    await supabase
      .from('social_platform_variants')
      .update({ status: 'approved', scheduled_for: null })
      .in('id', (scheduledVariants || []).map(row => row.id));
    throw httpError(409, 'The draft changed while it was being scheduled. Review it and try again.');
  }

  const { data: scheduledItem, error: scheduleItemError } = await supabase
    .from('social_content_items')
    .update({ status: 'scheduled' })
    .eq('id', input.contentItemId)
    .eq('status', 'approved')
    .select('id')
    .maybeSingle();

  if (scheduleItemError || !scheduledItem) {
    await supabase
      .from('social_platform_variants')
      .update({ status: 'approved', scheduled_for: null })
      .in('id', variants.map(variant => variant.id));
    if (scheduleItemError) throw scheduleItemError;
    throw httpError(409, 'The draft changed while it was being scheduled. Review it and try again.');
  }

  const { data: jobs, error: jobError } = await supabase
    .from('social_publish_jobs')
    .upsert(jobRows, { onConflict: 'idempotency_key' })
    .select('id,platform_variant_id');

  if (jobError) {
    await Promise.all([
      supabase
        .from('social_platform_variants')
        .update({ status: 'approved', scheduled_for: null })
        .in('id', variants.map(variant => variant.id)),
      supabase
        .from('social_content_items')
        .update({ status: 'approved' })
        .eq('id', input.contentItemId)
        .eq('status', 'scheduled'),
    ]);
    throw jobError;
  }

  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: 'scheduled',
    eventData: {
      actor_id: actor.id,
      scheduled_for: scheduledForIso,
      platforms: variants.map(v => v.platform),
      jobs: jobs?.length || 0,
    },
  });

  return {
    id: item.id,
    title: item.title,
    status: 'scheduled',
    scheduledFor: scheduledForIso,
    jobs: jobs?.length || 0,
    platforms: variants.map(v => v.platform),
  };
}

/**
 * Cancels a schedule, returning the item to `approved`.
 *
 * Rescheduling is cancel-then-schedule rather than an in-place edit: the queued
 * jobs carry the old timestamp in their idempotency key, so they have to be
 * cancelled anyway. Doing it in two explicit steps keeps one code path instead
 * of two that can disagree.
 *
 * Only jobs that have not started are cancelled. A job already `processing` is
 * mid-flight inside the adapter, so its variant is left alone and reported back
 * rather than silently reverted.
 */
export async function cancelContentSchedule(input: { contentItemId: string }, actor: SocialActor) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');

  const { data: item, error } = await supabase
    .from('social_content_items')
    .select('id,status,title')
    .eq('id', input.contentItemId)
    .maybeSingle();

  if (error) throw error;
  if (!item) throw httpError(404, 'Content item not found');
  if (item.status !== 'scheduled') {
    throw httpError(409, `Only scheduled items can be cancelled (this one is ${item.status})`);
  }

  const { data: variants, error: variantError } = await supabase
    .from('social_platform_variants')
    .select('id,platform,status')
    .eq('content_item_id', input.contentItemId)
    .eq('status', 'scheduled');
  if (variantError) throw variantError;

  const variantIds = (variants || []).map(variant => variant.id);
  let cancelledJobs = 0;
  let inFlight = 0;

  if (variantIds.length) {
    const { data: cancelled, error: jobError } = await supabase
      .from('social_publish_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .in('platform_variant_id', variantIds)
      .in('status', ['queued', 'retrying'])
      .select('id');
    if (jobError) throw jobError;
    cancelledJobs = cancelled?.length || 0;

    const { count } = await supabase
      .from('social_publish_jobs')
      .select('id', { count: 'exact', head: true })
      .in('platform_variant_id', variantIds)
      .eq('status', 'processing');
    inFlight = count || 0;

    if (inFlight > 0) {
      const cancelledIds = (cancelled || []).map(row => row.id);
      if (cancelledIds.length) {
        await supabase
          .from('social_publish_jobs')
          .update({ status: 'queued', completed_at: null })
          .in('id', cancelledIds)
          .eq('status', 'cancelled');
      }
      throw httpError(409, 'This post has already started publishing. Wait for the platform result before editing it.');
    }

    await supabase
      .from('social_platform_variants')
      .update({ status: 'approved', scheduled_for: null })
      .in('id', variantIds);
  }

  await supabase
    .from('social_content_items')
    .update({ status: 'approved' })
    .eq('id', input.contentItemId);

  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: 'schedule_cancelled',
    eventData: { actor_id: actor.id, cancelled_jobs: cancelledJobs, in_flight: inFlight },
  });

  return {
    id: item.id,
    title: item.title,
    status: 'approved',
    cancelledJobs,
    inFlight,
  };
}

/**
 * Deletes rendered assets for items that have finished their lifecycle.
 *
 * Once a post is live the platform holds the canonical copy, so keeping our
 * render forever just accumulates storage — roughly 3 MB per post across the
 * three formats. Only terminal items are pruned, and the `social_assets` rows
 * go with the objects so nothing points at a missing file.
 *
 * The content item, its variants and its event log are all left intact; this
 * reclaims bytes, not history.
 */
export async function pruneSocialAssets(
  input: { olderThanDays?: number; limit?: number } = {},
): Promise<{ skipped?: true; reason?: string; items: number; objects: number; bytes: number }> {
  if (!isSocialStudioEnabled()) {
    return { skipped: true, reason: 'social_studio_disabled', items: 0, objects: 0, bytes: 0 };
  }

  const days = Math.max(1, input.olderThanDays ?? (Number(process.env.SOCIAL_ASSET_RETENTION_DAYS) || 30));
  const limit = Math.min(Math.max(input.limit || 50, 1), 200);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  // Age is measured from when the post actually went live, not `updated_at`:
  // that column is maintained by a trigger, so it tracks the last edit and can
  // never age while anything touches the row. Items that never published
  // (rejected, archived drafts) fall back to `created_at`.
  const { data: items, error } = await supabase
    .from('social_content_items')
    .select('id,created_at,social_platform_variants(published_at)')
    .in('status', ['published', 'archived', 'rejected'])
    .limit(limit);

  if (error) throw error;
  if (!items?.length) return { items: 0, objects: 0, bytes: 0 };

  const ids = items
    .filter(item => {
      const published = (item.social_platform_variants || [])
        .map((variant: any) => variant.published_at)
        .filter(Boolean)
        .sort()
        .pop();
      return (published || item.created_at) < cutoff;
    })
    .map(item => item.id);

  if (!ids.length) return { items: 0, objects: 0, bytes: 0 };

  const { data: assets, error: assetError } = await supabase
    .from('social_assets')
    .select('id,content_item_id,storage_bucket,storage_path,file_size_bytes')
    .in('content_item_id', ids);

  if (assetError) throw assetError;
  if (!assets?.length) return { items: 0, objects: 0, bytes: 0 };

  // Group by bucket so each bucket is a single remove() call.
  const byBucket = new Map<string, string[]>();
  for (const asset of assets) {
    const paths = byBucket.get(asset.storage_bucket) || [];
    paths.push(asset.storage_path);
    byBucket.set(asset.storage_bucket, paths);
  }

  for (const [bucket, paths] of byBucket) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  }

  // Variants point at assets; clear the reference before the rows disappear.
  await supabase
    .from('social_platform_variants')
    .update({ selected_asset_id: null })
    .in('content_item_id', ids);

  const { error: deleteError } = await supabase
    .from('social_assets')
    .delete()
    .in('id', assets.map(asset => asset.id));
  if (deleteError) throw deleteError;

  return {
    items: new Set(assets.map(asset => asset.content_item_id)).size,
    objects: assets.length,
    bytes: assets.reduce((sum, asset) => sum + (asset.file_size_bytes || 0), 0),
  };
}

export function socialHttpErrorPayload(err: unknown) {
  const typed = err as HttpError;
  return {
    status: typed.status || 500,
    body: { error: typed.message || 'Social Studio request failed' },
  };
}

export async function attachCustomAsset(
  input: {
    contentItemId: string;
    publicUrl: string;
    format?: SocialAssetFormat;
    width?: number;
    height?: number;
    variantId?: string;
    driveFileId?: string;
    r2Key?: string;
    aspectRatio?: string;
  },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  await assertContentItemCanBeChanged(input.contentItemId);
  if (!/^https:\/\//i.test(String(input.publicUrl || ''))) {
    throw httpError(400, 'The custom artwork must have a public HTTPS URL');
  }
  const isVideo = Boolean(input.driveFileId) || Boolean(input.r2Key) || /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(input.publicUrl) || Boolean(input.format?.includes('video'));
  const format: SocialAssetFormat = input.format || (isVideo ? 'video_vertical_9_16' as SocialAssetFormat : 'square_1_1');
  const width = input.width || 1080;
  const height = input.height || 1080;
  let storageBucket = 'external';
  let storagePath = input.publicUrl;
  try {
    const parsed = new URL(input.publicUrl);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex >= 0) {
      const storageParts = parsed.pathname.slice(markerIndex + marker.length).split('/');
      storageBucket = decodeURIComponent(storageParts.shift() || 'external');
      storagePath = storageParts.map(part => decodeURIComponent(part)).join('/');
    }
  } catch {
    throw httpError(400, 'The custom artwork URL is invalid');
  }
  const mimeType = isVideo
    ? (/\.webm(?:$|\?)/i.test(input.publicUrl)
        ? 'video/webm'
        : /\.mov(?:$|\?)/i.test(input.publicUrl)
        ? 'video/quicktime'
        : 'video/mp4')
    : /\.jpe?g(?:$|\?)/i.test(input.publicUrl)
    ? 'image/jpeg'
    : /\.webp(?:$|\?)/i.test(input.publicUrl)
      ? 'image/webp'
      : 'image/png';

  const { data: assetRow, error: assetError } = await supabase
    .from('social_assets')
    .upsert(
      {
        content_item_id: input.contentItemId,
        format,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        public_url: input.publicUrl,
        mime_type: mimeType,
        width,
        height,
        file_size_bytes: 0,
        render_metadata: {
          source: input.driveFileId || input.r2Key ? 'desktop_clipper' : 'custom_upload',
          uploaded_by: actor.id,
          drive_file_id: input.driveFileId || null,
          r2_key: input.r2Key || null,
          aspect_ratio: input.aspectRatio || null,
        },
      },
      { onConflict: 'content_item_id,format' },
    )
    .select('id,public_url,format,width,height')
    .single();

  if (assetError) throw assetError;

  if (input.variantId) {
    const { data: selectedVariant, error: selectedVariantError } = await supabase
      .from('social_platform_variants')
      .select('platform_options')
      .eq('id', input.variantId)
      .eq('content_item_id', input.contentItemId)
      .maybeSingle();
    if (selectedVariantError) throw selectedVariantError;
    if (!selectedVariant) throw httpError(404, 'Platform variant not found for this draft');
    await supabase
      .from('social_platform_variants')
      .update({
        selected_asset_id: assetRow.id,
        platform_options: {
          ...(selectedVariant.platform_options || {}),
          post_format: 'single',
          asset_url: input.publicUrl,
          video_url: isVideo ? input.publicUrl : null,
          drive_file_id: input.driveFileId || null,
          r2_key: input.r2Key || null,
          aspect_ratio: input.aspectRatio || null,
          asset_format: format,
        },
      })
      .eq('id', input.variantId);
  } else {
    await supabase
      .from('social_platform_variants')
      .update({ selected_asset_id: assetRow.id })
      .eq('content_item_id', input.contentItemId);
  }

  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: 'custom_asset_uploaded',
    eventData: { actor_id: actor.id, asset_id: assetRow.id, public_url: input.publicUrl, variant_id: input.variantId || null },
  });

  return assetRow;
}

export async function updateSocialVariantAsset(
  input: {
    variantId: string;
    selectedAssetId?: string | null;
    format?: SocialAssetFormat;
  },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  if (!input.variantId) throw httpError(400, 'variantId is required');

  const { data: variant, error: findError } = await supabase
    .from('social_platform_variants')
    .select('id,content_item_id,platform_options')
    .eq('id', input.variantId)
    .single();
  if (findError || !variant) throw httpError(404, 'Platform variant not found');

  await assertContentItemCanBeChanged(variant.content_item_id);

  const platformOptions = {
    ...(variant.platform_options || {}),
    ...(input.format ? { asset_format: input.format } : {}),
  };

  const { error: updateError } = await supabase
    .from('social_platform_variants')
    .update({
      selected_asset_id: input.selectedAssetId || null,
      platform_options: platformOptions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.variantId);
  if (updateError) throw updateError;

  return { ok: true, variantId: input.variantId, selectedAssetId: input.selectedAssetId, format: input.format };
}

export async function attachCarouselAssets(
  input: {
    contentItemId: string;
    variantId?: string;
    publicUrls?: string[];
    assets?: Array<{ url: string; mediaType?: 'image' | 'video'; altText?: string }>;
    format?: SocialAssetFormat;
    width?: number;
    height?: number;
  },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  await assertContentItemCanBeChanged(input.contentItemId);

  const rawAssets: Array<{ url: string; mediaType?: 'image' | 'video'; altText?: string }> = Array.isArray(input.assets) && input.assets.length
    ? input.assets
    : (input.publicUrls || []).map(url => ({ url }));
  const carouselAssets = rawAssets.map(asset => {
    const url = String(asset?.url || '').trim();
    const mediaType = asset?.mediaType === 'video' || /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(url) ? 'video' : 'image';
    return {
      url,
      media_type: mediaType,
      alt_text: String(asset?.altText || '').trim().slice(0, 1000),
    };
  });
  const publicUrls = carouselAssets.map(asset => asset.url);
  if (publicUrls.length < 2 || new Set(publicUrls).size !== publicUrls.length) {
    throw httpError(400, 'A carousel needs at least 2 unique media items');
  }
  if (publicUrls.some(url => !/^https:\/\//i.test(url))) {
    throw httpError(400, 'Every carousel item must have a public HTTPS URL');
  }

  const format: SocialAssetFormat = input.format || 'square_1_1';
  const width = input.width || 1080;
  const height = input.height || 1080;

  let query = supabase
    .from('social_platform_variants')
    .select('id,platform,platform_options')
    .eq('content_item_id', input.contentItemId);

  if (input.variantId) {
    query = query.eq('id', input.variantId);
  }

  const { data: variants, error: variantError } = await query;
  if (variantError) throw variantError;
  if (!variants?.length) throw httpError(404, 'No platform variants were found for this draft');

  const platforms = variants.map(variant => String(variant.platform));
  const maxItems = platforms.includes('instagram') || platforms.includes('facebook')
    ? 10
    : platforms.includes('threads')
      ? 20
      : 35;
  if (carouselAssets.length > maxItems) {
    throw httpError(400, `${platforms.join(', ')} supports at most ${maxItems} items for this carousel`);
  }

  const previousUrls = Array.isArray(variants[0]?.platform_options?.carousel_asset_urls)
    ? variants[0].platform_options.carousel_asset_urls.filter((url: unknown) => typeof url === 'string')
    : [];

  for (const variant of variants) {
    const { error: updateError } = await supabase
      .from('social_platform_variants')
      .update({
        platform_options: {
          ...(variant.platform_options || {}),
          post_format: 'carousel',
          carousel_asset_urls: publicUrls,
          carousel_assets: carouselAssets,
        },
      })
      .eq('id', variant.id);
    if (updateError) throw updateError;
  }

  const assets = carouselAssets.map((asset, position) => ({
    id: asset.url,
    public_url: asset.url,
    publicUrl: asset.url,
    mediaType: asset.media_type,
    altText: asset.alt_text,
    format,
    width,
    height,
    position,
  }));

  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: 'carousel_assets_attached',
    eventData: {
      actor_id: actor.id,
      public_urls: publicUrls,
      item_count: assets.length,
      platforms: variants.map(variant => variant.platform),
    },
  });

  // Remove replaced uploads only when they are clearly Social Studio-owned
  // objects. Generated/source artwork is never deleted by this path.
  const removedUrls = previousUrls.filter((url: string) => !publicUrls.includes(url));
  const removals = new Map<string, string[]>();
  for (const url of removedUrls) {
    try {
      const parsed = new URL(url);
      const marker = '/storage/v1/object/public/';
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex < 0) continue;
      const parts = parsed.pathname.slice(markerIndex + marker.length).split('/').map(decodeURIComponent);
      const bucket = parts.shift() || '';
      const path = parts.join('/');
      if (!['social-published-assets', 'film-images'].includes(bucket) || !path.startsWith('social/')) continue;
      const paths = removals.get(bucket) || [];
      paths.push(path);
      removals.set(bucket, paths);
    } catch { /* malformed old URL: leave it alone */ }
  }
  for (const [bucket, paths] of removals) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) console.warn('Social Studio: could not remove replaced carousel media', removeError);
  }

  return { assets, itemCount: assets.length, maxItems, platforms };
}

export async function reorderCarouselAssets(
  input: {
    contentItemId: string;
    variantId?: string;
    publicUrls?: string[];
    assets?: Array<{ url: string; mediaType?: 'image' | 'video'; altText?: string }>;
  },
  actor: SocialActor,
) {
  const result = await attachCarouselAssets(input, actor);
  await insertSocialEvent({
    contentItemId: input.contentItemId,
    eventType: 'carousel_assets_reordered',
    eventData: { actor_id: actor.id, public_urls: result.assets.map(asset => asset.public_url) },
  });
  return { success: true, ...result };
}

export async function getEditorialCalendar(days = 30, shuffleOffset = 0) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  const today = new Date().toISOString().split('T')[0];
  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() + Math.max(1, days) - 1);
  const endDateString = endDate.toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('social_calendar')
    .select('id,scheduled_date,scheduled_time,status,priority,source,notes,series_id,subject_entity_type,subject_entity_id,selection_locked,created_at,social_content_series(id,name,slug,category,figma_template_key,description)')
    .gte('scheduled_date', today)
    .lte('scheduled_date', endDateString)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(200);

  if (error) throw error;
  const rawSlots = data || [];

  // Candidate selection is a deterministic editorial decision, not a rotation
  // through whatever rows were most recently updated in the database.
  try {
    const { fetchSeriesCandidates } = await import('./editorial/candidate_service.js');
    const {
      editorialIdentity,
      rankEditorialCandidates,
      shouldSuppressCalendarSlot,
    } = await import('./editorial/editorial_selection_engine.js');
    const { getSeriesIntent } = await import('./editorial/candidate_strategy.js');

    // Remove overlapping seed artefacts. Prefer a real time and a non-planned
    // slot when the same date/series exists more than once.
    const slotPriority = (slot: any) => (slot.status === 'planned' ? 0 : 100) + (slot.scheduled_time ? 10 : 0);
    const dedupedByDateAndSeries = new Map<string, any>();
    for (const slot of rawSlots) {
      const series = Array.isArray(slot.social_content_series)
        ? slot.social_content_series[0]
        : slot.social_content_series;
      const slug = series?.slug || 'unknown';
      const key = `${slot.scheduled_date}:${slug}`;
      const existing = dedupedByDateAndSeries.get(key);
      if (!existing || slotPriority(slot) > slotPriority(existing)) dedupedByDateAndSeries.set(key, slot);
    }
    const slots = [...dedupedByDateAndSeries.values()].sort((a: any, b: any) =>
      String(a.scheduled_date).localeCompare(String(b.scheduled_date)) ||
      String(a.scheduled_time || '23:59:59').localeCompare(String(b.scheduled_time || '23:59:59')),
    );

    const seriesSlugs = [...new Set(slots.map((s: any) => s.social_content_series?.slug).filter(Boolean))];
    const candidatePools: Record<string, any[]> = {};

    await Promise.all(
      seriesSlugs.map(async (slug) => {
        try {
          candidatePools[slug] = await fetchSeriesCandidates(slug, 60);
        } catch {
          candidatePools[slug] = [];
        }
      })
    );

    const cooldownCutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const eventCutoff = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const [historyResult, contentResult, eventResult] = await Promise.all([
      supabase
        .from('social_entity_history')
        .select('entity_id,published_at')
        .gte('published_at', cooldownCutoff)
        .limit(500),
      supabase
        .from('social_content_items')
        .select('source_entity_id,status,created_at')
        .gte('created_at', cooldownCutoff)
        .limit(500),
      supabase
        .from('social_news_events')
        .select('entity_id,title,event_type,event_date,urgency,status,detected_at')
        .gte('detected_at', eventCutoff)
        .in('status', ['new', 'reviewed'])
        .order('detected_at', { ascending: false })
        .limit(200),
    ]);

    const recentlyFeaturedIds = new Set<string>();
    for (const row of historyResult.data || []) if (row.entity_id) recentlyFeaturedIds.add(row.entity_id);
    for (const row of contentResult.data || []) {
      if (row.source_entity_id && !['failed', 'rejected', 'archived'].includes(row.status)) {
        recentlyFeaturedIds.add(row.source_entity_id);
      }
    }

    const eventsByEntityId = new Map<string, any[]>();
    for (const event of eventResult.data || []) {
      if (!event.entity_id) continue;
      const events = eventsByEntityId.get(event.entity_id) || [];
      events.push({
        entityId: event.entity_id,
        title: event.title,
        eventType: event.event_type,
        eventDate: event.event_date,
        urgency: event.urgency,
      });
      eventsByEntityId.set(event.entity_id, events);
    }

    const reservedIds = new Set<string>();
    const reservedIdentities = new Set<string>();
    const seriesByDate = new Map<string, Set<string>>();
    const peopleByDate = new Map<string, number>();
    const peopleByWeek = new Map<string, number>();
    const curatedSlots: any[] = [];

    const weekKey = (dateString: string) => {
      const date = new Date(`${dateString}T12:00:00Z`);
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() - day + 1);
      return date.toISOString().slice(0, 10);
    };

    for (const slot of slots as any[]) {
      const slug = slot.social_content_series?.slug || 'filmography';
      const pool = candidatePools[slug] || [];
      const dateKey = String(slot.scheduled_date);
      const week = weekKey(dateKey);
      const usedSeries = seriesByDate.get(dateKey) || new Set<string>();
      const suppressionReason = shouldSuppressCalendarSlot({
        status: slot.status,
        seriesSlug: slug,
        dailyPeopleCount: peopleByDate.get(dateKey) || 0,
        weeklyPeopleCount: peopleByWeek.get(week) || 0,
        seriesAlreadyUsedToday: usedSeries.has(slug),
      });
      if (suppressionReason && slot.status === 'planned') continue;

      const referenceDate = new Date(`${dateKey}T12:00:00Z`);
      const ranked = rankEditorialCandidates(pool, slug, {
        referenceDate,
        recentlyFeaturedIds,
        reservedIds,
        reservedIdentities,
        eventsByEntityId,
      });
      const shortlistSize = Math.min(5, ranked.length);
      const selectedIndex = shortlistSize ? Math.abs(Number(shuffleOffset) || 0) % shortlistSize : 0;
      const selected = ranked[selectedIndex] || null;

      // Quality over quota: an unqualified planned slot is omitted instead of
      // publishing a weak, repetitive or unsupported post just to fill a date.
      if (!selected && slot.status === 'planned') continue;

      const candidate = selected?.candidate || null;
      const assessment = selected?.assessment || null;
      if (candidate) {
        reservedIds.add(candidate.id);
        reservedIdentities.add(editorialIdentity(candidate));
      }
      usedSeries.add(slug);
      seriesByDate.set(dateKey, usedSeries);

      const intent = getSeriesIntent(slug);
      const isDailyProfileSeries = intent === 'people' || intent === 'crew';
      if (isDailyProfileSeries && candidate) {
        peopleByDate.set(dateKey, (peopleByDate.get(dateKey) || 0) + 1);
      }
      if (intent === 'people' && candidate) {
        peopleByWeek.set(week, (peopleByWeek.get(week) || 0) + 1);
      }
      const candidateContentType = candidate ? defaultContentTypeForSeries(slug, candidate.type) : null;
      const candidateTemplateSlug = candidate ? defaultTemplateSlugForSeries(slug, candidate.type) : null;

      curatedSlots.push({
        ...slot,
        selection: assessment
          ? {
              score: assessment.score,
              whyNow: assessment.whyNow,
              reasons: assessment.reasons,
              warnings: assessment.warnings,
              signals: assessment.signals,
            }
          : null,
        candidate: candidate
          ? {
              id: candidate.id,
              type: candidate.type,
              name: candidate.name,
              subtext: candidate.subtext,
              imageUrl: candidate.imageUrl,
              category: candidate.category,
              completenessScore: candidate.completenessScore,
              contentType: candidateContentType,
              templateSlug: candidateTemplateSlug,
              data: candidate.data || {},
              editorialScore: assessment?.score || 0,
              whyNow: assessment?.whyNow || '',
            }
          : null,
      });
    }

    return curatedSlots;
  } catch (err) {
    console.warn('Failed to attach candidates to calendar slots:', (err as Error)?.message);
    return rawSlots;
  }
}

export async function updateEditorialCalendarSlot(input: {
  slotId: string;
  scheduledDate: string;
  scheduledTime?: string;
}) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  if (!input.slotId || !input.scheduledDate) {
    throw httpError(400, 'slotId and scheduledDate are required');
  }

  const updates: Record<string, any> = {
    scheduled_date: input.scheduledDate,
  };
  if (input.scheduledTime) {
    updates.scheduled_time = input.scheduledTime.includes(':') ? (input.scheduledTime.length === 5 ? `${input.scheduledTime}:00` : input.scheduledTime) : input.scheduledTime;
  }

  const { data, error } = await supabase
    .from('social_calendar')
    .update(updates)
    .eq('id', input.slotId)
    .select()
    .single();

  if (error) throw error;
  return { success: true, slot: data };
}

export async function approveEditorialSlot(
  input: {
    slotId: string;
    candidateId: string;
    candidateType: 'person' | 'movie' | 'play';
    contentType?: SocialContentType;
    templateSlug?: string;
    scheduledDate: string;
    scheduledTime?: string;
    platforms?: SocialPlatform[];
    customCaptions?: Record<string, string>;
    customImageUrl?: string | null;
  },
  actor: SocialActor,
) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');

  const contentType = input.contentType || defaultContentTypeForSeries('', input.candidateType);
  const templateSlug = input.templateSlug || defaultTemplateSlugForSeries('', input.candidateType);
  const platforms = input.platforms && input.platforms.length ? input.platforms : (['instagram', 'threads', 'facebook', 'tiktok'] as SocialPlatform[]);

  // Validate live theatre productions: reject archived / passed stage plays
  if (input.candidateType === 'play' || (contentType as string) === 'theatre_spotlight' || (contentType as string) === 'whats_on_stage') {
    const { data: play } = await supabase
      .from('plays')
      .select('id, title, status, run_start_date, run_end_date, year')
      .eq('id', input.candidateId)
      .single();

    if (play) {
      const { derivePlayStatus } = await import('./theatre_service.js');
      const liveStatus = derivePlayStatus(play, new Date());
      if (liveStatus === 'archived' || play.status === 'archived') {
        throw httpError(400, `The stage production "${play.title}" has already ended / is archived. Social posts cannot be scheduled for past theatre events.`);
      }
    }
  }

  // 1. Generate the draft
  const draft = await generateSocialDraft(
    {
      contentType,
      sourceEntityId: input.candidateId,
      templateSlug,
      platforms,
    },
    actor,
  );

  if (input.customImageUrl) {
    await attachCustomAsset(
      { contentItemId: draft.contentItem.id, publicUrl: input.customImageUrl },
      actor,
    );
  }

  // 2. Compute scheduled time ISO string
  const time = input.scheduledTime || '11:00:00';
  const scheduledFor = new Date(`${input.scheduledDate}T${time}`).toISOString();

  // 3. Update platform variants with custom captions if provided
  if (input.customCaptions) {
    for (const [platform, caption] of Object.entries(input.customCaptions)) {
      await supabase
        .from('social_platform_variants')
        .update({ caption })
        .eq('content_item_id', draft.contentItem.id)
        .eq('platform', platform);
    }
  }

  // 4. Schedule the draft
  const scheduledItem = await scheduleContentItem(
    { contentItemId: draft.contentItem.id, scheduledFor },
    actor,
  );

  // 5. Link to calendar slot
  if (input.slotId) {
    await supabase
      .from('social_calendar')
      .update({
        status: 'scheduled',
        notes: `Scheduled ${draft.contentItem.title} for ${input.scheduledDate}`,
      })
      .eq('id', input.slotId);
  }

  return {
    success: true,
    contentItem: scheduledItem,
    draft,
  };
}

export async function seedEditorialCalendarSlots(options: any = 30) {
  if (!isSocialStudioEnabled()) throw httpError(409, 'Social Studio is disabled');
  const { seedRollingCalendar } = await import('./editorial/calendar_service.js');
  const count = await seedRollingCalendar(options);
  return { seeded: count };
}
