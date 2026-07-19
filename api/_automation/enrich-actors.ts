import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { processPeopleEnrichmentBatch } from '../_lib/people_enrichment.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await supabase.from('automation_jobs').upsert({
    id: 'actor_enricher',
    status: 'running',
    last_message: 'Building sourced profile proposals...',
    last_run: new Date().toISOString(),
  });

  try {
    const { count, error: countError } = await supabase
      .from('people_enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed']);
    if (countError) throw countError;

    if (!count) {
      const { error: refreshError } = await supabase.rpc('refresh_people_enrichment_queue');
      if (refreshError) throw refreshError;
    }

    const results = await processPeopleEnrichmentBatch({ limit: 5 });
    const ready = results.filter((result: any) => result.status === 'ready').length;
    const review = results.filter((result: any) => result.status === 'needs_review').length;
    const noMatch = results.filter((result: any) => result.status === 'no_match').length;
    const failed = results.filter((result: any) => result.status === 'failed').length;
    const message = results.length
      ? `Prepared ${results.length} sourced proposals: ${ready} ready, ${review} review, ${noMatch} no match, ${failed} failed`
      : 'No pending people enrichment records.';

    await supabase.from('automation_jobs').upsert({
      id: 'actor_enricher',
      status: 'idle',
      last_message: message,
      last_run: new Date().toISOString(),
    });

    return res.status(200).json({ message, results });
  } catch (error: any) {
    await supabase.from('automation_jobs').upsert({
      id: 'actor_enricher',
      status: 'error',
      last_message: `Error: ${error?.message || 'Unknown enrichment failure'}`,
      last_run: new Date().toISOString(),
    });
    return res.status(500).json({ error: error?.message || 'Actor enrichment failed' });
  }
}
