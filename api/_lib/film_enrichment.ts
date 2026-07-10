/**
 * Inline AI enrichment for freshly-scraped YouTube films.
 *
 * YouTube titles/descriptions are stuffed with cast lists and SEO spam, e.g.
 *   "si olorun | Kiekie, odunlade adekola, lizzy anjorin | Latest Yoruba 2026"
 * From that we want: a clean title ("Si Olorun"), the cast pulled OUT of the
 * title into real credits, and a de-spammed synopsis (no hashtags / fake names).
 *
 * All of this is best-effort: if the AI providers are exhausted for the day the
 * caller just falls back to the regex cleaner + TMDB/none, and the film is still
 * created exactly as before.
 */
import { supabase } from './supabase.js';
import { generateAIContent, parseJSON } from './ai_service.js';

export interface EnrichedFilm {
  title?: string;        // clean title, episode/part numbers preserved
  cast: string[];        // full actor names extracted from title/description
  director?: string | null; // director, if explicitly credited ("Directed by …")
  synopsis?: string | null; // de-spammed plot, or null if the source had none
}

// Chunk so one giant prompt can't blow the model's context on a big channel.
const CHUNK = 20;

/**
 * Batch-enrich a set of videos. Returns videoId -> {title, cast, synopsis}.
 * Returns an empty map (never throws) if the AI is unavailable — callers treat
 * that as "skip enrichment, create the film the old way".
 */
export async function enrichFilmsFromAI(
  items: { videoId: string; title: string; description?: string | null }[],
): Promise<Map<string, EnrichedFilm>> {
  const out = new Map<string, EnrichedFilm>();
  if (!items.length) return out;

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK).map((v) => ({
      id: v.videoId,
      title: (v.title || '').slice(0, 300),
      description: (v.description || '').replace(/\s+/g, ' ').slice(0, 700),
    }));

    const prompt = `You are a Nollywood / African-cinema database editor. Each item below is a YouTube movie upload whose title and description are stuffed with cast lists and SEO keywords. For EACH item return clean metadata.

For each item output an object with:
- "id": echo the id exactly.
- "title": the actual movie or episode title ONLY. Remove cast names, channel names, release years, and buzzwords ("Latest Yoruba Movie 2026", "Full Movie", "Nollywood", "HD", pipes/brackets, etc). PRESERVE episode/part/season numbers if present (e.g. "Si Olorun Episode 5"). Use Proper Case.
- "cast": array of FULL actor names that appear in the title or description and are actually in this film. Proper Case. Use [] if none are clearly identifiable. Do NOT include the channel name or the uploader.
- "director": the director's full name ONLY if explicitly credited (e.g. "Directed by …", "A film by …"). Otherwise null. Do NOT put the director in "cast".
- "synopsis": a clean 1-3 sentence plot summary built ONLY from real plot information in the description. Strip hashtags, emojis, links, "subscribe"/channel promos, and keyword-stuffed name lists. Do NOT invent or guess a plot — if the description has no genuine plot description, return null.

Return ONLY a JSON array, no prose:
[{"id":"...","title":"...","cast":["..."],"director":"..." or null,"synopsis":"..." or null}]

Items:
${JSON.stringify(chunk)}`;

    try {
      const { text } = await generateAIContent(prompt);
      const parsed = parseJSON(text);
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          if (!row?.id) continue;
          const title = typeof row.title === 'string' ? row.title.trim() : undefined;
          const synopsis =
            typeof row.synopsis === 'string' && row.synopsis.trim().length > 10
              ? row.synopsis.trim()
              : null;
          const cast = Array.isArray(row.cast)
            ? row.cast.map((c: any) => String(c).trim()).filter((c: string) => c.length > 1 && c.length < 60)
            : [];
          const director =
            typeof row.director === 'string' && row.director.trim().length > 1 && row.director.trim().length < 60
              ? row.director.trim()
              : null;
          out.set(String(row.id), { title: title || undefined, cast, director, synopsis });
        }
      }
    } catch (e: any) {
      // Quota exhausted / all providers down — stop trying, return what we have.
      console.warn(`[film-enrichment] AI unavailable, skipping enrichment: ${e.message}`);
      break;
    }
  }
  return out;
}

/**
 * Resolve or create people and attach them as role-tagged credits to films.
 * Batched: each unique name is resolved once. Mirrors the tiered lookup used by
 * the AI-maintenance cast job.
 */
export async function attachCreditsBatch(
  entries: { filmId: string; people: { name: string; role: string }[] }[],
): Promise<number> {
  const valid = entries.filter((e) => e.filmId && e.people?.length);
  if (!valid.length) return 0;

  const uniqueNames = Array.from(new Set(valid.flatMap((e) => e.people.map((p) => p.name))));
  const personId = new Map<string, string>();

  for (const name of uniqueNames) {
    try {
      // Tier 1: exact (case-insensitive) match.
      let { data: person } = await supabase
        .from('people').select('id, name').ilike('name', name).limit(1).maybeSingle();
      // Tier 2: partial match (handles minor spelling/casing differences).
      if (!person) {
        const { data: partial } = await supabase
          .from('people').select('id, name').ilike('name', `%${name}%`).limit(1).maybeSingle();
        if (partial) person = partial;
      }
      // Tier 3: create.
      let id = person?.id;
      if (!id) {
        const { data: newP } = await supabase
          .from('people')
          .insert({ name, nationality: 'Nigerian', created_at: new Date().toISOString() })
          .select('id').single();
        id = newP?.id;
      }
      if (id) personId.set(name, id);
    } catch (e: any) {
      console.warn(`[film-enrichment] cast resolve failed for "${name}": ${e.message}`);
    }
  }

  // Build unique credits (keyed by film+person+role), then skip existing ones.
  const wanted = new Map<string, { film_id: string; person_id: string; role: string; billing_order: number }>();
  for (const e of valid) {
    e.people.forEach((p, idx) => {
      const pid = personId.get(p.name);
      if (pid) wanted.set(`${e.filmId}-${pid}-${p.role}`, { film_id: e.filmId, person_id: pid, role: p.role, billing_order: p.role === 'director' ? 0 : idx + 1 });
    });
  }
  if (!wanted.size) return 0;

  const filmIds = Array.from(new Set([...wanted.values()].map((c) => c.film_id)));
  const { data: existing } = await supabase
    .from('credits').select('film_id, person_id, role').in('film_id', filmIds);
  const existingSet = new Set((existing || []).map((c: any) => `${c.film_id}-${c.person_id}-${c.role}`));

  const toInsert = [...wanted.entries()].filter(([k]) => !existingSet.has(k)).map(([, c]) => c);
  if (toInsert.length) {
    const { error } = await supabase.from('credits').insert(toInsert);
    if (error) { console.warn(`[film-enrichment] credit insert failed: ${error.message}`); return 0; }
  }
  return toInsert.length;
}
