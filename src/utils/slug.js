/**
 * Slug utilities for Ensembla URL routing.
 * Allows detail pages to accept both slugs (new) and UUIDs (legacy backwards compat).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the string looks like a Supabase UUID.
 */
export const isUuid = (s) => UUID_REGEX.test(s);

/**
 * Returns the column name and value to use for a Supabase .eq() query.
 * If the param looks like a UUID, queries by 'id'.
 * Otherwise, queries by 'slug'.
 *
 * Usage:
 *   const { col, val } = slugOrId(slug);
 *   const { data } = await supabase.from('films').select('*').eq(col, val).single();
 */
export const slugOrId = (param) => {
  if (!param) return { col: 'id', val: null };
  return isUuid(param)
    ? { col: 'id', val: param }
    : { col: 'mubi_slug', val: param };
};
