import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fetchSeriesCandidates } from './editorial/candidate_service.js';
import { scoreCandidate } from './editorial/scoring_service.js';
import { buildFactPack } from './editorial/fact_pack_service.js';
import { generateEditorialAngles, generateEditorialCopy } from './editorial/copy_service.js';
import { seedRollingCalendar } from './editorial/calendar_service.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function handleEditorialTask(req: VercelRequest, res: VercelResponse) {
  try {
    const task = (req.query.task || req.body?.task || '').toString();

    // 1. GET candidates
    if (task === 'candidates') {
      const seriesSlug = (req.query.seriesSlug || 'filmography').toString();
      const rawCandidates = await fetchSeriesCandidates(seriesSlug, 30);
      const scored = rawCandidates.map((c) => scoreCandidate(c));
      scored.sort((a, b) => b.score - a.score);

      return res.status(200).json({
        seriesSlug,
        total: scored.length,
        candidates: scored,
      });
    }

    // 2. GET calendar
    if (task === 'calendar') {
      await seedRollingCalendar(30);

      const { data: slots, error } = await supabase
        .from('social_calendar')
        .select('*, social_content_series(*), social_drafts(*)')
        .order('scheduled_date', { ascending: true })
        .limit(60);

      if (error) throw error;
      return res.status(200).json({ slots: slots || [] });
    }

    // 3. GET series
    if (task === 'series') {
      const { data: series, error } = await supabase
        .from('social_content_series')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ series: series || [] });
    }

    // 4. POST generate_brief
    if (req.method === 'POST' && task === 'generate_brief') {
      const { entityType, entityId, figmaTemplateKey, calendarId, seriesId } = req.body || {};

      if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entityType and entityId are required' });
      }

      const factPack = await buildFactPack(entityType, entityId);
      const angles = await generateEditorialAngles(factPack);
      const chosenAngle = angles[0] || {
        id: 'overview',
        title: `Overview of ${factPack.entity.name}`,
        reason: 'Verified database credits',
        confidence: 0.9,
      };

      const copy = await generateEditorialCopy(factPack, chosenAngle, figmaTemplateKey || 'people-filmography');

      const { data: draft, error: draftErr } = await supabase
        .from('social_drafts')
        .insert({
          calendar_id: calendarId || null,
          series_id: seriesId || null,
          entity_type: entityType,
          entity_id: entityId,
          status: 'draft',
          angle_id: chosenAngle.id,
          angle_json: chosenAngle,
          fact_pack_json: factPack,
          content_json: copy,
          figma_template_key: figmaTemplateKey || 'people-filmography',
        })
        .select()
        .single();

      if (draftErr) console.warn('[Editorial API] Draft insert warning:', draftErr.message);

      if (calendarId) {
        await supabase
          .from('social_calendar')
          .update({
            status: 'draft_ready',
            subject_entity_type: entityType,
            subject_entity_id: entityId,
            draft_id: draft?.id,
          })
          .eq('id', calendarId);
      }

      return res.status(200).json({
        factPack,
        angles,
        chosenAngle,
        copy,
        draft,
      });
    }

    // 5. POST mark_published
    if (req.method === 'POST' && task === 'mark_published') {
      const { draftId, calendarId, entityType, entityId, platform, postUrl } = req.body || {};

      await supabase.from('social_entity_history').insert({
        entity_type: entityType || 'movie',
        entity_id: entityId,
        draft_id: draftId || null,
        calendar_id: calendarId || null,
        published_at: new Date().toISOString(),
        platforms: [platform || 'instagram'],
        metadata: { postUrl: postUrl || '' },
      });

      if (draftId) {
        await supabase
          .from('social_drafts')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', draftId);
      }

      if (calendarId) {
        await supabase
          .from('social_calendar')
          .update({ status: 'published' })
          .eq('id', calendarId);
      }

      return res.status(200).json({ success: true });
    }

    // 6. GET overview
    if (task === 'overview') {
      const { data: upcomingSlots } = await supabase
        .from('social_calendar')
        .select('*, social_content_series(*)')
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })
        .limit(7);

      const { data: draftsNeedingReview } = await supabase
        .from('social_drafts')
        .select('*')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: events } = await supabase
        .from('social_news_events')
        .select('*')
        .eq('status', 'new')
        .order('detected_at', { ascending: false })
        .limit(10);

      const { data: history } = await supabase
        .from('social_entity_history')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);

      return res.status(200).json({
        upcomingSlots: upcomingSlots || [],
        draftsNeedingReview: draftsNeedingReview || [],
        reactiveEvents: events || [],
        recentHistory: history || [],
      });
    }

    return res.status(400).json({ error: `Unknown editorial task: ${task}` });
  } catch (err: any) {
    console.error('[Editorial Handler] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Editorial Server Error' });
  }
}
