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

/**
 * Low-level insert. Requires a signed-in user (RLS enforces submitted_by = self).
 * Returns { ok, error }.
 */
async function submit({ type, target_table = null, target_id = null, payload = {}, image_url = null, note = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: new Error('You must be signed in to contribute.') };

  const { error } = await supabase.from('contributions').insert({
    type,
    target_table,
    target_id,
    payload,
    image_url: image_url || null,
    note: note || null,
    submitted_by: user.id,
  });

  if (error) {
    console.error('Contribution submit failed:', error);
    return { ok: false, error };
  }
  return { ok: true };
}

// --- Typed helpers --------------------------------------------------------

// Suggest a missing actor/crew member. Required: name, socials, sex. Optional:
// bio, photo (URL), date_of_birth, films (free-text list of titles).
export function suggestNewPerson({ name, social_link, sex, bio, photo_url, date_of_birth, films, note }) {
  return submit({
    type: CONTRIBUTION_TYPES.NEW_PERSON,
    target_table: 'people',
    payload: { name, social_link, sex, bio, date_of_birth, films },
    image_url: photo_url,
    note,
  });
}

// Suggest corrections/additions to an existing person. `changes` is a free-form
// description and/or a map of field -> proposed value; image optional.
export function suggestPersonEdit({ personId, changes, photo_url, note }) {
  return submit({
    type: CONTRIBUTION_TYPES.EDIT_PERSON,
    target_table: 'people',
    target_id: personId,
    payload: { changes },
    image_url: photo_url,
    note,
  });
}

// Suggest corrections/additions to an existing film.
export function suggestFilmEdit({ filmId, changes, image_url, note }) {
  return submit({
    type: CONTRIBUTION_TYPES.EDIT_FILM,
    target_table: 'films',
    target_id: filmId,
    payload: { changes },
    image_url,
    note,
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
