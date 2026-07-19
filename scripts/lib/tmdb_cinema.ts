import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMissingNollywoodFilm } from '../../api/_lib/cinema-adapters/resolve-film.js';

/**
 * Backward-compatible wrapper for dedicated cinema sync scripts.
 * The shared resolver now applies the same strict title and Nigerian-production
 * checks used by every registered cinema adapter.
 */
export async function findAndInsertMissingFilm(
  supabase: SupabaseClient,
  title: string,
  source = 'dedicated-sync',
) {
  return resolveMissingNollywoodFilm(supabase, title, source);
}
