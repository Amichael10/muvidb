// Community contributions — the single client entry point for all crowd-sourced
// submissions (new films/people/channels, suggested edits, reports). Everything
// lands in the `contributions` table as 'pending' and is applied by an admin on
// approval. See supabase/migrations/20260802070000_contribution_submission_types.sql.

import { supabase } from './supabase';

export const CONTRIBUTION_TYPES = {
  NEW_PERSON: 'new_person',
  NEW_FILM: 'new_film',
  NEW_CHANNEL: 'new_channel',
  EDIT_PERSON: 'edit_person',
  EDIT_FILM: 'edit_film',
  REPORT_LINK: 'report_link',
  REPORT_CHANNEL: 'report_channel',
};

// Human labels for the admin queue + status pages.
export const CONTRIBUTION_LABELS = {
  new_person: 'New person',
  new_film: 'New film',
  new_channel: 'New channel',
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

// --- New-record submission schemas ----------------------------------------
//
// The *_SUBMIT_FIELDS arrays below are the single description of each public
// submission form. They are rendered twice — once as the public /submit/:kind
// wizard, once as the admin review rows — so a field only ever has to be added
// in one place. Everything a renderer needs is on the field itself; nothing
// downstream should carry its own list of keys or labels.
//
// Field shape (same base as PERSON_EDIT_FIELDS / FILM_EDIT_FIELDS above):
//   key          column name on the target table; also the payload key
//   label        human label
//   kind         'text' | 'textarea' | 'number' | 'date' | 'url' | 'select'
//                | 'multiselect' | 'image'
//   step         which wizard step it belongs to — see SUBMIT_STEPS
//   required     true if the form must not be submitted without it
//   placeholder  input placeholder (optional)
//   help         one-line hint shown under the input (optional)
//   options      [{ value, label }] for 'select' / 'multiselect'
//   optionsSource  { table, column } when `options` is only a fallback and the
//                  live vocabulary should be read from the database
//   rows         suggested height for 'textarea'
//   defaultValue seed value for an empty form
//   min / max    numeric bounds for 'number'
//   identity     true for the one field that names the record; the duplicate
//                check in step 1 searches on it and seeds it

/** The five wizard steps. Fields carry `step` matching one of these ids. */
export const SUBMIT_STEPS = [
  { id: 1, key: 'search', title: 'Check it exists', description: 'Search the catalogue first so we do not create a duplicate.' },
  { id: 2, key: 'essentials', title: 'Essentials', description: 'The few things we cannot publish without.' },
  { id: 3, key: 'details', title: 'Details', description: 'Everything else you know. All optional.' },
  { id: 4, key: 'links', title: 'Links and image', description: 'Where to watch or follow, plus a picture.' },
  { id: 5, key: 'review', title: 'Review', description: 'Check it over before sending it to our editors.' },
];

/**
 * NFVCB classification symbols, in order of restriction.
 * Source: supabase/migrations/20260802020000_nfvcb_official_ratings.sql and
 * src/pages/Classification.jsx. 'PG-13' is also still a valid enum value but is
 * a legacy MPAA import being remapped, so it is deliberately not offered here.
 */
export const NFVCB_RATING_OPTIONS = [
  { value: 'G', label: 'G — General, suitable for everyone' },
  { value: 'PG', label: 'PG — Parental guidance advised' },
  { value: '12', label: '12 — 12 years and above only' },
  { value: '12A', label: '12A — 12+, or younger with an adult' },
  { value: '15', label: '15 — 15 years and above only' },
  { value: '18', label: '18 — Adults only' },
  { value: 'RE', label: 'RE — Restricted exhibition (licensed venues)' },
];

/** films.release_type — the CHECK list from 20260426212100_fix_films_schema_and_rpc.sql. */
export const RELEASE_TYPE_OPTIONS = [
  { value: 'cinema', label: 'Cinema' },
  { value: 'youtube', label: 'YouTube (free)' },
  { value: 'youtube_premium', label: 'YouTube (paid / members)' },
  { value: 'netflix', label: 'Netflix' },
  { value: 'prime_video', label: 'Prime Video' },
  { value: 'showmax', label: 'Showmax' },
  { value: 'apple_tv', label: 'Apple TV' },
  { value: 'disney_plus', label: 'Disney+' },
  { value: 'hulu', label: 'Hulu' },
  { value: 'irokotv', label: 'IrokoTV' },
  { value: 'kava', label: 'Kava' },
  { value: 'unreleased', label: 'Not released yet' },
];

/** films.content_type — the CHECK list from 20260616000000_add_content_type_and_series_fields.sql. */
export const CONTENT_TYPE_OPTIONS = [
  { value: 'movie', label: 'Movie' },
  { value: 'series', label: 'Series' },
  { value: 'mini_series', label: 'Mini-series' },
  { value: 'documentary', label: 'Documentary' },
];

/**
 * Genre vocabulary, taken from the `genres` table. The table also holds a
 * handful of channel-playlist names ("Movies", "Series", "Owambe Party") and a
 * duplicate ("Epics"); those are left out so submitters are not offered them.
 * A renderer that can reach the database should prefer the live list — see
 * `optionsSource` on the field — and fall back to this.
 */
export const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Epic', 'Faith', 'Family', 'Fantasy', 'Horror',
  'Juju & Supernatural', 'Melodrama', 'Musical', 'Mystery', 'Romance',
  'RomCom', 'Sci-Fi', 'Social Issue', 'Thriller', 'Urban',
].map((name) => ({ value: name, label: name }));

