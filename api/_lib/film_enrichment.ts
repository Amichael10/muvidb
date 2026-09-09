/**
 * Inline AI enrichment for freshly-scraped YouTube films.
 *
 * YouTube titles/descriptions are stuffed with cast lists and SEO spam, e.g.
 *   "si olorun | Kiekie, odunlade adekola, lizzy anjorin | Latest Yoruba 2026"
 * From that we want: a clean title ("Si Olorun"), the cast pulled OUT of the
 * title into real credits, and a de-spammed synopsis (no hashtags / fake names).
 *
 * All of this is best-effort. The caller still applies its deterministic title
 * policy when AI is unavailable, including rejecting sentence-only clickbait.
 */
import { supabase } from './supabase.js';
import { generateAIContent, parseJSON } from './ai_service.js';

export interface EnrichedFilm {
  title?: string;        // clean title, episode/part numbers preserved
  cast: string[];        // full actor names extracted from title/description
  director?: string | null; // director, if explicitly credited ("Directed by …")
  genres?: string[];     // extracted genres from description/title
  synopsis?: string | null; // de-spammed plot, or null if the source had none
}

// Chunk so one giant prompt can't blow the model's context on a big channel.
const CHUNK = 20;

/**
 * Batch-enrich a set of videos. Returns videoId -> {title, cast, director, genres, synopsis}.
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

    const prompt = `You are a Nollywood / African-cinema database editor. Each item below is a YouTube movie upload whose title and description are stuffed with cast lists, genres, and SEO keywords. For EACH item return clean metadata.

For each item output an object with:
- "id": echo the id exactly.
- "title": the actual movie or episode title ONLY. Remove cast names, channel names, release years, and buzzwords ("Latest Yoruba Movie 2026", "Full Movie", "Nollywood", "HD", pipes/brackets, etc). PRESERVE episode/part/season numbers if present (e.g. "Si Olorun Episode 5"). Use Proper Case.
- "cast": array of FULL actor names that appear in the title or description and are actually in this film. Proper Case. Use [] if none are clearly identifiable. Do NOT include the channel name or the uploader.
- "director": the director's full name ONLY if explicitly credited (e.g. "Directed by …", "A film by …"). Otherwise null. Do NOT put the director in "cast".
- "genres": array of genres mentioned or evident in the description or title (e.g. explicit "Genre: Drama, Epic", "A Yoruba Romantic Comedy", "Action Thriller"). Choose ONLY from standard genres: ["Drama", "Comedy", "Romance", "Action", "Thriller", "Horror", "Epic", "Crime", "Family", "Adventure", "Fantasy", "Mystery", "Sci-Fi", "Documentary"]. Return [] if none are identifiable.
- "synopsis": a clean 1-3 sentence plot summary built ONLY from real plot information in the description. Strip hashtags, emojis, links, "subscribe"/channel promos, and keyword-stuffed name lists. Do NOT invent or guess a plot — if the description has no genuine plot description, return null.

Example: "Premium Queen: YOU Will NOT Regret Watching This Mindblowing Mercy Kenneth 2026 New-nigerian Movies" becomes title "Premium Queen" with cast ["Mercy Kenneth"] and genres ["Drama"].

Return ONLY a JSON array, no prose:
[{"id":"...","title":"...","cast":["..."],"director":"..." or null,"genres":["..."],"synopsis":"..." or null}]

Items:
${JSON.stringify(chunk)}`;

    try {
      // Cohere is provisioned specifically for catalogue text work. Prefer it
      // here so a retired Gemini/Groq model cannot silently disable the entire
      // title/cast/synopsis pass during a YouTube sync.
      const { text } = await generateAIContent(prompt, { preferredProvider: 'cohere' });
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
          const genres = Array.isArray(row.genres)
            ? row.genres.map((g: any) => String(g).trim()).filter((g: string) => g.length > 1 && g.length < 40)
            : [];
          out.set(String(row.id), { title: title || undefined, cast, director, genres, synopsis });
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
      const aliasKey = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (aliasKey) {
        const { data: aliasRow } = await supabase
          .from('person_aliases')
          .select('person_id')
          .eq('alias_key', aliasKey)
          .limit(1)
          .maybeSingle();
        if (aliasRow?.person_id) {
          personId.set(name, aliasRow.person_id);
          continue;
        }
      }

      // Single shared matcher for every ingestion path (see migration
      // 20260723112408): exact name, else people.name_key — which is
      // order-insensitive and honorific-stripped, so "Kosoko Jide" and
      // "Prince Jide Kosoko" resolve to the existing "Jide Kosoko" instead of
      // creating rivals. Creates only on a genuine miss.
      const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
        p_name: name,
        p_extra: { nationality: 'Nigerian', source: 'enrichment' },
      });
      if (error) throw error;
      if (id) personId.set(name, id as unknown as string);
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

/**
 * Resolve standard genres and attach them to films via both films.genres and
 * the film_genres junction table.
 */
