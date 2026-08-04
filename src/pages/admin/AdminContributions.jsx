import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import {
  CONTRIBUTION_LABELS,
  PERSON_EDIT_FIELDS,
  FILM_EDIT_FIELDS,
  SUBMIT_KINDS,
  GENDER_OPTIONS,
  NFVCB_RATING_OPTIONS,
  RELEASE_TYPE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
} from '../../lib/contributions';
import { signedContributionUrl, publishContributionImage, deleteContributionImage } from '../../lib/imageUpload';

// Map a single submitted social URL to the right people.* column.
function socialField(url = '') {
  const s = url.toLowerCase();
  if (/instagram/.test(s)) return 'instagram_url';
  if (/twitter|x\.com/.test(s)) return 'twitter_url';
  if (/facebook|fb\.com/.test(s)) return 'facebook_url';
  if (/tiktok/.test(s)) return 'tiktok_url';
  return 'instagram_url';
}

const TYPE_STYLE = {
  new_person: { icon: 'solar:user-plus-bold', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  new_film: { icon: 'solar:clapperboard-play-bold', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  new_channel: { icon: 'solar:videocamera-record-bold', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  edit_person: { icon: 'solar:pen-2-bold', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  edit_film: { icon: 'solar:pen-2-bold', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  report_link: { icon: 'solar:flag-bold', color: 'text-red-500', bg: 'bg-red-500/10' },
  report_channel: { icon: 'solar:flag-bold', color: 'text-red-500', bg: 'bg-red-500/10' },
};

/** Types whose payload is a flat map that creates a brand-new record. */
const CREATE_TYPES = new Set(['new_person', 'new_film', 'new_channel']);
/** Types whose payload nests the proposal under `fields`. */
const EDIT_TYPES = new Set(['edit_person', 'edit_film']);

// The field definitions behind each contribution type. These are the very same
// arrays the public forms are rendered from, so a review row gets the real
// label, control kind and option list for free and can never drift from the
// form. Nothing here restates a field list.
const SCHEMA_FIELDS = {
  new_film: SUBMIT_KINDS.film.fields,
  new_person: SUBMIT_KINDS.person.fields,
  new_channel: SUBMIT_KINDS.channel.fields,
  edit_person: PERSON_EDIT_FIELDS,
  edit_film: FILM_EDIT_FIELDS,
};

// Keys the older single-screen "suggest a person" modal still sends. They are
// deliberately not in PERSON_SUBMIT_FIELDS, so they need their own definitions.
const LEGACY_FIELD_DEFS = {
  social_link: { key: 'social_link', label: 'Social link', kind: 'url' },
  sex: { key: 'sex', label: 'Gender', kind: 'select', options: GENDER_OPTIONS },
};

const FIELD_INDEX = Object.fromEntries(
  Object.entries(SCHEMA_FIELDS).map(([type, fields]) => [
    type,
    Object.fromEntries(fields.map((f) => [f.key, f])),
  ])
);

function fieldDef(type, key) {
  return (
    FIELD_INDEX[type]?.[key] ||
    LEGACY_FIELD_DEFS[key] || { key, label: key.replace(/_/g, ' '), kind: 'text' }
  );
}

function imageLabel(type) {
  if (type === 'new_film' || type === 'edit_film') return 'Poster';
  if (type === 'new_channel') return 'Channel avatar';
  return 'Photo';
}

/** Does this value carry anything worth writing? */
function hasValue(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

/** Normalise a submitted list — an array or a comma/newline string — to names. */
function toStringArray(v) {
  const list = Array.isArray(v) ? v : String(v ?? '').split(/[,;\n]/);
  const out = [];
  for (const raw of list) {
    const s = String(raw ?? '').trim();
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = toStringArray(a);
    const y = toStringArray(b);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}

function displayValue(v) {
  return Array.isArray(v) ? v.join(', ') : String(v ?? '');
}

/** Proposed structured fields + whether an image was attached. */
function proposedParts(item) {
  const p = item.payload || {};
  const fields = { ...(p.fields || {}) };
  // Legacy free-text only
  const legacyNote = p.changes || p.note || item.note || null;
  const hasImage = !!item.image_path;
  return { fields, legacyNote, hasImage, isStructured: Object.keys(fields).length > 0 || hasImage };
}

/**
 * The proposed values for a contribution, as [key, value] pairs in the order
 * the public form declares them (unrecognised keys keep their payload order and
 * go last). Create types put every value at the top level of the payload; edit
 * types nest them under `fields`.
 */
function proposedEntries(item) {
  const source = CREATE_TYPES.has(item.type) ? item.payload || {} : proposedParts(item).fields;
  const order = (SCHEMA_FIELDS[item.type] || []).map((f) => f.key);
  return Object.keys(source)
    .filter((k) => hasValue(source[k]))
    .sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    })
    .map((k) => [k, source[k]]);
}

function defaultSelection(item) {
  const sel = {};
  for (const [k] of proposedEntries(item)) sel[k] = true;
  if (item.image_path) sel.__image = true;
  return sel;
}

/** The value to apply for one key: whatever the admin typed, else what was sent. */
function currentValue(editRow, key, original) {
  return editRow && Object.prototype.hasOwnProperty.call(editRow, key) ? editRow[key] : original;
}

/**
 * The ticked fields, with any admin edit swapped in, plus the keys that were
 * actually changed (so the approval note can name them).
 */
function pickValues(item, sel, editRow) {
  const picked = {};
  const edited = [];
  for (const [k, original] of proposedEntries(item)) {
    if (!sel[k]) continue;
    const v = currentValue(editRow, k, original);
    if (!hasValue(v)) continue;
    picked[k] = v;
    if (!sameValue(v, original)) edited.push(k);
  }
  return { picked, edited };
}

// Which payload keys are real columns on the target table. Both are derived
// from the same schemas the forms render, so adding a field to a form is enough
// — but a key that is not a column is reported rather than sent, because
// PostgREST would reject the whole insert.
const FILM_COLUMN_KEYS = new Set(
  [...SUBMIT_KINDS.film.fields, ...FILM_EDIT_FIELDS]
    .filter((f) => f.kind !== 'image')
    .map((f) => f.key)
);
// `bio` and `films` are excluded: the person branch merges them into one bio.
const PERSON_COLUMN_KEYS = new Set(
  [...SUBMIT_KINDS.person.fields, ...PERSON_EDIT_FIELDS]
    .filter((f) => f.kind !== 'image' && f.key !== 'bio' && f.key !== 'films')
    .map((f) => f.key)
);

const FILM_INT_FIELDS = new Set(['year', 'runtime_minutes']);
const FILM_ARRAY_FIELDS = new Set(['countries', 'languages', 'genres']);
// Columns the database constrains to a fixed vocabulary. Anything outside these
// sets is dropped rather than written — the insert would be rejected otherwise.
const FILM_ENUM_FIELDS = {
  nfvcb_rating: NFVCB_RATING_OPTIONS,
  release_type: RELEASE_TYPE_OPTIONS,
  content_type: CONTENT_TYPE_OPTIONS,
};

/**
 * Coerce proposed film values into what the `films` columns expect.
 * Returns the usable subset plus the keys that had to be dropped, so the
 * approval can say what it could not apply instead of silently losing it.
 */
function coerceFilmUpdate(fields) {
  const update = {};
  const skipped = [];
  for (const [k, v] of Object.entries(fields)) {
    if (FILM_INT_FIELDS.has(k)) {
      const n = Number(v);
      if (!Number.isFinite(n)) { skipped.push(k); continue; }
      update[k] = Math.round(n);
    } else if (FILM_ARRAY_FIELDS.has(k)) {
      const arr = toStringArray(v);
      if (!arr.length) { skipped.push(k); continue; }
      update[k] = arr;
    } else if (FILM_ENUM_FIELDS[k]) {
      const allowed = FILM_ENUM_FIELDS[k].map((o) => o.value);
      const match = allowed.find((o) => o.toLowerCase() === String(v).trim().toLowerCase());
      if (!match) { skipped.push(k); continue; }
      update[k] = match;
    } else if (typeof v === 'string') {
      const t = v.trim();
      if (!t) { skipped.push(k); continue; }
      update[k] = t;
    } else {
      update[k] = v;
    }
  }
  return { update, skipped };
}

/**
 * Resolve submitted genre names against the `genres` table, case-insensitively,
 * so approving never mints a duplicate genre row. Names with no match are
 * returned as `unmatched` and simply left out — a genre we do not recognise is
 * not worth failing an otherwise good film on.
 */
async function resolveGenres(names) {
  const wanted = toStringArray(names);
  if (!wanted.length) return { ids: [], matched: [], unmatched: [] };

  const { data, error } = await supabase.from('genres').select('id, name');
  if (error || !data) return { ids: [], matched: [], unmatched: wanted };

  const byName = new Map(data.map((g) => [String(g.name).trim().toLowerCase(), g]));
  const ids = [];
  const matched = [];
  const unmatched = [];
  for (const name of wanted) {
    const hit = byName.get(name.toLowerCase());
    if (!hit) { unmatched.push(name); continue; }
    if (ids.includes(hit.id)) continue;
    ids.push(hit.id);
    matched.push(hit.name); // the canonical spelling, not the submitted one
  }
  return { ids, matched, unmatched };
}

const CHANNEL_INSERT_KEYS = [
  'name', 'channel_id', 'channel_handle', 'channel_url', 'description',
  'category', 'country', 'owner_name',
];

/**
 * Pull the UC… id and @handle out of a YouTube channel URL. The public form
 * asks for neither, but the sync job keys off `channel_id`, so it is worth
 * recovering when the submitted URL happens to contain it.
 */
function youtubeChannelParts(url = '') {
  const s = String(url || '').trim();
  const id = s.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i);
  const handle = s.match(/youtube\.com\/@([\w.-]+)/i);
  return { channel_id: id ? id[1] : null, channel_handle: handle ? `@${handle[1]}` : null };
}

// --- Inline editing -------------------------------------------------------

const inputCls =
  'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-brand outline-none transition-colors';

/**
 * The declared options for a field, plus the current value if it is not among
 * them — a submitted value must never disappear just because the vocabulary
 * has moved on since.
 */
function optionList(def, value) {
  const opts = def.options || [];
  const extras = toStringArray(value)
    .filter((v) => !opts.some((o) => String(o.value).toLowerCase() === v.toLowerCase()))
    .map((v) => ({ value: v, label: `${v} (as submitted)` }));
  return [...opts, ...extras];
}

/** The right control for a field's `kind`, bound to the admin's working value. */
function FieldEditor({ def, value, onChange }) {
  const kind = def.kind || 'text';

  if (kind === 'textarea') {
    return (
      <textarea
        rows={def.rows || 3}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} resize-y leading-relaxed`}
      />
    );
  }

  if (kind === 'select') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">— not set —</option>
        {optionList(def, value).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (kind === 'multiselect') {
    const selected = toStringArray(value);
    const isOn = (v) => selected.some((s) => s.toLowerCase() === String(v).toLowerCase());
    return (
      <div className="flex flex-wrap gap-1.5">
        {optionList(def, value).map((o) => {
          const on = isOn(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() =>
                onChange(
                  on
                    ? selected.filter((s) => s.toLowerCase() !== String(o.value).toLowerCase())
                    : [...selected, o.value]
                )
              }
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                on
                  ? 'bg-brand/15 border-brand/40 text-brand'
                  : 'bg-surface border-border text-text-muted hover:text-text-primary'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (kind === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        min={def.min}
        max={def.max}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    );
  }

  if (kind === 'date') {
    return (
      <input
        type="date"
        value={String(value ?? '').slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    );
  }

  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
      spellCheck={kind !== 'url'}
    />
  );
}

/** One review row: tick it to apply, and correct it in place before you do. */
function ReviewField({ def, original, value, selected, onToggle, onChange, onRevert }) {
  const edited = !sameValue(value, original);
  const wide = def.kind === 'textarea' || def.kind === 'multiselect';

  return (
    <div
      className={`rounded-xl p-3 border transition-colors ${wide ? 'sm:col-span-2' : ''} ${
        edited ? 'bg-surface-2 border-brand/40' : 'bg-surface-2 border-transparent'
      } ${selected ? '' : 'opacity-50'}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="flex items-center gap-2 cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="accent-[var(--color-brand,#e11d48)]"
          />
          <span className="text-text-muted text-[10px] font-bold uppercase tracking-wide truncate">
            {def.label}
          </span>
        </label>
        {edited && (
          <button
            type="button"
            onClick={onRevert}
            title={`Submitted: ${displayValue(original)}`}
            className="shrink-0 inline-flex items-center gap-1 text-brand text-[9px] font-bold uppercase tracking-wide hover:underline"
          >
            <Icon icon="solar:pen-2-bold" width="10" />
            Edited · revert
          </button>
        )}
      </div>
      <FieldEditor def={def} value={value} onChange={onChange} />
      {edited && (
        <p className="text-text-muted text-[10px] mt-1.5 truncate" title={displayValue(original)}>
          Submitted: {displayValue(original) || '—'}
        </p>
      )}
    </div>
  );
}

export default function AdminContributions() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [signedUrls, setSignedUrls] = useState({}); // contribution id -> preview URL
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selection, setSelection] = useState({}); // id -> { fieldKey: bool }
  // Admin corrections, keyed contribution id -> payload key. A key is only
  // present once it has been touched; everything else falls back to the payload.
  const [edits, setEdits] = useState({});

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contributions')
        .select('*, users:submitted_by (name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);

      const sel = {};
      for (const d of data || []) sel[d.id] = defaultSelection(d);
      setSelection(sel);
      setEdits({});

      const withImg = (data || []).filter((d) => d.image_path);
      const entries = await Promise.all(
        withImg.map(async (d) => [d.id, await signedContributionUrl(d.image_path)])
      );
      setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    } catch (e) {
      console.error('Error fetching contributions:', e);
      toast.error('Failed to load the queue');
    } finally {
      setIsLoading(false);
    }
  };

  const markReviewed = async (item, status, extraNote) => {
    const note =
      status === 'rejected'
        ? (rejectReason || item.note)
        : (extraNote || item.note);
    const { error } = await supabase
      .from('contributions')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        note,
      })
      .eq('id', item.id);
    if (error) throw error;
  };

  const toggleField = (itemId, key) => {
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [key]: !prev[itemId]?.[key] },
    }));
  };

  const setAllFields = (itemId, value, keys) => {
    setSelection((prev) => {
      const next = { ...prev[itemId] };
      for (const k of keys) next[k] = value;
      return { ...prev, [itemId]: next };
    });
  };

  const setFieldValue = (itemId, key, value) => {
    setEdits((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [key]: value } }));
  };

  const revertField = (itemId, key) => {
    setEdits((prev) => {
      const row = { ...(prev[itemId] || {}) };
      delete row[key];
      return { ...prev, [itemId]: row };
    });
  };

  const handleApprove = async (item) => {
    setBusyId(item.id);
    try {
      const sel = selection[item.id] || {};
      const editRow = edits[item.id];
      let appliedSummary = '';
      let editedKeys = [];
      const notes = [];

      if (item.type === 'new_person') {
        const { picked, edited } = pickValues(item, sel, editRow);
        editedKeys = edited;
        if (!hasValue(picked.name)) throw new Error('Name must be selected to create a person.');

        const insert = { source: 'community', needs_review: true };
        const unusable = [];
        for (const [k, v] of Object.entries(picked)) {
          const value = typeof v === 'string' ? v.trim() : v;
          if (PERSON_COLUMN_KEYS.has(k)) insert[k] = value;
          else if (k === 'sex') insert.gender = value;              // legacy modal key
          else if (k === 'social_link') insert[socialField(String(value))] = value;
          else if (k === 'bio' || k === 'films') continue;          // folded into bio below
          else unusable.push(k);
        }

        // `films` is free text the contributor typed; there is nothing to link
        // it to yet, so it rides along in the bio for an editor to work from.
        const bioBits = [];
        if (hasValue(picked.bio)) bioBits.push(String(picked.bio).trim());
        if (hasValue(picked.films)) bioBits.push(`Filmography (community-submitted): ${String(picked.films).trim()}`);
        if (bioBits.length) insert.bio = bioBits.join('\n\n');

        if (sel.__image && item.image_path) {
          const url = await publishContributionImage(item.image_path, 'people');
          if (!url) throw new Error('Could not publish the uploaded image.');
          insert.photo_url = url;
        }

        const { error: insErr } = await supabase.from('people').insert(insert);
        if (insErr) throw insErr;
        appliedSummary = `Created person with: ${Object.keys(insert).join(', ')}`;
        if (unusable.length) notes.push(`no column for: ${unusable.join(', ')}`);
      } else if (item.type === 'new_film') {
        const { picked, edited } = pickValues(item, sel, editRow);
        editedKeys = edited;
        if (!hasValue(picked.title)) throw new Error('Title must be selected to create a film.');

        const unusable = [];
        const usable = {};
        for (const [k, v] of Object.entries(picked)) {
          if (FILM_COLUMN_KEYS.has(k)) usable[k] = v;
          else unusable.push(k);
        }

        const { update, skipped } = coerceFilmUpdate(usable);

        // Genres go in twice: the normalised join rows, and the legacy
        // films.genres array that parts of the UI still fall back to.
        const { ids: genreIds, matched, unmatched } = await resolveGenres(update.genres);
        delete update.genres;
        if (matched.length) update.genres = matched;

        const insert = { ...update, source: 'community', needs_review: true };
        if (sel.__image && item.image_path) {
          const url = await publishContributionImage(item.image_path, 'posters');
          if (!url) throw new Error('Could not publish the uploaded image.');
          insert.poster_url = url;
        }

        const { data: created, error: insErr } = await supabase
          .from('films')
          .insert(insert)
          .select('id')
          .single();
        if (insErr) throw insErr;

        if (genreIds.length) {
          const { error: gErr } = await supabase
            .from('film_genres')
            .insert(genreIds.map((genre_id) => ({ film_id: created.id, genre_id })));
          // The film exists by now; a failed join write is worth flagging but
          // not worth rolling the whole approval back over.
          if (gErr) {
            console.error('film_genres insert failed:', gErr);
            notes.push('genre links failed — set them in Admin › Films');
          }
        }

        appliedSummary = `Created film with: ${Object.keys(insert).join(', ')}`;
        if (unmatched.length) notes.push(`unknown genres skipped: ${unmatched.join(', ')}`);
        if (skipped.length) notes.push(`not applied (bad value): ${skipped.join(', ')}`);
        if (unusable.length) notes.push(`no column for: ${unusable.join(', ')}`);
      } else if (item.type === 'new_channel') {
        const { picked, edited } = pickValues(item, sel, editRow);
        editedKeys = edited;
        if (!hasValue(picked.name)) throw new Error('Name must be selected to create a channel.');

        const insert = {};
        const unusable = [];
        for (const [k, v] of Object.entries(picked)) {
          if (!CHANNEL_INSERT_KEYS.includes(k)) { unusable.push(k); continue; }
          insert[k] = typeof v === 'string' ? v.trim() : v;
        }

        // The form asks for a URL, not an id — recover the id/handle from it so
        // the channel is syncable without a second pass through Admin › Channels.
        const derived = youtubeChannelParts(insert.channel_url);
        if (!insert.channel_id && derived.channel_id) insert.channel_id = derived.channel_id;
        if (!insert.channel_handle && derived.channel_handle) insert.channel_handle = derived.channel_handle;

        if (sel.__image && item.image_path) {
          const url = await publishContributionImage(item.image_path, 'channels');
          if (!url) throw new Error('Could not publish the uploaded image.');
          insert.thumbnail_url = url;
        }

        const { error: insErr } = await supabase.from('channels').insert(insert);
        if (insErr) throw insErr;
        appliedSummary = `Created channel with: ${Object.keys(insert).join(', ')}`;
        if (unusable.length) notes.push(`no column for: ${unusable.join(', ')}`);
      } else if (item.type === 'edit_person' || item.type === 'edit_film') {
        const { hasImage, legacyNote, isStructured } = proposedParts(item);

        if (!isStructured && legacyNote) {
          // Legacy free-text: acknowledge only — nothing safe to auto-apply.
          await markReviewed(item, 'approved', `Legacy free-text (manual apply): ${legacyNote}`);
          if (item.image_path) await deleteContributionImage(item.image_path);
          toast.success('Approved (apply free-text manually via View record)');
          setItems((prev) => prev.filter((x) => x.id !== item.id));
          return;
        }

        if (!item.target_id) throw new Error('Missing target record.');

        const { picked, edited } = pickValues(item, sel, editRow);
        editedKeys = edited;
        const wantImage = !!(sel.__image && hasImage);

        if (!Object.keys(picked).length && !wantImage) {
          toast.error('Select at least one field (or the image) to apply.');
          return;
        }

        let update;
        if (item.type === 'edit_film') {
          const coerced = coerceFilmUpdate(picked);
          update = coerced.update;
          if (coerced.skipped.length) notes.push(`not applied (bad value): ${coerced.skipped.join(', ')}`);
        } else {
          update = { ...picked };
        }

        if (wantImage) {
          const folder = item.type === 'edit_film' ? 'posters' : 'people';
          const url = await publishContributionImage(item.image_path, folder);
          if (!url) throw new Error('Could not publish the uploaded image.');
          if (item.type === 'edit_film') update.poster_url = url;
          else update.photo_url = url;
        }

        if (!Object.keys(update).length) throw new Error('Nothing left to apply after validation.');

        const table = item.type === 'edit_film' ? 'films' : 'people';
        const { error: upErr } = await supabase.from(table).update(update).eq('id', item.target_id);
        if (upErr) throw upErr;

        appliedSummary = `Applied: ${Object.keys(update).join(', ')}`;
      } else {
        // Reports — acknowledgement only
        appliedSummary = 'Report acknowledged';
      }

      if (editedKeys.length) {
        notes.unshift(`admin corrected: ${editedKeys.map((k) => fieldDef(item.type, k).label).join(', ')}`);
      }
      const fullNote = [appliedSummary, ...notes].filter(Boolean).join(' · ');

      await markReviewed(item, 'approved', fullNote || item.note);
      // Delete quarantine image only if we published it OR admin didn't keep it
      // (always clean up after review).
      if (item.image_path) await deleteContributionImage(item.image_path);
      toast.success(
        CREATE_TYPES.has(item.type)
          ? `${CONTRIBUTION_LABELS[item.type] || 'Record'} created ✓`
          : EDIT_TYPES.has(item.type)
            ? 'Selected fields applied ✓'
            : 'Approved'
      );
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      console.error('Approve failed:', e);
      toast.error(e.message || 'Could not approve');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (item) => {
    setBusyId(item.id);
    try {
      await markReviewed(item, 'rejected');
      if (item.image_path) await deleteContributionImage(item.image_path);
      toast.success('Rejected');
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setRejectingId(null);
      setRejectReason('');
    } catch (e) {
      console.error('Reject failed:', e);
      toast.error('Could not reject');
    } finally {
      setBusyId(null);
    }
  };

  const recordLink = (item) => {
    // New-record submissions carry a target_table but no row to point at yet.
    if (!item.target_id) return null;
    if (item.target_table === 'films') return `/films/${item.target_id}`;
    if (item.target_table === 'people') return `/people/${item.target_id}`;
    if (item.target_table === 'channels' || item.target_table === 'youtube_channels') {
      return `/channels/${item.target_id}`;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 bg-surface-2 animate-pulse rounded-lg" />
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-surface-2 animate-pulse rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1">Review Queue</p>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Community Contributions</h1>
            <span className="bg-brand/10 text-brand px-3 py-1 rounded-xl text-xs font-bold border border-brand/20">
              {items.length} pending
            </span>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="card-cal flex flex-col items-center justify-center py-24 text-center border border-border rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-6">
            <Icon icon="solar:check-circle-bold" width="32" />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">Queue empty</h3>
          <p className="text-text-muted text-sm max-w-xs">No community submissions are waiting for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const style = TYPE_STYLE[item.type] || TYPE_STYLE.edit_film;
            const link = recordLink(item);
            const { legacyNote, hasImage, isStructured } = proposedParts(item);
            const sel = selection[item.id] || {};
            const editRow = edits[item.id];
            const isEdit = EDIT_TYPES.has(item.type);
            const isNew = CREATE_TYPES.has(item.type);
            const entries = proposedEntries(item);
            const selectableKeys = [...entries.map(([k]) => k), ...(hasImage ? ['__image'] : [])];
            const editedCount = entries.filter(
              ([k, original]) => !sameValue(currentValue(editRow, k, original), original)
            ).length;

            return (
              <div key={item.id} className="border border-border rounded-2xl p-6 bg-surface space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${style.bg} ${style.color}`}>
                      <Icon icon={style.icon} width="18" />
                    </span>
                    <div>
                      <p className="text-text-primary font-bold text-sm">{CONTRIBUTION_LABELS[item.type] || item.type}</p>
                      <p className="text-text-muted text-[11px]">
                        by {item.users?.name || item.users?.email || 'Unknown'} · {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {link && (
                    <Link to={link} target="_blank" rel="noopener noreferrer" className="text-brand text-xs font-bold hover:underline">
                      View record →
                    </Link>
                  )}
                </div>

                {/* Structured field picker — tick what to apply, fix it in place */}
                {(isEdit || isNew) && (isStructured || isNew) ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-text-muted text-[11px] font-bold uppercase tracking-wide">
                        Tick what to apply · edit any value before approving
                        {editedCount > 0 && (
                          <span className="text-brand ml-2">{editedCount} edited</span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAllFields(item.id, true, selectableKeys)}
                          className="text-[10px] font-bold text-brand hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllFields(item.id, false, selectableKeys)}
                          className="text-[10px] font-bold text-text-muted hover:underline"
                        >
                          Select none
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {hasImage && (
                        <div
                          className={`sm:col-span-2 flex items-start gap-3 bg-surface-2 rounded-xl p-3 border border-transparent ${
                            sel.__image ? '' : 'opacity-50'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!sel.__image}
                              onChange={() => toggleField(item.id, '__image')}
                              className="accent-[var(--color-brand,#e11d48)]"
                            />
                            <span className="text-text-muted text-[10px] font-bold uppercase tracking-wide">
                              {imageLabel(item.type)}
                            </span>
                          </label>
                          {signedUrls[item.id] && (
                            <a href={signedUrls[item.id]} target="_blank" rel="noopener noreferrer" className="ml-auto">
                              <img src={signedUrls[item.id]} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                            </a>
                          )}
                        </div>
                      )}

                      {entries.map(([k, original]) => (
                        <ReviewField
                          key={k}
                          def={fieldDef(item.type, k)}
                          original={original}
                          value={currentValue(editRow, k, original)}
                          selected={!!sel[k]}
                          onToggle={() => toggleField(item.id, k)}
                          onChange={(v) => setFieldValue(item.id, k, v)}
                          onRevert={() => revertField(item.id, k)}
                        />
                      ))}
                    </div>

                    {legacyNote && isEdit && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200">
                        <span className="font-bold">Note (not auto-applied): </span>
                        {legacyNote}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Legacy free-text or reports */
                  <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
                    <div className="bg-surface-2 rounded-xl p-4 text-sm space-y-1.5">
                      {Object.entries(item.payload || {}).map(([k, v]) =>
                        v ? (
                          <div key={k} className="flex gap-2">
                            <span className="text-text-muted font-bold capitalize min-w-[90px]">{k.replace(/_/g, ' ')}:</span>
                            <span className="text-text-primary whitespace-pre-wrap">{String(v)}</span>
                          </div>
                        ) : null
                      )}
                      {item.note && (
                        <div className="flex gap-2 pt-1 border-t border-border mt-2">
                          <span className="text-text-muted font-bold min-w-[90px]">Note:</span>
                          <span className="text-text-primary italic">{item.note}</span>
                        </div>
                      )}
                      {isEdit && !isStructured && (
                        <p className="text-amber-500 text-[11px] font-bold pt-2">
                          Legacy free-text submission — approve acknowledges only; apply manually via View record.
                        </p>
                      )}
                    </div>
                    {signedUrls[item.id] && (
                      <a href={signedUrls[item.id]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={signedUrls[item.id]} alt="" className="w-28 h-28 object-cover rounded-xl border border-border" />
                      </a>
                    )}
                  </div>
                )}

                {/* Actions */}
                {rejectingId === item.id ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="flex-1 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm focus:border-red-500 outline-none"
                    />
                    <button onClick={() => handleReject(item)} disabled={busyId === item.id}
                      className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-xs hover:bg-red-600 disabled:opacity-50">
                      Confirm reject
                    </button>
                    <button onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      className="text-text-muted font-bold px-3 text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(item)} disabled={busyId === item.id}
                      className="bg-brand text-white font-bold px-6 py-2.5 rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
                      {isNew
                        ? 'Approve & create'
                        : isEdit && isStructured
                          ? 'Apply selected'
                          : 'Approve'}
                    </button>
                    <button onClick={() => setRejectingId(item.id)} disabled={busyId === item.id}
                      className="border border-border bg-surface-2 text-text-muted font-bold px-6 py-2.5 rounded-lg text-xs hover:text-red-500 hover:border-red-500/30 disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