/** people.gender — free text in the database; these are the values already in use. */
export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

/** people.known_for_department — free text; the departments already in the table. */
export const DEPARTMENT_OPTIONS = [
  'Actor', 'Director', 'Producer', 'Executive producer', 'Writer',
  'Cinematographer', 'Editor', 'Composer', 'Production designer',
  'Art director', 'Costume designer', 'Makeup artist', 'Sound recordist',
  'Gaffer', 'Production manager', 'Location manager', 'VFX', 'Crew',
].map((name) => ({ value: name, label: name }));

/** channels.category — free text; the categories already in the table. */
export const CHANNEL_CATEGORY_OPTIONS = [
  { value: 'Movies', label: 'Movies' },
  { value: 'Series', label: 'Series' },
  { value: 'Studio', label: 'Studio / production company' },
  { value: 'Network', label: 'TV network' },
  { value: 'Celebrity', label: 'Celebrity / personality' },
  { value: 'Comedy', label: 'Comedy / skits' },
  { value: 'Music', label: 'Music' },
  { value: 'Faith', label: 'Faith' },
];

/** The countries the catalogue currently covers. */
export const COUNTRY_OPTIONS = [
  'Nigeria', 'Ghana', 'Cameroon', 'Kenya', 'South Africa', 'Tanzania',
  'Uganda', 'Ivory Coast', 'Senegal', 'Rwanda', 'Zimbabwe', 'Ethiopia',
].map((name) => ({ value: name, label: name }));

/** A brand-new film. Payload keys map 1:1 onto `films` columns. */
export const FILM_SUBMIT_FIELDS = [
  {
    key: 'title', label: 'Title', kind: 'text', step: 2, required: true, identity: true,
    placeholder: 'e.g. The Black Book',
    help: 'The title as it appears on screen — no channel name or "FULL MOVIE".',
  },
  {
    key: 'content_type', label: 'Type', kind: 'select', step: 2, required: true,
    options: CONTENT_TYPE_OPTIONS, defaultValue: 'movie',
  },
  {
    key: 'year', label: 'Year', kind: 'number', step: 2, required: true,
    placeholder: 'e.g. 2024', min: 1900, max: 2100,
    help: 'The year it was first released.',
  },
  {
    key: 'release_type', label: 'Where it was released', kind: 'select', step: 2, required: true,
    options: RELEASE_TYPE_OPTIONS,
    help: 'Where it first came out. You can add the watch link on the next step.',
  },
  {
    key: 'synopsis', label: 'Synopsis', kind: 'textarea', step: 3, rows: 5,
    placeholder: 'What happens in the film?',
    help: 'The story only — no cast lists, hashtags or "subscribe" text.',
  },
  {
    key: 'genres', label: 'Genres', kind: 'multiselect', step: 3,
    options: GENRE_OPTIONS, optionsSource: { table: 'genres', column: 'name' },
    help: 'Pick up to three.',
  },
  {
    key: 'runtime_minutes', label: 'Runtime (minutes)', kind: 'number', step: 3,
    placeholder: 'e.g. 118', min: 1, max: 1000,
  },
  {
    key: 'language', label: 'Language', kind: 'text', step: 3,
    placeholder: 'e.g. Yoruba, English',
    help: 'The main language spoken.',
  },
  {
    key: 'countries', label: 'Countries', kind: 'multiselect', step: 3,
    options: COUNTRY_OPTIONS,
    help: 'Where it was produced.',
  },
  {
    key: 'release_date', label: 'Release date', kind: 'date', step: 3,
    help: 'If you know the exact date as well as the year.',
  },
  {
    key: 'nfvcb_rating', label: 'NFVCB classification', kind: 'select', step: 3,
    options: NFVCB_RATING_OPTIONS,
    help: 'Only if you have seen the official certificate. Leave blank if unsure.',
  },
  {
    key: 'youtube_watch_url', label: 'Watch link', kind: 'url', step: 4,
    placeholder: 'https://youtube.com/watch?v=…',
    help: 'A legitimate link only — official channel or streaming service.',
  },
  {
    key: 'trailer_youtube_id', label: 'Trailer YouTube ID', kind: 'text', step: 4,
    placeholder: 'e.g. dQw4w9WgXcQ',
    help: 'Just the id from the trailer URL, not the whole link.',
  },
  {
    key: 'poster', label: 'Poster', kind: 'image', step: 4,
    help: 'PNG, JPEG or WebP · max 5 MB. Official artwork, portrait shape.',
  },
];

