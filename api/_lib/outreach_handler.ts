import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase as serviceSupabase } from './supabase.js';
import { handleCors } from './cors.js';
import { isValidAuth } from './auth.js';
import { generateQueueBatch, fetchOutreachCandidates } from './outreach_generator.js';
import fs from 'fs';
import path from 'path';

const SESSION_PATH = path.resolve(process.cwd(), 'scratch/ig_session.json');

export async function handleOutreach(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // Verify Admin Auth
  try {
    const authOk = await isValidAuth(req);
    if (!authOk.valid) return res.status(401).json({ ok: false, error: 'Unauthorized admin access' });
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: e.message });
  }

  const action = (req.query.action as string) || (req.body?.action as string) || 'list_candidates';

  // 1. Session Status
  if (action === 'session_status') {
    const hasSession = fs.existsSync(SESSION_PATH);
    let sessionAgeDays = null;
    if (hasSession) {
      const stats = fs.statSync(SESSION_PATH);
      sessionAgeDays = Math.round((Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24));
    }
    return res.status(200).json({
      ok: true,
      connected: hasSession,
      sessionAgeDays,
      sessionPath: hasSession ? 'scratch/ig_session.json' : null,
    });
  }

  // 2. List Candidates & Queue
  if (action === 'list_candidates') {
    try {
      const limit = Number(req.query.limit) || 50;
      const statusFilter = (req.query.status as string) || 'all';

      // Fetch candidates from people table
      let query = serviceSupabase
        .from('people')
        .select(`
          id, name, slug, photo_url, instagram_url,
          known_for_department, film_count, claimed_by,
          artist_outreach(id, status, last_message, notes, contacted_at, created_at, updated_at)
        `)
        .not('instagram_url', 'is', null)
        .is('claimed_by', null)
        .order('film_count', { ascending: true })
        .limit(200);

      const { data, error } = await query;
      if (error) throw error;

      const items = (data || []).map((p: any) => {
        const outreach = Array.isArray(p.artist_outreach) ? p.artist_outreach[0] : p.artist_outreach;
        const status = outreach?.status || 'pending';
        const personSlug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        return {
          id: p.id,
          person_id: p.id,
          name: p.name,
          photo_url: p.photo_url,
          instagram_url: p.instagram_url,
          known_for_department: p.known_for_department || 'Crew / Actor',
          film_count: p.film_count || 0,
          profile_url: `https://muvidb.com/people/${personSlug}`,
          claim_url: `https://muvidb.com/claim/${personSlug}`,
          status,
          message: outreach?.last_message || '',
          notes: outreach?.notes || '',
          contacted_at: outreach?.contacted_at || null,
          created_at: outreach?.created_at || p.created_at,
        };
      });

      // Stats counts
      const counts = {
        total: items.length,
        queued: items.filter(i => i.status === 'queued').length,
        sent: items.filter(i => i.status === 'sent').length,
        pending: items.filter(i => i.status === 'pending').length,
        skipped: items.filter(i => i.status === 'skipped').length,
      };

      const filtered = statusFilter === 'all'
        ? items
        : items.filter(i => i.status === statusFilter);

      return res.status(200).json({
        ok: true,
        items: filtered.slice(0, limit),
        counts,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // 3. Generate New AI Batch
  if (action === 'generate_batch') {
    try {
      const limit = Number(req.query.limit || req.body?.limit || req.body?.count || req.query.count) || 25;
      const minFilms = Number(req.query.min_films || req.body?.min_films) || 1;
      const maxFilms = req.query.max_films ? Number(req.query.max_films) : (req.body?.max_films ? Number(req.body?.max_films) : 10);
      const craft = (req.query.craft as string) || (req.body?.craft as string) || null;

      const result = await generateQueueBatch({
        limit,
        minFilms,
        maxFilms,
        craft,
      });
      return res.status(200).json({
        ok: true,
        success: true,
        queued: result.queued,
        queued_count: result.queued,
        candidates: result.candidates,
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // 4. Update Candidate Message / Status
  if (action === 'update_message') {
    try {
      const { person_id, message, status } = req.body;
      if (!person_id) return res.status(400).json({ ok: false, error: 'person_id is required' });

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (message !== undefined) updateData.last_message = message;
      if (status !== undefined) updateData.status = status;

      const { error } = await serviceSupabase
        .from('artist_outreach')
        .upsert({
          person_id,
          ...updateData,
        }, { onConflict: 'person_id' });

      if (error) throw error;

      return res.status(200).json({ ok: true, success: true, person_id });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // 5. Cancel / Skip Candidate
  if (action === 'cancel_candidate') {
    try {
      const person_id = req.body?.person_id || req.query.person_id;
      if (!person_id) return res.status(400).json({ ok: false, error: 'person_id is required' });

      const { error } = await serviceSupabase
        .from('artist_outreach')
        .upsert({
          person_id,
          status: 'skipped',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'person_id' });

      if (error) throw error;

      return res.status(200).json({ ok: true, success: true, person_id, status: 'skipped' });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'Unknown outreach action' });
}
