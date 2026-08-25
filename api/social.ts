import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

const EDITORIAL_TASKS = new Set([
  'candidates',
  'calendar',
  'series',
  'generate_brief',
  'mark_published',
  'overview',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const pathname = (req.url || '').split('?')[0];
  let task = (req.query?.task || req.body?.task || '').toString();
  if (!task && pathname.includes('/tiktok/callback')) task = 'tiktok_callback';
  if (!task && pathname.includes('/meta/callback')) task = 'meta_callback';
  if (!task && pathname.includes('/threads/callback')) task = 'threads_callback';
  const scope = (req.query?.scope || req.body?.scope || '').toString();

  try {
    if (scope === 'editorial' || EDITORIAL_TASKS.has(task)) {
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

    if (task === 'threads_delete') {
      const confirmationCode = 'muvidb_del_' + Date.now();
      return res.status(200).json({
        url: 'https://muvidb.com/privacy',
        confirmation_code: confirmationCode,
      });
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
      const { candidate, format = 'portrait_4_5' } = (req.method === 'POST' ? req.body : req.query) || {};
      if (!candidate) {
        return res.status(400).json({ error: 'Candidate data is required for preview rendering' });
      }
      const parsedCandidate = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      const { renderSnapshotAsset } = await import('./_lib/social_render.js');
      const isPerson = parsedCandidate.type === 'person';
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
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(rendered.png);
    }

    if (req.method === 'GET') {
      await requireSocialStudioAdmin(req);
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
      if (task === 'search_candidates') {
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
        const { contentItemId, publicUrl, format, width, height } = req.body || {};
        if (!contentItemId || !publicUrl) {
          return res.status(400).json({ error: 'contentItemId and publicUrl are required' });
        }
        return res.status(200).json(await attachCustomAsset({ contentItemId, publicUrl, format, width, height }, actor));
      }

      if (task === 'attach_carousel_assets') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, publicUrls, format, width, height } = req.body || {};
        if (!contentItemId || !Array.isArray(publicUrls)) {
          return res.status(400).json({ error: 'contentItemId and publicUrls are required' });
        }
        return res.status(200).json(
          await attachCarouselAssets({ contentItemId, publicUrls, format, width, height }, actor),
        );
      }

      if (task === 'reorder_carousel_assets') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, publicUrls } = req.body || {};
        if (!contentItemId || !Array.isArray(publicUrls)) {
          return res.status(400).json({ error: 'contentItemId and publicUrls are required' });
        }
        return res.status(200).json(await reorderCarouselAssets({ contentItemId, publicUrls }, actor));
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
    console.error('[api/social]', err);
    return res.status(err?.status || 500).json({
      error: err?.message || 'Social Studio request failed',
    });
  }
}
