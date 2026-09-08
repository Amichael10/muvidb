import { createHash } from 'crypto';
import { embedWithCohere, hasCohere } from './ai_service.js';
import { supabase } from './supabase.js';

const MODEL = process.env.COHERE_EMBED_MODEL || 'embed-v4.0';

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

export function formatFilmEmbedText(film: { title: string | null; synopsis: string | null }): string {
  const title = String(film.title || '').trim();
  const synopsis = String(film.synopsis || '').replace(/\s+/g, ' ').trim();
  if (synopsis) return `${title}. ${synopsis}`.slice(0, 8000);
  return title.slice(0, 2000);
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Computes and stores Cohere embeddings for a single film or batch of films in real-time.
 */
export async function syncFilmEmbedding(film: { id: string; title: string | null; synopsis: string | null }): Promise<boolean> {
  if (!film?.id || !film?.title) return false;
  if (!hasCohere()) return false;

  const text = formatFilmEmbedText(film);
  const hash = contentHash(text);

  try {
    const { data: existing } = await supabase
      .from('film_embeddings')
      .select('content_hash')
      .eq('film_id', film.id)
      .maybeSingle();

    if (existing?.content_hash === hash) {
      return true; // Already up-to-date
    }

    const [vec] = await embedWithCohere([text], {
      model: MODEL,
      inputType: 'search_document',
    });

    if (!vec || !vec.length) return false;

    const { error } = await supabase.from('film_embeddings').upsert(
      {
        film_id: film.id,
        embedding: toVectorLiteral(vec),
        content_hash: hash,
        model: MODEL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'film_id' }
    );

    if (error) {
      console.warn(`[film-embeddings] Failed to upsert embedding for ${film.id}: ${error.message}`);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn(`[film-embeddings] Error syncing embedding for film ${film.id}: ${err?.message || err}`);
    return false;
  }
}
