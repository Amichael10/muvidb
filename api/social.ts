import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

const SOCIAL_ALLOWED_ORIGINS = new Set([
  'https://muvidb.com',
  'https://www.muvidb.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  const configuredOrigins = [process.env.SITE_URL, process.env.VITE_SITE_URL]
    .filter(Boolean)
    .map(value => String(value).replace(/\/$/, ''));
  if (origin && (SOCIAL_ALLOWED_ORIGINS.has(origin) || configuredOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseBody(req: VercelRequest): Record<string, any> {
  if (typeof req.body !== 'string') return req.body || {};
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function isSafeRemoteVideoUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

const EDITORIAL_TASKS = new Set([
  'candidates',
  'calendar',
  'series',
  'generate_brief',
  'mark_published',
  'overview',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  const pathname = (req.url || '').split('?')[0];
  let task = (req.query?.task || req.body?.task || '').toString();
  if (!task && pathname.includes('/tiktok/callback')) task = 'tiktok_callback';
  if (!task && pathname.includes('/meta/callback')) task = 'meta_callback';
  if (!task && pathname.includes('/threads/callback')) task = 'threads_callback';
  const scope = (req.query?.scope || req.body?.scope || '').toString();

  try {
    if (task === 'create_upload_session' || task === 'drive_upload_session' || pathname.includes('/drive/create-upload-session')) {
      const { requireSocialStudioAdmin } = await import('./_lib/social_studio.js');
      await requireSocialStudioAdmin(req);
      const { createDriveUploadSession } = await import('./_lib/google_drive.js');
      const body = parseBody(req);
      const { fileName, mimeType, fileSize } = body;
      if (!fileName || !fileSize) {
        return res.status(400).json({ error: 'Missing fileName or fileSize' });
      }
      const numericSize = Number(fileSize);
      if (!Number.isFinite(numericSize) || numericSize <= 0 || numericSize > 2 * 1024 * 1024 * 1024) {
        return res.status(400).json({ error: 'Video size must be between 1 byte and 2 GB' });
      }
      if (!/^video\/(mp4|webm|quicktime)$/i.test(String(mimeType || 'video/webm'))) {
        return res.status(400).json({ error: 'Only MP4, WebM, or MOV videos can be uploaded' });
      }
      const uploadUrl = await createDriveUploadSession(
        String(fileName).replace(/[^a-z0-9._-]+/gi, '_').slice(0, 140),
        mimeType || 'video/webm',
        numericSize
      );
      return res.status(200).json({ uploadUrl });
    }

    if (task === 'make_drive_file_public') {
      const { requireSocialStudioAdmin } = await import('./_lib/social_studio.js');
      await requireSocialStudioAdmin(req);
      const { makeFilePublic } = await import('./_lib/google_drive.js');
      const body = parseBody(req);
      const { fileId } = body;
      if (!fileId || !/^[a-zA-Z0-9_-]{10,200}$/.test(String(fileId))) {
        return res.status(400).json({ error: 'A valid Drive file ID is required' });
      }
      const publicUrl = await makeFilePublic(fileId);
      return res.status(200).json({ success: true, publicUrl });
    }

    if (task === 'clip_video' || task === 'render_clip') {
      const { requireSocialStudioAdmin } = await import('./_lib/social_studio.js');
      await requireSocialStudioAdmin(req);
      const body = parseBody(req);
      const { url, startTime, endTime, aspectRatio, fitMode, title } = body;
      if (!isSafeRemoteVideoUrl(url)) return res.status(400).json({ error: 'Enter a valid HTTPS video URL' });
      const start = Math.max(0, Number(startTime) || 0);
      const end = Number(endTime) || start + 60;
      if (end <= start || end - start > 600) {
        return res.status(400).json({ error: 'Choose a clip between 1 second and 10 minutes' });
      }
      if (!['1:1', '4:5', '9:16', '16:9'].includes(String(aspectRatio || '9:16'))) {
        return res.status(400).json({ error: 'Choose a supported video aspect ratio' });
      }

      // The free desktop companion is called directly by the admin browser so
      // yt-dlp uses the administrator's residential connection. This server
      // route is deliberately cloud-only; pretending Vercel is "local" simply
      // recreates YouTube's datacenter bot wall.
      const extractorBaseUrl = (process.env.MEDIA_EXTRACTOR_URL || process.env.RENDER_EXTRACTOR_URL || 'https://muvidb.onrender.com').replace(/\/$/, '');
      const extractorSecret = (process.env.EXTRACTOR_SECRET || '').trim();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (extractorSecret) headers.Authorization = `Bearer ${extractorSecret}`;

      const extRes = await fetch(`${extractorBaseUrl}/clip`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url,
          start_time: start,
          end_time: end,
          aspect_ratio: aspectRatio || '9:16',
          fit_mode: fitMode || 'cover',
          title: title || 'clip',
        }),
        signal: AbortSignal.timeout(180_000),
      });

      const data = await extRes.json().catch(() => ({}));
      if (!extRes.ok || !data.success) {
        console.error('[Social clipper] Extractor failed:', data.error || extRes.status);
        return res.status(502).json({
          error: 'The video could not be prepared automatically. Start the free MuviDB desktop clipper and try again.',
          code: 'clipper_cloud_unavailable',
        });
      }
      return res.status(200).json(data);
    }

    if (scope === 'editorial' || EDITORIAL_TASKS.has(task)) {
      const { requireSocialStudioAdmin } = await import('./_lib/social_studio.js');
      await requireSocialStudioAdmin(req);
      const { handleEditorialTask } = await import('./_lib/editorial_handler.js');
      return handleEditorialTask(req, res);
    }

    if (req.method === 'GET' && task === 'threads_callback') {
      const { completeThreadsOAuth, threadsAdminRedirect } = await import('./_lib/threads_oauth.js');
      try {
        await completeThreadsOAuth(req);
        const dest = threadsAdminRedirect(req, 'connected');
        res.setHeader('Location', dest);
        return res.status(302).end();
      } catch (error) {
        const errMsg = (error as Error)?.message || 'We could not connect Threads. Please check the app settings and try again.';
        console.error('Threads OAuth callback error:', errMsg);
        try {
          const dest = threadsAdminRedirect(req, 'error', errMsg);
          res.setHeader('Location', dest);
          return res.status(302).end();
        } catch (redirectErr) {
          return res.status(200).send(`
            <!DOCTYPE html>
            <html>
              <head><title>Threads Connection</title><meta http-equiv="refresh" content="3;url=/admin/social"></head>
              <body style="background:#111;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
                <h2>Threads connection issue</h2>
                <p style="color:#f87171;">${errMsg}</p>
                <p><a href="/admin/social" style="color:#f97316;">Return to Social Studio</a></p>
              </body>
            </html>
          `);
        }
      }
    }

    if (req.method === 'GET' && task === 'meta_callback') {
      const { completeMetaOAuth } = await import('./_lib/threads_oauth.js');
      try {
        const dest = await completeMetaOAuth(req);
        res.setHeader('Location', dest);
        return res.status(302).end();
      } catch (error) {
        const errMsg = (error as Error)?.message || 'We could not connect Meta. Please check your Meta app permissions.';
        console.error('Meta OAuth callback error:', errMsg);
        res.setHeader('Location', `/admin/social?meta=error&message=${encodeURIComponent(errMsg.slice(0, 150))}`);
        return res.status(302).end();
      }
    }

    if (req.method === 'GET' && task === 'tiktok_callback') {
      const { completeTikTokOAuth } = await import('./_lib/threads_oauth.js');
      try {
        const dest = await completeTikTokOAuth(req);
        res.setHeader('Location', dest);
        return res.status(302).end();
      } catch (error) {
        const errMsg = (error as Error)?.message || 'We could not connect TikTok. Please check your TikTok app permissions.';
        console.error('TikTok OAuth callback error:', errMsg);
        res.setHeader('Location', `/admin/social?tiktok=error&message=${encodeURIComponent(errMsg.slice(0, 150))}`);
        return res.status(302).end();
      }
    }

    // Deauthorization & Data Deletion Callbacks required by Meta
    if (task === 'threads_deauth') {
      return res.status(200).json({ success: true, message: 'Threads deauthorized successfully' });
    }

    if (task === 'asset') {
      const targetUrl = String(req.query.url || '').trim();
      if (!targetUrl || !targetUrl.startsWith('https://pkenrmorywmuvnzfoylp.supabase.co/')) {
        return res.status(400).json({ error: 'Invalid or unauthorized asset URL' });
      }
      try {
        const upstream = await fetch(targetUrl);
        if (!upstream.ok) return res.status(upstream.status).end();
        const contentType = upstream.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        const buffer = Buffer.from(await upstream.arrayBuffer());
        return res.status(200).send(buffer);
      } catch (err: any) {
        return res.status(502).json({ error: 'Failed to proxy asset', details: err?.message });
      }
    }

    const {
      generateSocialDraft,
      getSocialStudioSummary,
      isSocialReviewAction,
      cancelContentSchedule,
      reviewContentItem,
      scheduleContentItem,
      requireSocialPublisherAuth,
      requireSocialStudioAdmin,
      runSocialPublisher,
      parseGenerateDraftRequest,
      attachCustomAsset,
      attachCarouselAssets,
      reorderCarouselAssets,
      updateSocialVariantCaption,
      updateSocialVariantOptions,
      prepareSocialContentItemForEdit,
      updateSocialContentItemDraft,
      deleteSocialContentItem,
      createEditorVideoDraft,
      getEditorialCalendar,
      seedEditorialCalendarSlots,
    } = await import('./_lib/social_studio.js');

    const {
      createThreadsAuthorizationUrl,
      createMetaAuthorizationUrl,
      createTikTokAuthorizationUrl,
      disconnectThreads,
      getThreadsConfiguration,
      getThreadsConnection,
      sanitizeThreadsConnection,
      getAllPlatformConnections,
      disconnectPlatform,
      savePlatformConnection,
    } = await import('./_lib/threads_oauth.js');

    if (task === 'render_preview') {
      await requireSocialStudioAdmin(req);
      const { candidate, format = 'portrait_4_5', templateSlug } = (req.method === 'POST' ? req.body : req.query) || {};
      if (!candidate) {
        return res.status(400).json({ error: 'Candidate data is required for preview rendering' });
      }
      const parsedCandidate = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      const { renderSnapshotAsset } = await import('./_lib/social_render.js');
      const isPerson = parsedCandidate.type === 'person';
      const isPlay = parsedCandidate.type === 'play';
      const snapshot = isPerson
        ? {
            kind: 'actor_spotlight' as const,
            capturedAt: new Date().toISOString(),
            personId: parsedCandidate.id || 'preview-person',
            name: parsedCandidate.name,
            handle: parsedCandidate.data?.handle || null,
            slug: parsedCandidate.data?.slug || null,
            photoUrl: parsedCandidate.imageUrl || parsedCandidate.data?.photo_url || null,
            photoCutoutUrl: parsedCandidate.data?.photoCutoutUrl || parsedCandidate.imageUrl || null,
            nationality: parsedCandidate.country || parsedCandidate.data?.nationality || null,
            knownForDepartment: parsedCandidate.data?.knownForDepartment || parsedCandidate.data?.department || 'Actor & Filmmaker',
            bio: parsedCandidate.subtext || parsedCandidate.data?.bio || null,
            knownFor: (parsedCandidate.data?.knownFor || []).map((k: any) => ({
              filmId: k.id || 'f',
              title: k.title || k.name || '',
              slug: k.slug || null,
              year: k.year || null,
              posterUrl: k.poster_url || null,
              character: k.character || null,
            })),
            creditCount: parsedCandidate.data?.creditCount || 10,
          }
        : isPlay
          ? {
              kind: 'whats_on_stage' as const,
              capturedAt: new Date().toISOString(),
              playId: parsedCandidate.id || 'preview-play',
              title: parsedCandidate.name || parsedCandidate.title,
              slug: parsedCandidate.data?.slug || null,
              posterUrl: parsedCandidate.imageUrl || parsedCandidate.data?.poster_url || null,
              backdropUrl: parsedCandidate.data?.backdrop_url || null,
              synopsis: parsedCandidate.subtext || parsedCandidate.data?.synopsis || null,
              venue: parsedCandidate.data?.venue || null,
              city: parsedCandidate.data?.city || null,
              country: parsedCandidate.country || parsedCandidate.data?.country || null,
              runStartDate: parsedCandidate.data?.run_start_date || null,
              runEndDate: parsedCandidate.data?.run_end_date || null,
              performanceTime: parsedCandidate.data?.performance_time || null,
              playwright: parsedCandidate.data?.playwright || null,
              director: parsedCandidate.data?.director || null,
              status: parsedCandidate.data?.status || parsedCandidate.data?.derivedStatus || null,
              year: parsedCandidate.data?.year || null,
            }
          : {
            kind: 'upcoming_movie' as const,
            capturedAt: new Date().toISOString(),
            filmId: parsedCandidate.id || 'preview-film',
            title: parsedCandidate.name,
            slug: parsedCandidate.data?.slug || null,
            posterUrl: parsedCandidate.imageUrl || parsedCandidate.data?.poster_url || null,
            backdropUrl: parsedCandidate.data?.backdrop_url || null,
            releaseDate: parsedCandidate.data?.release_date || null,
            watchAvailability: parsedCandidate.data?.platformDisplayName || parsedCandidate.data?.watchAvailability || (parsedCandidate.data?.is_in_cinemas ? 'In Cinemas Now' : 'Streaming Online'),
            year: parsedCandidate.data?.year || null,
            synopsis: parsedCandidate.data?.synopsis || parsedCandidate.subtext || null,
            tagline: parsedCandidate.data?.tagline || null,
            genres: parsedCandidate.data?.genres || ['African Cinema'],
            countries: [parsedCandidate.country || 'Nigeria'],
            languages: parsedCandidate.data?.languages || ['English'],
            likedPercent: parsedCandidate.data?.liked_percent || 85,
            comingSoon: parsedCandidate.data?.coming_soon || false,
            isPublished: true,
            topCast: (parsedCandidate.data?.topCast || []).map((c: any) => ({
              personId: c.id || 'p',
              name: c.name || '',
              handle: c.handle || null,
              character: c.character || null,
            })),
          };

      const rendered = await renderSnapshotAsset({
        snapshot: snapshot as any,
        format: format as any,
        templateSlug: typeof templateSlug === 'string' ? templateSlug : null,
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(rendered.png);
    }

    if (req.method === 'GET') {
      await requireSocialStudioAdmin(req);
      if (task === 'intake_list') {
        const { listSocialIntake } = await import('./_lib/social_intake.js');
        return res.status(200).json(await listSocialIntake({
          limit: Number(req.query?.limit || 50),
          workflowStatus: String(req.query?.workflowStatus || '') || null,
          kind: String(req.query?.kind || '') || null,
        }));
      }
      if (task === 'threads_status' || task === 'connections_status') {
        const connection = await getThreadsConnection();
        const allConnections = await getAllPlatformConnections();
        return res.status(200).json({
          configuration: getThreadsConfiguration(req),
          connection: sanitizeThreadsConnection(connection),
          connections: allConnections,
        });
      }
      if (task === 'calendar_plan') {
        const days = Number(req.query?.days || 30);
        const offset = Number(req.query?.offset || req.query?.shuffleOffset || 0);
        return res.status(200).json(await getEditorialCalendar(days, offset));
      }
      if (task === 'slot_candidates') {
        const seriesSlug = String(req.query?.seriesSlug || 'filmography');
        const scheduledDate = String(req.query?.scheduledDate || '');
        const { fetchSeriesCandidates } = await import('./_lib/editorial/candidate_service.js');
        const { rankEditorialCandidates } = await import('./_lib/editorial/editorial_selection_engine.js');
        const candidates = await fetchSeriesCandidates(seriesSlug, 60);
        const { supabase } = await import('./_lib/supabase.js');
        const cooldownCutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
        const { data: recentItems } = await supabase
          .from('social_content_items')
          .select('source_entity_id,status,created_at')
          .gte('created_at', cooldownCutoff)
          .limit(500);
        const recentlyFeaturedIds = new Set(
          (recentItems || [])
            .filter((item: any) => item.source_entity_id && !['failed', 'rejected', 'archived'].includes(item.status))
            .map((item: any) => item.source_entity_id),
        );
        const referenceDate = scheduledDate
          ? new Date(`${scheduledDate}T12:00:00Z`)
          : new Date();
        const ranked = rankEditorialCandidates(candidates, seriesSlug, { referenceDate, recentlyFeaturedIds });
        return res.status(200).json(ranked.slice(0, 20).map(({ candidate, assessment }) => ({
          ...candidate,
          editorialScore: assessment.score,
          whyNow: assessment.whyNow,
          editorialReasons: assessment.reasons,
          editorialWarnings: assessment.warnings,
        })));
      }
      if (task === 'search_candidates') {
        const q = String(req.query?.q || '');
        const type = (req.query?.type || 'all') as any;
        const limit = Number(req.query?.limit || 20);
        const { searchCandidates } = await import('./_lib/editorial/candidate_service.js');
        return res.status(200).json(await searchCandidates(q, type, limit));
      }

      if (task === 'publish_due') {
        await requireSocialPublisherAuth(req);
        const result = await runSocialPublisher({
          limit: Number(req.query?.limit || 10),
          lockedBy: 'cron-runner',
        });
        return res.status(200).json(result);
      }

      const summary = await getSocialStudioSummary();
      const allConnections = await getAllPlatformConnections();
      return res.status(200).json({
        ...summary,
        connections: allConnections,
      });
    }

    if (req.method === 'POST') {
      if (task === 'intake_update') {
        await requireSocialStudioAdmin(req);
        const { updateSocialIntake } = await import('./_lib/social_intake.js');
        return res.status(200).json(await updateSocialIntake(req.body || {}));
      }

      if (task === 'intake_approve') {
        const actor = await requireSocialStudioAdmin(req);
        const { approveSocialIntake } = await import('./_lib/social_intake.js');
        return res.status(200).json(await approveSocialIntake(req.body || {}, actor.id));
      }

      if (task === 'intake_reject') {
        const actor = await requireSocialStudioAdmin(req);
        const { rejectSocialIntake } = await import('./_lib/social_intake.js');
        return res.status(200).json(await rejectSocialIntake(req.body || {}, actor.id));
      }

      if (task === 'intake_create_social') {
        const actor = await requireSocialStudioAdmin(req);
        const { createSocialDraftFromIntake } = await import('./_lib/social_intake.js');
        return res.status(201).json(await createSocialDraftFromIntake({
          intakeId: String(req.body?.intakeId || ''),
          captions: req.body?.captions || {},
          actorId: actor.id,
        }));
      }

      if (task === 'search_candidates') {
        await requireSocialStudioAdmin(req);
        const { q, type = 'all', limit = 20 } = req.body || {};
        const { searchCandidates } = await import('./_lib/editorial/candidate_service.js');
        return res.status(200).json(await searchCandidates(String(q || ''), type, Number(limit)));
      }

      if (task === 'update_slot_date') {
        await requireSocialStudioAdmin(req);
        const { updateEditorialCalendarSlot } = await import('./_lib/social_studio.js');
        return res.status(200).json(await updateEditorialCalendarSlot(req.body));
      }

      if (task === 'ai_generate_copy') {
        await requireSocialStudioAdmin(req);
        const { generateAICaptions } = await import('./_lib/editorial/social_copy_ai.js');
        const { candidate, series, angle, tone, preferredProvider } = req.body || {};
        if (!candidate || !candidate.name) {
          return res.status(400).json({ error: 'candidate with name is required' });
        }
        const result = await generateAICaptions({
          candidate,
          series,
          angle: (angle || tone || 'streaming_alert') as any,
          preferredProvider: preferredProvider || 'cohere',
        });
        return res.status(200).json(result);
      }

      if (task === 'approve_slot') {
        const actor = await requireSocialStudioAdmin(req);
        const { approveEditorialSlot } = await import('./_lib/social_studio.js');
        return res.status(200).json(await approveEditorialSlot(req.body, actor));
      }

      if (task === 'seed_calendar') {
        await requireSocialStudioAdmin(req);
        return res.status(200).json(await seedEditorialCalendarSlots(req.body || { days: 30 }));
      }

      if (task === 'disconnect_platform') {
        await requireSocialStudioAdmin(req);
        const platform = String(req.body?.platform || '').toLowerCase();
        if (!platform) return res.status(400).json({ error: 'Platform is required' });
        return res.status(200).json(await disconnectPlatform(platform));
      }

      if (task === 'save_connection') {
        const actor = await requireSocialStudioAdmin(req);
        const { platform, displayName, username, externalAccountId, accessToken, profileImageUrl, tokenExpiresAt, grantedScopes } = req.body || {};
        if (!platform || !username || !accessToken) {
          return res.status(400).json({ error: 'platform, username, and accessToken are required' });
        }
        return res.status(200).json(await savePlatformConnection({
          platform,
          displayName: displayName || username,
          username,
          externalAccountId: externalAccountId || username,
          accessToken,
          profileImageUrl,
          tokenExpiresAt,
          grantedScopes,
          actorId: actor.id,
        }));
      }

      if (task === 'attach_custom_asset') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, variantId, publicUrl, format, width, height, driveFileId, aspectRatio } = req.body || {};
        if (!contentItemId || !publicUrl) {
          return res.status(400).json({ error: 'contentItemId and publicUrl are required' });
        }
        return res.status(200).json(await attachCustomAsset({
          contentItemId, variantId, publicUrl, format, width, height, driveFileId, aspectRatio,
        }, actor));
      }

      if (task === 'attach_carousel_assets') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, variantId, publicUrls, assets, format, width, height } = req.body || {};
        if (!contentItemId || (!Array.isArray(publicUrls) && !Array.isArray(assets))) {
          return res.status(400).json({ error: 'contentItemId and carousel assets are required' });
        }
        return res.status(200).json(
          await attachCarouselAssets({ contentItemId, variantId, publicUrls, assets, format, width, height }, actor),
        );
      }

      if (task === 'reorder_carousel_assets') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, variantId, publicUrls, assets } = req.body || {};
        if (!contentItemId || (!Array.isArray(publicUrls) && !Array.isArray(assets))) {
          return res.status(400).json({ error: 'contentItemId and carousel assets are required' });
        }
        return res.status(200).json(await reorderCarouselAssets({ contentItemId, variantId, publicUrls, assets }, actor));
      }

      if (task === 'update_variant_caption') {
        const actor = await requireSocialStudioAdmin(req);
        const { variantId, caption } = req.body || {};
        if (typeof variantId !== 'string' || !variantId) {
          return res.status(400).json({ error: 'variantId is required' });
        }
        if (typeof caption !== 'string') {
          return res.status(400).json({ error: 'caption is required' });
        }
        return res.status(200).json(await updateSocialVariantCaption({ variantId, caption }, actor));
      }

      if (task === 'update_variant_options') {
        const actor = await requireSocialStudioAdmin(req);
        const { variantId, options } = req.body || {};
        if (typeof variantId !== 'string' || !variantId || !options || typeof options !== 'object') {
          return res.status(400).json({ error: 'variantId and options are required' });
        }
        return res.status(200).json(await updateSocialVariantOptions({ variantId, options }, actor));
      }

      if (task === 'update_variant_asset') {
        const actor = await requireSocialStudioAdmin(req);
        const { variantId, selectedAssetId, format } = req.body || {};
        if (typeof variantId !== 'string' || !variantId) {
          return res.status(400).json({ error: 'variantId is required' });
        }
        const { updateSocialVariantAsset } = await import('./_lib/social_studio.js');
        return res.status(200).json(await updateSocialVariantAsset({ variantId, selectedAssetId, format }, actor));
      }

      if (task === 'prepare_queue_item_edit') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId } = req.body || {};
        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }
        return res.status(200).json(await prepareSocialContentItemForEdit({ contentItemId }, actor));
      }

      if (task === 'update_queue_item') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, title, variants } = req.body || {};
        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }
        return res.status(200).json(await updateSocialContentItemDraft({ contentItemId, title, variants }, actor));
      }

      if (task === 'delete_queue_item') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId } = req.body || {};
        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }
        return res.status(200).json(await deleteSocialContentItem({ contentItemId }, actor));
      }

      if (task === 'threads_oauth_start') {
        const actor = await requireSocialStudioAdmin(req);
        return res.status(200).json({ authorizationUrl: await createThreadsAuthorizationUrl(req, actor) });
      }

      if (task === 'meta_oauth_start') {
        const actor = await requireSocialStudioAdmin(req);
        return res.status(200).json({ authorizationUrl: await createMetaAuthorizationUrl(req, actor) });
      }

      if (task === 'tiktok_oauth_start') {
        const actor = await requireSocialStudioAdmin(req);
        return res.status(200).json({ authorizationUrl: await createTikTokAuthorizationUrl(req, actor) });
      }

      if (task === 'threads_disconnect') {
        await requireSocialStudioAdmin(req);
        return res.status(200).json(await disconnectThreads());
      }

      if (task === 'generate_draft') {
        const actor = await requireSocialStudioAdmin(req);
        let parsed;
        try {
          parsed = parseGenerateDraftRequest(req.body);
        } catch (parseErr) {
          return res.status(400).json({ error: (parseErr as Error).message });
        }
        return res.status(201).json(await generateSocialDraft(parsed, actor));
      }

      if (task === 'create_editor_video_draft') {
        const actor = await requireSocialStudioAdmin(req);
        const { title, publicUrl, storagePath, mimeType, fileSizeBytes, width, height, captions, platforms } = req.body || {};
        return res.status(201).json(await createEditorVideoDraft({
          title, publicUrl, storagePath, mimeType, fileSizeBytes, width, height,
          captions: captions && typeof captions === 'object' ? captions : {},
          platforms: Array.isArray(platforms) ? platforms : [],
        }, actor));
      }

      if (task === 'publish_editor_video_now') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId } = req.body || {};
        if (typeof contentItemId !== 'string' || !contentItemId) return res.status(400).json({ error: 'contentItemId is required' });
        await scheduleContentItem({ contentItemId, scheduledFor: new Date().toISOString() }, actor);
        return res.status(200).json(await runSocialPublisher({ limit: 10, lockedBy: `studio:${actor.id}` }));
      }

      if (task === 'review') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, action, reason } = req.body || {};

        if (!isSocialReviewAction(action)) {
          return res.status(400).json({ error: 'action must be submit, approve, reject or reopen' });
        }
        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }

        return res.status(200).json(await reviewContentItem({ contentItemId, action, reason }, actor));
      }

      if (task === 'schedule') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, scheduledFor } = req.body || {};

        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }
        if (typeof scheduledFor !== 'string' || !scheduledFor) {
          return res.status(400).json({ error: 'scheduledFor is required' });
        }

        return res.status(200).json(await scheduleContentItem({ contentItemId, scheduledFor }, actor));
      }

      if (task === 'cancel_schedule') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId } = req.body || {};

        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }

        return res.status(200).json(await cancelContentSchedule({ contentItemId }, actor));
      }

      if (task === 'publish_due') {
        await requireSocialPublisherAuth(req);
        const result = await runSocialPublisher({
          limit: Number(req.body?.limit || req.query.limit || 10),
          lockedBy: 'api-social',
        });
        return res.status(200).json(result);
      }

      return res.status(400).json({ error: 'Unsupported social task' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    console.error(`[api/social:${requestId}]`, err);
    const status = Number(err?.status || 500);
    return res.status(status).json({
      error: status < 500
        ? (err?.message || 'The request could not be completed')
        : 'Social Studio could not complete that request. Please try again.',
      requestId,
    });
  }
}