export async function attachGenresBatch(
  entries: { filmId: string; genres: string[] }[],
): Promise<number> {
  const valid = entries.filter((e) => e.filmId && e.genres?.length);
  if (!valid.length) return 0;

  // 1. Fetch existing genres table
  const { data: dbGenres, error } = await supabase.from('genres').select('id, name');
  if (error || !dbGenres?.length) {
    console.warn(`[film-enrichment] genres fetch failed: ${error?.message}`);
    return 0;
  }

  const genreMap = new Map<string, { id: string; name: string }>();
  for (const g of dbGenres) {
    genreMap.set(g.name.toLowerCase().trim(), g);
  }

  const junctionRows: { film_id: string; genre_id: string }[] = [];
  const filmGenreUpdates = new Map<string, string[]>();

  for (const entry of valid) {
    const matchedGenreIds: string[] = [];
    const canonicalNames: string[] = [];

    for (const rawName of entry.genres) {
      const clean = String(rawName || '').trim();
      if (!clean) continue;

      let match = genreMap.get(clean.toLowerCase());
      if (!match) {
        if (/epic/i.test(clean)) match = genreMap.get('epic') || genreMap.get('drama');
        else if (/comedy/i.test(clean)) match = genreMap.get('comedy');
        else if (/romance|romantic/i.test(clean)) match = genreMap.get('romance');
        else if (/thriller|suspense/i.test(clean)) match = genreMap.get('thriller');
        else if (/action/i.test(clean)) match = genreMap.get('action');
        else if (/drama/i.test(clean)) match = genreMap.get('drama');
        else if (/horror/i.test(clean)) match = genreMap.get('horror');
        else if (/crime/i.test(clean)) match = genreMap.get('crime');
        else if (/family/i.test(clean)) match = genreMap.get('family');
      }

      if (match) {
        if (!matchedGenreIds.includes(match.id)) matchedGenreIds.push(match.id);
        if (!canonicalNames.includes(match.name)) canonicalNames.push(match.name);
      }
    }

    if (matchedGenreIds.length > 0) {
      for (const gid of matchedGenreIds) {
        junctionRows.push({ film_id: entry.filmId, genre_id: gid });
      }
      filmGenreUpdates.set(entry.filmId, canonicalNames);
    }
  }

  if (!junctionRows.length) return 0;

  // 2. Insert into film_genres junction table
  const filmIds = Array.from(new Set(junctionRows.map((j) => j.film_id)));
  const { data: existingJunctions } = await supabase
    .from('film_genres')
    .select('film_id, genre_id')
    .in('film_id', filmIds);

  const existingSet = new Set((existingJunctions || []).map((j: any) => `${j.film_id}-${j.genre_id}`));
  const toInsert = junctionRows.filter((j) => !existingSet.has(`${j.film_id}-${j.genre_id}`));

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from('film_genres').insert(toInsert);
    if (insertErr) {
      console.warn(`[film-enrichment] film_genres junction insert error: ${insertErr.message}`);
    }
  }

  // 3. Sync films.genres column where sparse
  for (const [filmId, genres] of filmGenreUpdates.entries()) {
    try {
      const { data: currentFilm } = await supabase.from('films').select('genres').eq('id', filmId).maybeSingle();
      const current = Array.isArray(currentFilm?.genres) ? currentFilm.genres : [];
      const merged = Array.from(new Set([...current, ...genres]));
      if (merged.length > current.length) {
        await supabase.from('films').update({ genres: merged }).eq('id', filmId);
      }
    } catch (e: any) {
      console.warn(`[film-enrichment] film genres array update error: ${e.message}`);
    }
  }

  return toInsert.length;
}
