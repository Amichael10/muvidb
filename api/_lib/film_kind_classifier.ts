import { supabase } from './supabase.js';
import { generateAIContent, parseJSON } from './ai_service.js';
import {
  buildKindPrompt,
  contradictsRuntime,
  isActionableVerdict,
  parseKindVerdicts,
  type KindCandidate,
  type KindVerdict,
} from '../../src/features/catalogue/film-kind.js';

/**
 * Decides what harvested catalogue rows actually are.
 *
 * Runs through `generateAIContent`, so it inherits the whole provider chain —
 * Gemini, then Groq (with a smaller sub-fallback), then Cohere — each with key
 * rotation. A quota wall on one provider does not stall the pass.
 *
 * It only ever WRITES A VERDICT. Nothing here unpublishes or deletes a film:
 * 387 rows were removed by hand on 2026-08-01 on the strength of title
 * heuristics, and the lesson taken was that this step should propose, not act.
 */

/** Small enough that one bad batch costs little, large enough to amortise calls. */
const BATCH_SIZE = 25;

type ClassifyResult = {
  scanned: number;
  verdicts: number;
  flagged: number;
  overruled: number;
  byKind: Record<string, number>;
  batches: number;
  errors: string[];
};

function emptyResult(): ClassifyResult {
  return { scanned: 0, verdicts: 0, flagged: 0, overruled: 0, byKind: {}, batches: 0, errors: [] };
}

/**
 * Unchecked rows, newest first — harvested uploads are the ones most likely to
 * be mislabelled, and they arrive at the top.
 */
async function loadCandidates(limit: number): Promise<(KindCandidate & { runtimeMinutes: number | null })[]> {
  const { data, error } = await supabase
    .from('films')
    // `source` is the closest thing films carries to a provenance label; there
    // is no channel column on this table.
    .select('id,title,runtime_minutes,source')
    .is('content_kind', null)
    .not('title', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title),
    channel: row.source ?? null,
    runtimeMinutes: typeof row.runtime_minutes === 'number' ? row.runtime_minutes : null,
  }));
}

export async function classifyFilmKinds(
  input: { limit?: number; dryRun?: boolean } = {},
): Promise<ClassifyResult> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
  const result = emptyResult();

  const candidates = await loadCandidates(limit);
  result.scanned = candidates.length;
  if (!candidates.length) return result;

  const runtimeById = new Map(candidates.map(c => [c.id, c.runtimeMinutes]));

  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    result.batches += 1;

    let verdicts: KindVerdict[] = [];
    try {
      const { text } = await generateAIContent(buildKindPrompt(batch));
      verdicts = parseKindVerdicts(parseJSON(text), batch.map(row => row.id));
    } catch (err: any) {
      // One failed batch must not abandon the rest of the pass; the rows stay
      // unchecked and are picked up next run.
      result.errors.push(`batch ${result.batches}: ${err?.message || 'AI call failed'}`);
      continue;
    }

    for (const verdict of verdicts) {
      // A feature-length upload is not a trailer, whatever the model says.
      // Downgrade rather than discard, so the row is not re-queried forever.
      const overruled = contradictsRuntime(verdict, runtimeById.get(verdict.id) ?? null);
      const finalVerdict: KindVerdict = overruled
        ? { ...verdict, kind: 'unclear', confidence: 0, reason: 'Runtime contradicts the model verdict' }
        : verdict;

      if (overruled) result.overruled += 1;
      result.verdicts += 1;
      result.byKind[finalVerdict.kind] = (result.byKind[finalVerdict.kind] || 0) + 1;
      if (isActionableVerdict(finalVerdict)) result.flagged += 1;

      if (!input.dryRun) {
        const { error } = await supabase
          .from('films')
          .update({
            content_kind: finalVerdict.kind,
            content_kind_confidence: finalVerdict.confidence,
            content_kind_checked_at: new Date().toISOString(),
          })
          .eq('id', finalVerdict.id);

        if (error) result.errors.push(`write ${finalVerdict.id}: ${error.message}`);
      }
    }
  }

  return result;
}