/** A brand-new person. Payload keys map 1:1 onto `people` columns, bar `films`. */
export const PERSON_SUBMIT_FIELDS = [
  {
    key: 'name', label: 'Full name', kind: 'text', step: 2, required: true, identity: true,
    placeholder: 'e.g. Genevieve Nnaji',
    help: 'Their professional name, spelled as they spell it.',
  },
  {
    key: 'known_for_department', label: 'Known for', kind: 'select', step: 2, required: true,
    options: DEPARTMENT_OPTIONS,
    help: 'What they are mainly credited as.',
  },
  { key: 'gender', label: 'Gender', kind: 'select', step: 2, options: GENDER_OPTIONS },
  {
    key: 'bio', label: 'Short bio', kind: 'textarea', step: 3, rows: 5,
    placeholder: 'A few sentences about their career',
  },
  {
    key: 'films', label: "Films they've worked on", kind: 'textarea', step: 3, rows: 3,
    placeholder: 'One title per line, or comma-separated',
    help: 'Free text — an editor links these to the catalogue by hand.',
  },
  { key: 'date_of_birth', label: 'Date of birth', kind: 'date', step: 3 },
  { key: 'birthplace', label: 'Birthplace', kind: 'text', step: 3, placeholder: 'City, country' },
  { key: 'nationality', label: 'Nationality', kind: 'text', step: 3, placeholder: 'e.g. Nigerian' },
  {
    key: 'instagram_url', label: 'Instagram', kind: 'url', step: 4,
    placeholder: 'https://instagram.com/…',
    help: 'At least one social link helps us confirm this is a real person.',
  },
  { key: 'twitter_url', label: 'X / Twitter', kind: 'url', step: 4, placeholder: 'https://x.com/…' },
  { key: 'tiktok_url', label: 'TikTok', kind: 'url', step: 4, placeholder: 'https://tiktok.com/@…' },
  { key: 'facebook_url', label: 'Facebook', kind: 'url', step: 4, placeholder: 'https://facebook.com/…' },
  { key: 'youtube_handle', label: 'YouTube handle', kind: 'text', step: 4, placeholder: '@channel' },
  {
    key: 'photo', label: 'Photo', kind: 'image', step: 4,
    help: 'PNG, JPEG or WebP · max 5 MB. A clear head-and-shoulders shot.',
  },
];

/** A brand-new channel. Payload keys map 1:1 onto `channels` columns. */
export const CHANNEL_SUBMIT_FIELDS = [
  {
    key: 'name', label: 'Channel name', kind: 'text', step: 2, required: true, identity: true,
    placeholder: 'e.g. Nollywood Picturehouse',
    help: 'As it appears on the channel page.',
  },
  {
    key: 'channel_url', label: 'Channel URL', kind: 'url', step: 2, required: true,
    placeholder: 'https://youtube.com/@channel',
    help: 'The link to the channel itself, not to one of its videos.',
  },
  {
    key: 'description', label: 'What they post', kind: 'textarea', step: 3, rows: 4,
    placeholder: 'e.g. Full-length Yoruba dramas, uploaded weekly',
  },
  { key: 'category', label: 'Category', kind: 'select', step: 3, options: CHANNEL_CATEGORY_OPTIONS },
  { key: 'country', label: 'Country', kind: 'select', step: 3, options: COUNTRY_OPTIONS },
  {
    key: 'owner_name', label: 'Who runs it', kind: 'text', step: 3,
    placeholder: 'Person or production company',
  },
  {
    key: 'channel_handle', label: 'Handle', kind: 'text', step: 4,
    placeholder: '@channel',
    help: 'The @handle, if the channel has one.',
  },
  {
    key: 'thumbnail', label: 'Channel avatar', kind: 'image', step: 4,
    help: 'PNG, JPEG or WebP · max 5 MB.',
  },
];

/**
 * Everything the wizard and the admin queue need to know about a submission
 * kind, keyed by the `:kind` URL segment. `duplicateCheck` drives step 1.
 */
