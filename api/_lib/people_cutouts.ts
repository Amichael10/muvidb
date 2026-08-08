import { supabase } from './supabase.js';
import { collectCloudinaryCredentials, generateCutout } from './cloudinary.js';

/**
 * Produces background-removed portraits for `people` and caches them on the row.
 *
 * Cloudinary's background removal is a metered add-on and runs asynchronously
 * (~6s per image), so this is a batch job rather than something the renderer
 * calls inline. Social Studio cards read `people.photo_cutout_url` and fall back
 * to a plain framed portrait when it is absent, so this job improves cards over
 * time instead of blocking them.
 */

const CUTOUT_BUCKET = 'people';
const CUTOUT_PREFIX = 'cutouts';

export type CutoutJobResult = {
  skipped?: true;
  reason?: string;
  processed: number;
  succeeded: number;
  failed: number;
  results: { personId: string; name: string; status: 'ready' | 'failed'; detail?: string }[];
};

type CutoutCandidate = {
  id: string;
  name: string | null;
  photo_url: string | null;
  photo_cutout_source_url: string | null;
};

/**
 * Eligible = has a photo, and either has never produced a usable cut-out or the
 * source photo has changed since the last one. `rejected` rows are deliberately
 * excluded: a human said no, so the job must not keep retrying them.
 */
async function selectCandidates(limit: number): Promise<CutoutCandidate[]> {
  const { data, error } = await supabase
    .from('people')
    .select('id,name,photo_url,photo_cutout_source_url,photo_cutout_status')
    .not('photo_url', 'is', null)
    .or('photo_cutout_status.is.null,photo_cutout_status.in.(pending,failed)')
    .order('photo_cutout_attempted_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CutoutCandidate[];
}

async function storeCutout(personId: string, png: Buffer): Promise<string> {
  const objectPath = `${CUTOUT_PREFIX}/${personId}.png`;

  const { error } = await supabase.storage.from(CUTOUT_BUCKET).upload(objectPath, png, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(CUTOUT_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function runPeopleCutoutJob(
  input: { limit?: number; personIds?: string[] } = {},
): Promise<CutoutJobResult> {
  const credentials = collectCloudinaryCredentials();
  if (!credentials.length) {
    return { skipped: true, reason: 'cloudinary_not_configured', processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  // Each image costs ~6s of polling against a 60s function budget, so batches
  // stay small. Raise the ceiling only if this moves off a serverless function.
  const limit = Math.min(Math.max(input.limit || 5, 1), 12);

  let candidates: CutoutCandidate[];
  if (input.personIds?.length) {
    const { data, error } = await supabase
      .from('people')
      .select('id,name,photo_url,photo_cutout_source_url')
      .in('id', input.personIds)
      .not('photo_url', 'is', null);
    if (error) throw error;
    candidates = (data || []) as CutoutCandidate[];
  } else {
    candidates = await selectCandidates(limit);
  }

  const results: CutoutJobResult['results'] = [];

  for (const person of candidates) {
    if (!person.photo_url) continue;

    await supabase
      .from('people')
      .update({ photo_cutout_status: 'pending', photo_cutout_attempted_at: new Date().toISOString() })
      .eq('id', person.id);

    try {
      const { png, credentialLabel } = await generateCutout(person.photo_url, { credentials });
      const publicUrl = await storeCutout(person.id, png);

      await supabase
        .from('people')
        .update({
          photo_cutout_url: publicUrl,
          photo_cutout_status: 'ready',
          photo_cutout_source_url: person.photo_url,
          photo_cutout_error: null,
        })
        .eq('id', person.id);

      results.push({ personId: person.id, name: person.name || '', status: 'ready', detail: credentialLabel });
    } catch (err) {
      const message = (err as Error).message || 'unknown error';
      await supabase
        .from('people')
        .update({ photo_cutout_status: 'failed', photo_cutout_error: message.slice(0, 500) })
        .eq('id', person.id);

      results.push({ personId: person.id, name: person.name || '', status: 'failed', detail: message });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter(r => r.status === 'ready').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  };
}
