// Community contributions — the single client entry point for all crowd-sourced
// submissions (missing people, suggested edits, reports). Everything lands in the
// `contributions` table as 'pending' and is applied by an admin on approval.
// See sql/contributions_system.sql.

import { supabase } from './supabase';

export const CONTRIBUTION_TYPES = {
  NEW_PERSON: 'new_person',
  EDIT_PERSON: 'edit_person',
  EDIT_FILM: 'edit_film',
  REPORT_LINK: 'report_link',
  REPORT_CHANNEL: 'report_channel',
};

// Human labels for the admin queue + status pages.
export const CONTRIBUTION_LABELS = {
  new_person: 'New person',
  edit_person: 'Person edit',
  edit_film: 'Film edit',
  report_link: 'Broken/pirate link report',
  report_channel: 'Channel report',
};

/** Person edit fields that can be proposed + selectively applied. */
export const PERSON_EDIT_FIELDS = [
  { key: 'name', label: 'Name', kind: 'text', placeholder: 'Correct full name' },
  { key: 'known_for_department', label: 'Role / department', kind: 'text', placeholder: 'e.g. Actor, Director, Producer' },
  { key: 'bio', label: 'Bio', kind: 'textarea', placeholder: 'Short biography' },
  { key: 'date_of_birth', label: 'Date of birth', kind: 'date' },
  { key: 'birthplace', label: 'Birthplace', kind: 'text', placeholder: 'City, country' },
  { key: 'nationality', label: 'Nationality', kind: 'text', placeholder: 'e.g. Nigerian' },
  { key: 'instagram_url', label: 'Instagram', kind: 'url', placeholder: 'https://instagram.com/…' },
  { key: 'twitter_url', label: 'X / Twitter', kind: 'url', placeholder: 'https://x.com/…' },
  { key: 'tiktok_url', label: 'TikTok', kind: 'url', placeholder: 'https://tiktok.com/@…' },
  { key: 'facebook_url', label: 'Facebook', kind: 'url', placeholder: 'https://facebook.com/…' },
  { key: 'youtube_handle', label: 'YouTube handle', kind: 'text', placeholder: '@channel' },
];

/** Film edit fields that can be proposed + selectively applied. */
export const FILM_EDIT_FIELDS = [
  { key: 'title', label: 'Title', kind: 'text', placeholder: 'Correct title' },
  { key: 'year', label: 'Year', kind: 'number', placeholder: 'e.g. 2024' },
  { key: 'synopsis', label: 'Synopsis', kind: 'textarea', placeholder: 'Plot summary' },
  { key: 'runtime_minutes', label: 'Runtime (minutes)', kind: 'number', placeholder: 'e.g. 120' },
  { key: 'language', label: 'Language', kind: 'text', placeholder: 'e.g. Yoruba, English' },
  { key: 'countries', label: 'Countries', kind: 'text', placeholder: 'e.g. Nigeria, Ghana' },
  { key: 'trailer_youtube_id', label: 'Trailer YouTube ID', kind: 'text', placeholder: 'e.g. dQw4w9WgXcQ' },
  { key: 'tagline', label: 'Tagline', kind: 'text', placeholder: 'Short tagline' },
];

/**
 * Low-level insert. Requires a signed-in user (RLS enforces submitted_by = self).
 * Returns { ok, error }.
 */
async function submit({ type, target_table = null, target_id = null, payload = {}, image_path = null, note = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: new Error('You must be signed in to contribute.') };

  const { error } = await supabase.from('contributions').insert({
    type,
    target_table,
    target_id,
    payload,
    image_path: image_path || null,
    note: note || null,
    submitted_by: user.id,
  });

  if (error) {
    console.error('Contribution submit failed:', error);
    return { ok: false, error };
  }
  return { ok: true };
}

/** Drop empty strings / nulls from a fields map. */
export function compactFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

// --- Typed helpers --------------------------------------------------------

// Suggest a missing actor/crew member. Required: name, socials, sex. Optional:
// bio, photo (URL), date_of_birth, films (free-text list of titles).
export function suggestNewPerson({ name, social_link, sex, bio, image_path, date_of_birth, films, note }) {
  return submit({
    type: CONTRIBUTION_TYPES.NEW_PERSON,
    target_table: 'people',
    payload: { name, social_link, sex, bio, date_of_birth, films },
    image_path,
    note,
  });
}

/**
 * Suggest corrections/additions to an existing person.
 * `fields` is a map of column -> proposed value (only filled keys).
 * Optional `note` for free-text that cannot be auto-applied.
 * Legacy callers may still pass `changes` (string) — stored as note.
 */
export function suggestPersonEdit({ personId, fields, changes, image_path, note }) {
  const compact = compactFields(fields);
  const freeText = (note || changes || '').trim() || null;
  return submit({
    type: CONTRIBUTION_TYPES.EDIT_PERSON,
    target_table: 'people',
    target_id: personId,
    payload: {
      fields: compact,
      ...(freeText ? { note: freeText } : {}),
      // Keep legacy key so old admin UI still shows something if needed
      ...(freeText && !Object.keys(compact).length && !image_path ? { changes: freeText } : {}),
    },
    image_path,
    note: freeText,
  });
}

/** Suggest corrections/additions to an existing film. */
export function suggestFilmEdit({ filmId, fields, changes, image_path, note }) {
  const compact = compactFields(fields);
  const freeText = (note || changes || '').trim() || null;
  return submit({
    type: CONTRIBUTION_TYPES.EDIT_FILM,
    target_table: 'films',
    target_id: filmId,
    payload: {
      fields: compact,
      ...(freeText ? { note: freeText } : {}),
      ...(freeText && !Object.keys(compact).length && !image_path ? { changes: freeText } : {}),
    },
    image_path,
    note: freeText,
  });
}

// Report a broken or pirate watch link on a film.
export function reportLink({ filmId, reason, url, note }) {
  return submit({
    type: CONTRIBUTION_TYPES.REPORT_LINK,
    target_table: 'films',
    target_id: filmId,
    payload: { reason, url },
    note,
  });
}

// Report a problematic YouTube channel.
export function reportChannel({ channelId, reason, note }) {
  return submit({
    type: CONTRIBUTION_TYPES.REPORT_CHANNEL,
    target_table: 'youtube_channels',
    target_id: channelId,
    payload: { reason },
    note,
  });
}