export const SUBMIT_KINDS = {
  film: {
    kind: 'film',
    type: CONTRIBUTION_TYPES.NEW_FILM,
    target_table: 'films',
    label: 'Film',
    title: 'Add a film',
    subtitle: 'A Nigerian, Ghanaian or wider African film we are missing.',
    icon: 'solar:clapperboard-play-bold',
    fields: FILM_SUBMIT_FIELDS,
    identityKey: 'title',
    imageKeys: ['poster'],
    duplicateCheck: { table: 'films', column: 'title', select: 'id, slug, title, year, poster_url' },
  },
  person: {
    kind: 'person',
    type: CONTRIBUTION_TYPES.NEW_PERSON,
    target_table: 'people',
    label: 'Person',
    title: 'Add a person',
    subtitle: 'An actor, director or crew member who is not in the database.',
    icon: 'solar:user-plus-bold',
    fields: PERSON_SUBMIT_FIELDS,
    identityKey: 'name',
    imageKeys: ['photo'],
    duplicateCheck: { table: 'people', column: 'name', select: 'id, slug, name, known_for_department, photo_url' },
  },
  channel: {
    kind: 'channel',
    type: CONTRIBUTION_TYPES.NEW_CHANNEL,
    target_table: 'channels',
    label: 'Channel',
    title: 'Add a channel',
    subtitle: 'A YouTube channel publishing African films we should be tracking.',
    icon: 'solar:videocamera-record-bold',
    fields: CHANNEL_SUBMIT_FIELDS,
    identityKey: 'name',
    imageKeys: ['thumbnail'],
    duplicateCheck: { table: 'channels', column: 'name', select: 'id, slug, name, channel_url, thumbnail_url' },
  },
};

/** Field list for a submission kind ('film' | 'person' | 'channel'). */
export function submitFieldsFor(kind) {
  return SUBMIT_KINDS[kind]?.fields || [];
}

/** The fields of one wizard step, in declaration order. */
export function submitFieldsForStep(kind, step) {
  return submitFieldsFor(kind).filter((f) => f.step === step);
}

/** A blank value map for a kind, seeded with any `defaultValue`s. */
export function emptySubmission(kind) {
  const out = {};
  for (const f of submitFieldsFor(kind)) {
    if (f.kind === 'image') continue;
    out[f.key] = f.defaultValue ?? (f.kind === 'multiselect' ? [] : '');
  }
  return out;
}

/**
 * Check the required fields are filled.
 * Returns { ok, missing } where `missing` is the offending field definitions,
 * so a caller can name them ("Title and Year are required").
 */
export function validateSubmission(kind, values = {}) {
  const missing = submitFieldsFor(kind).filter((f) => {
    if (!f.required) return false;
    const v = values[f.key];
    if (Array.isArray(v)) return v.length === 0;
    return v == null || String(v).trim() === '';
  });
  return { ok: missing.length === 0, missing };
}

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

/** Drop empty strings / nulls / empty arrays from a fields map. */
export function compactFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
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
 * Submit a brand-new record from one of the *_SUBMIT_FIELDS schemas.
 *
 * `kind` is 'film' | 'person' | 'channel'. `fields` is a value map keyed by
 * field `key`; it is written to the payload flat (not nested under `fields`),
 * matching how the admin queue already reads new_person submissions, so every
 * key is individually tickable on review.
 *
 * Returns { ok, error }.
 */
export function submitNewRecord({ kind, fields, image_path, note }) {
  const spec = SUBMIT_KINDS[kind];
  if (!spec) return Promise.resolve({ ok: false, error: new Error(`Unknown submission kind: ${kind}`) });

  const { ok, missing } = validateSubmission(kind, fields);
  if (!ok) {
    const names = missing.map((f) => f.label).join(', ');
    return Promise.resolve({ ok: false, error: new Error(`${names} ${missing.length > 1 ? 'are' : 'is'} required.`) });
  }

  // Image fields live on image_path, not in the payload.
  const values = { ...fields };
  for (const k of spec.imageKeys || []) delete values[k];

  return submit({
    type: spec.type,
    target_table: spec.target_table,
    payload: compactFields(values),
    image_path,
    note,
  });
}

/** Submit a brand-new film. `fields` follows FILM_SUBMIT_FIELDS. */
export function submitNewFilm({ fields, image_path, note }) {
  return submitNewRecord({ kind: 'film', fields, image_path, note });
}

/** Submit a brand-new channel. `fields` follows CHANNEL_SUBMIT_FIELDS. */
export function submitNewChannel({ fields, image_path, note }) {
  return submitNewRecord({ kind: 'channel', fields, image_path, note });
}

/**
 * Submit a brand-new person from PERSON_SUBMIT_FIELDS.
 * The older `suggestNewPerson` above stays for the cramped single-screen modal,
 * which sends a different, smaller payload shape.
 */
export function submitNewPerson({ fields, image_path, note }) {
  return submitNewRecord({ kind: 'person', fields, image_path, note });
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
