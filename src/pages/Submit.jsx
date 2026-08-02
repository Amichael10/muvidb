import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadContributionImage } from '../lib/imageUpload';
import { useLocalStorageDraft } from '../hooks/useLocalStorageDraft';
import {
  SUBMIT_KINDS,
  SUBMIT_STEPS,
  emptySubmission,
  submitFieldsForStep,
  submitNewRecord,
  validateSubmission,
} from '../lib/contributions';

/**
 * The public submission wizard at /submit/:kind.
 *
 * One renderer for every submission kind: everything on screen comes out of
 * SUBMIT_KINDS[kind] and SUBMIT_STEPS in src/lib/contributions.js. Adding a
 * field to a schema adds it to the right step here with no change to this file.
 */

const LAST_STEP = SUBMIT_STEPS[SUBMIT_STEPS.length - 1].id;

/**
 * Where an existing record lives on the public site. This is the one thing step
 * 1 needs that the schema does not carry — `duplicateCheck` names the table and
 * the columns to read, but not the route the record is published at.
 */
const RECORD_PATH = { film: '/films', person: '/people', channel: '/channels' };

/** Columns in a `duplicateCheck.select` that hold a thumbnail rather than text. */
const IMAGE_COLUMN = /(poster|photo|thumbnail|avatar|image)_url$/;

const inputCls =
  'w-full bg-surface-2 border border-border text-text-primary rounded-xl px-4 py-3 text-sm focus:border-brand focus:outline-none placeholder-text-muted transition-all';
const labelCls = 'text-text-secondary text-xs font-bold block mb-1.5 tracking-wide';

function Sprockets({ className = '' }) {
  return (
    <div className={`flex items-center gap-[6px] ${className}`} aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span key={index} className="h-[9px] w-[6px] rounded-[1px] bg-current opacity-30" />
      ))}
    </div>
  );
}

/** `known_for_department` -> `Known for department`. */
function humanise(column) {
  const bare = column.replace(/_url$/, '').replace(/_/g, ' ');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/** Display string for a value, resolving select options back to their labels. */
function formatValue(field, value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value == null || String(value).trim() === '') return '';
  if (field.kind === 'select' || field.kind === 'multiselect') {
    const option = field.options?.find(candidate => candidate.value === value);
    return option ? option.label : String(value);
  }
  return String(value);
}

// --- Field rendering --------------------------------------------------------

function FieldShell({ field, children }) {
  return (
    <div>
      <span className={labelCls}>
        {field.label} {field.required && <span className="text-brand">*</span>}
      </span>
      {children}
      {field.help && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">{field.help}</p>
      )}
    </div>
  );
}

/**
 * Upload straight to the private quarantine bucket and report the storage path
 * up. Lifted from ContributeModals' ImageUploadField, with the schema's `help`
 * line taking over from its hardcoded caption.
 */
function ImageField({ field, path, onUploaded }) {
  const [status, setStatus] = useState(path ? 'done' : 'idle');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setStatus('uploading');
    setPreview(URL.createObjectURL(file));

    const result = await uploadContributionImage(file);
    if (result.error) {
      setStatus('error');
      setError(result.error);
      onUploaded(null);
      return;
    }
    setStatus('done');
    onUploaded(result.path);
  };

  return (
    <FieldShell field={field}>
      <div className="flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs font-bold text-text-secondary transition-all hover:border-brand/50">
          <Icon icon="solar:upload-linear" width="16" aria-hidden="true" />
          {status === 'uploading'
            ? 'Uploading…'
            : status === 'done'
              ? `Replace ${field.label.toLowerCase()}`
              : `Choose ${field.label.toLowerCase()}`}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFile}
          />
        </label>

        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt=""
              className="h-12 w-12 rounded-lg border border-border object-cover"
            />
            {status === 'done' && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Icon icon="solar:check-circle-bold" width="14" aria-hidden="true" />
              </span>
            )}
          </div>
        ) : (
          path && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
              <Icon icon="solar:check-circle-bold" width="15" aria-hidden="true" />
              Already uploaded
            </span>
          )
        )}
      </div>
      {error && <p className="mt-1.5 text-[11px] font-bold text-red-500">{error}</p>}
    </FieldShell>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.kind === 'textarea') {
    return (
      <FieldShell field={field}>
        <textarea
          className={`${inputCls} resize-y`}
          rows={field.rows || 4}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={event => onChange(event.target.value)}
        />
      </FieldShell>
    );
  }

  if (field.kind === 'select') {
    return (
      <FieldShell field={field}>
        <select
          className={inputCls}
          value={value ?? ''}
          onChange={event => onChange(event.target.value)}
        >
          <option value="">Select…</option>
          {(field.options || []).map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (field.kind === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    const toggle = optionValue =>
      onChange(
        selected.includes(optionValue)
          ? selected.filter(entry => entry !== optionValue)
          : [...selected, optionValue],
      );

    return (
      <FieldShell field={field}>
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map(option => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(option.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-all ${
                  active
                    ? 'border-brand/40 bg-brand/15 text-brand'
                    : 'border-border bg-surface-2 text-text-secondary hover:border-brand/30'
                }`}
              >
                {option.label}
                {active && <Icon icon="solar:check-circle-bold" width="12" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </FieldShell>
    );
  }

  const type =
    field.kind === 'number'
      ? 'number'
      : field.kind === 'date'
        ? 'date'
        : field.kind === 'url'
          ? 'url'
          : 'text';

  return (
    <FieldShell field={field}>
      <input
        type={type}
        className={inputCls}
        value={value ?? ''}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        onChange={event => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

// --- Chrome -----------------------------------------------------------------

function Stepper({ step }) {
  const percent = ((step - 1) / (SUBMIT_STEPS.length - 1)) * 100;

  return (
    <div className="mb-12">
      <div className="relative mx-auto flex max-w-2xl items-start justify-between">
        <div className="absolute left-0 top-[19px] -z-10 h-px w-full bg-border" />
        <div
          className="absolute left-0 top-[19px] -z-10 h-px bg-brand transition-all duration-500"
          style={{ width: `${percent}%` }}
        />

        {SUBMIT_STEPS.map(entry => {
          const done = step > entry.id;
          const current = step === entry.id;

          return (
            <div key={entry.key} className="flex flex-1 flex-col items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-[11px] font-black transition-all duration-500 ${
                  done
                    ? 'border-brand bg-brand text-white'
                    : current
                      ? 'scale-110 border-brand bg-brand text-white shadow-lg shadow-brand/20'
                      : 'border-border bg-surface text-text-muted'
                }`}
              >
                {done ? (
                  <Icon icon="solar:check-read-linear" width="16" aria-hidden="true" />
                ) : (
                  entry.id
                )}
              </div>
              <span
                className={`hidden text-center text-[10px] font-black uppercase leading-tight tracking-widest sm:block ${
                  step >= entry.id ? 'text-brand' : 'text-text-muted opacity-40'
                }`}
              >
                {entry.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Step 1. Reads `spec.duplicateCheck` and nothing else, so the same component
 * searches films, people or channels.
 */
function DuplicateCheck({ spec, query, onQueryChange, acknowledged, onAcknowledge, onMatchCount }) {
  const { duplicateCheck } = spec;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const columns = useMemo(
    () =>
      duplicateCheck.select
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean),
    [duplicateCheck.select],
  );
  const imageColumn = columns.find(column => IMAGE_COLUMN.test(column));
  const metaColumns = columns.filter(
    column =>
      column !== 'id' && column !== 'slug' && column !== duplicateCheck.column && column !== imageColumn,
  );

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      onMatchCount(0);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from(duplicateCheck.table)
        .select(duplicateCheck.select)
        .ilike(duplicateCheck.column, `%${trimmed}%`)
        .limit(8);

      if (cancelled) return;
      if (error) console.error('Duplicate check failed:', error);

      const list = error ? [] : data || [];
      setResults(list);
      setLoading(false);
      setSearched(true);
      // Reported up so step 1 can insist on an acknowledgement before moving on.
      onMatchCount(list.length);
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    trimmed,
    duplicateCheck.table,
    duplicateCheck.select,
    duplicateCheck.column,
    onMatchCount,
  ]);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <h2 className="font-heading text-3xl font-black leading-tight tracking-tighter md:text-4xl">
        Is it already here?
      </h2>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-muted">
        Duplicate records are the most expensive thing to fix in this catalogue — an editor has to
        merge them by hand. Search first, and if you find it, correct the existing record instead of
        adding a second one.
      </p>

      <div className="relative mt-8">
        <Icon
          icon="solar:magnifer-linear"
          width="18"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={`Search ${spec.label.toLowerCase()}s by ${duplicateCheck.column.replace(/_/g, ' ')}…`}
          className={`${inputCls} pl-11`}
          autoComplete="off"
        />
      </div>

      <div className="mt-6">
        {loading && (
          <p className="text-xs font-bold text-text-muted">Searching the catalogue…</p>
        )}

        {!loading && trimmed.length > 0 && trimmed.length < 2 && (
          <p className="text-xs font-bold text-text-muted">Type at least two characters.</p>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-surface-2/40 p-5">
            <Icon
              icon="solar:check-circle-bold"
              width="20"
              className="mt-0.5 shrink-0 text-emerald-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold text-text-primary">
                Nothing matching &ldquo;{trimmed}&rdquo;.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Looks new to us. Continue and tell us about it.
              </p>
            </div>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <Icon
                icon="solar:danger-triangle-bold"
                width="20"
                className="mt-0.5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-text-primary">
                  {results.length} existing {results.length === 1 ? 'record' : 'records'} look
                  similar.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Open any of them to check. If one is the {spec.label.toLowerCase()} you mean,
                  there is nothing to submit — suggest an edit on that record instead.
                </p>
              </div>
            </div>

            <ul className="space-y-2.5">
              {results.map(row => {
                const thumbnail = imageColumn ? row[imageColumn] : null;
                const href = row.slug
                  ? `${RECORD_PATH[spec.kind] || ''}/${row.slug}`
                  : null;

                const body = (
                  <>
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt=""
                        loading="lazy"
                        className="h-16 w-12 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-text-muted">
                        <Icon icon={spec.icon} width="18" aria-hidden="true" />
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-base font-black tracking-tight text-text-primary">
                        {row[duplicateCheck.column] || 'Untitled'}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {metaColumns.map(column => {
                          const raw = row[column];
                          if (raw == null || String(raw).trim() === '') return null;
                          return (
                            <span
                              key={column}
                              className="truncate text-[11px] font-semibold text-text-muted"
                            >
                              <span className="opacity-60">{humanise(column)}: </span>
                              {String(raw)}
                            </span>
                          );
                        })}
                      </span>
                    </span>

                    <span className="shrink-0 self-center text-[10px] font-black uppercase tracking-widest text-brand">
                      {href ? 'Open' : 'In catalogue'}
                      {href && (
                        <Icon
                          icon="solar:arrow-right-up-linear"
                          width="13"
                          className="ml-1 inline align-[-1px]"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </>
                );

                const shellCls =
                  'flex items-start gap-4 rounded-xl border border-border bg-surface-2 p-3.5 transition-colors';

                return (
                  <li key={row.id}>
                    {href ? (
                      <Link
                        to={href}
                        target="_blank"
                        rel="noreferrer"
                        className={`${shellCls} hover:border-brand/50`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className={shellCls}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2/50 p-5">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={event => onAcknowledge(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              />
              <span className="text-xs font-bold leading-relaxed text-text-secondary">
                I checked the matches above and none of them is the {spec.label.toLowerCase()} I am
                adding.
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// --- The wizard -------------------------------------------------------------

function SubmitWizard({ spec }) {
  const draftKey = `muvidb:submit-draft:${spec.kind}`;

  const [step, setStep] = useState(1);
  const [values, setValues] = useState(() => emptySubmission(spec.kind));
  const [imagePath, setImagePath] = useState(null);
  const [note, setNote] = useState('');
  const [dupQuery, setDupQuery] = useState('');
  const [dupMatchCount, setDupMatchCount] = useState(0);
  const [dupAcknowledged, setDupAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [restored, setRestored] = useState(false);

  const draft = useMemo(
    () => ({ step, values, imagePath, note, dupQuery }),
    [step, values, imagePath, note, dupQuery],
  );
  const { clearDraft, getDraft } = useLocalStorageDraft(draftKey, draft, !submitted);

  // Restore once, on mount. `getDraft` touches localStorage so it cannot run
  // during render (this page is server-rendered).
  const restoreRef = useRef(false);
  useEffect(() => {
    if (restoreRef.current) return;
    restoreRef.current = true;

    const saved = getDraft();
    if (!saved || typeof saved !== 'object') return;

    const hasContent =
      Object.values(saved.values || {}).some(value =>
        Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '',
      ) || !!saved.imagePath;
    if (!hasContent) return;

    setValues(previous => ({ ...previous, ...(saved.values || {}) }));
    if (saved.imagePath) setImagePath(saved.imagePath);
    if (saved.note) setNote(saved.note);
    if (saved.dupQuery) setDupQuery(saved.dupQuery);
    if (saved.step >= 1 && saved.step <= LAST_STEP) setStep(saved.step);
    setRestored(true);
  }, [getDraft]);

  const setValue = key => next => setValues(previous => ({ ...previous, [key]: next }));

  // A fresh set of candidates invalidates any previous "none of these" tick.
  const handleMatchCount = useCallback(count => {
    setDupMatchCount(count);
    setDupAcknowledged(false);
  }, []);

  const startOver = () => {
    clearDraft();
    setValues(emptySubmission(spec.kind));
    setImagePath(null);
    setNote('');
    setDupQuery('');
    setDupMatchCount(0);
    setDupAcknowledged(false);
    setRestored(false);
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nameMissing = missing => {
    const names = missing.map(field => field.label).join(', ');
    return `${names} ${missing.length > 1 ? 'are' : 'is'} required.`;
  };

  const goNext = () => {
    if (step === 1) {
      if (dupQuery.trim().length < 2) {
        toast.error(`Search for the ${spec.label.toLowerCase()} first — it may already be here.`);
        return;
      }
      if (dupMatchCount > 0 && !dupAcknowledged) {
        toast.error('Check the matches above, then confirm none of them is the one you mean.');
        return;
      }
      // Whatever they searched for is almost always the record's name, so it
      // seeds the identity field rather than making them type it twice.
      const identity = spec.identityKey;
      if (identity && !String(values[identity] ?? '').trim()) {
        setValues(previous => ({ ...previous, [identity]: dupQuery.trim() }));
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const { missing } = validateSubmission(spec.kind, values);
    const blocking = missing.filter(field => field.step === step);
    if (blocking.length) {
      toast.error(nameMissing(blocking));
      return;
    }

    setStep(previous => Math.min(LAST_STEP, previous + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setStep(previous => Math.max(1, previous - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const { ok, missing } = validateSubmission(spec.kind, values);
    if (!ok) {
      toast.error(nameMissing(missing));
      setStep(missing[0].step);
      return;
    }

    setSubmitting(true);
    const result = await submitNewRecord({
      kind: spec.kind,
      fields: values,
      image_path: imagePath,
      note: note.trim() || null,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error?.message || 'Could not submit. Please try again.');
      return;
    }

    clearDraft();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Confirmation -------------------------------------------------------
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center md:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
            <Icon icon="solar:check-read-linear" width="36" className="text-brand" aria-hidden="true" />
          </div>

          <h2 className="mt-7 font-heading text-3xl font-black leading-tight tracking-tighter md:text-4xl">
            Sent to our editors.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-text-muted">
            Your {spec.label.toLowerCase()} submission is in the review queue. An editor checks each
            field on its own, keeps what is verifiable and corrects the rest before it is published
            — so it will not appear on the site immediately.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                startOver();
              }}
              className="rounded-lg bg-brand px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95"
            >
              Add another
            </button>
            <Link
              to="/submit"
              className="rounded-lg border border-border bg-surface-2 px-6 py-3 text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:border-brand hover:text-brand active:scale-95"
            >
              Submit something else
            </Link>
            <Link
              to="/browse"
              className="rounded-lg border border-border bg-surface-2 px-6 py-3 text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:border-brand hover:text-brand active:scale-95"
            >
              Back to browsing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeStep = SUBMIT_STEPS.find(entry => entry.id === step);
  const fields = submitFieldsForStep(spec.kind, step);
  const reviewSteps = SUBMIT_STEPS.filter(entry => submitFieldsForStep(spec.kind, entry.id).length > 0);

  return (
    <>
      <Stepper step={step} />

      {restored && step < LAST_STEP && (
        <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-5 py-3.5">
          <p className="text-xs font-bold text-text-secondary">
            <Icon
              icon="solar:history-linear"
              width="15"
              className="mr-1.5 inline align-[-2px] text-brand"
              aria-hidden="true"
            />
            Picked up where you left off.
          </p>
          <button
            type="button"
            onClick={startOver}
            className="text-[10px] font-black uppercase tracking-widest text-text-muted transition-colors hover:text-brand"
          >
            Start over
          </button>
        </div>
      )}

      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface p-7 md:p-10">
        {step === 1 && (
          <DuplicateCheck
            spec={spec}
            query={dupQuery}
            onQueryChange={setDupQuery}
            acknowledged={dupAcknowledged}
            onAcknowledge={setDupAcknowledged}
            onMatchCount={handleMatchCount}
          />
        )}

        {step > 1 && step < LAST_STEP && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="font-heading text-3xl font-black leading-tight tracking-tighter md:text-4xl">
              {activeStep?.title}
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-muted">
              {activeStep?.description}
            </p>

            <div className="mt-8 space-y-6">
              {fields.map(field =>
                field.kind === 'image' ? (
                  <ImageField
                    key={field.key}
                    field={field}
                    path={imagePath}
                    onUploaded={setImagePath}
                  />
                ) : (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    onChange={setValue(field.key)}
                  />
                ),
              )}
            </div>
          </div>
        )}

        {step === LAST_STEP && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="font-heading text-3xl font-black leading-tight tracking-tighter md:text-4xl">
              {activeStep?.title}
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-muted">
              {activeStep?.description}
            </p>

            <div className="mt-8 space-y-8">
              {reviewSteps.map(entry => (
                <section key={entry.key}>
                  <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2.5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-text-muted">
                      {entry.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setStep(entry.id)}
                      className="text-[10px] font-black uppercase tracking-widest text-brand hover:underline"
                    >
                      Edit
                    </button>
                  </div>

                  <dl className="mt-4 space-y-3">
                    {submitFieldsForStep(spec.kind, entry.id).map(field => {
                      if (field.kind === 'image') {
                        return (
                          <div key={field.key} className="flex gap-4 sm:gap-6">
                            <dt className="w-32 shrink-0 text-xs font-bold text-text-muted sm:w-44">
                              {field.label}
                            </dt>
                            <dd className="min-w-0 flex-1 text-sm font-semibold text-text-primary">
                              {imagePath ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-500">
                                  <Icon
                                    icon="solar:check-circle-bold"
                                    width="15"
                                    aria-hidden="true"
                                  />
                                  Uploaded
                                </span>
                              ) : (
                                <span className="text-text-muted opacity-60">Not provided</span>
                              )}
                            </dd>
                          </div>
                        );
                      }

                      const display = formatValue(field, values[field.key]);
                      return (
                        <div key={field.key} className="flex gap-4 sm:gap-6">
                          <dt className="w-32 shrink-0 text-xs font-bold text-text-muted sm:w-44">
                            {field.label}
                            {field.required && <span className="text-brand"> *</span>}
                          </dt>
                          <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm font-semibold text-text-primary">
                            {display || (
                              <span className="text-text-muted opacity-60">Not provided</span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ))}

              <div>
                <span className={labelCls}>Anything else our editors should know?</span>
                <textarea
                  className={`${inputCls} resize-y`}
                  rows={3}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="Where you got this information, what you were unsure about, anything that did not fit a field above."
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
                  Free text — read by a person, not applied automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation ───────────────────────────────────────── */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-hairline pt-7">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="rounded-lg border border-border bg-surface-2 px-6 py-3 text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:border-brand hover:text-brand active:scale-95 disabled:opacity-50"
            >
              Back
            </button>
          ) : (
            <Link
              to="/submit"
              className="rounded-lg border border-border bg-surface-2 px-6 py-3 text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:border-brand hover:text-brand active:scale-95"
            >
              Cancel
            </Link>
          )}

          {step < LAST_STEP ? (
            <button
              type="button"
              onClick={goNext}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95"
            >
              Continue
              <Icon icon="solar:arrow-right-linear" width="15" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending…
                </>
              ) : (
                <>
                  Submit for review
                  <Icon icon="solar:arrow-right-linear" width="15" aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// --- Page shell -------------------------------------------------------------

function Shell({ eyebrow, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--color-text-primary) 0 2px, transparent 2px 96px)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-28 md:pt-32">
          <Sprockets className="mb-8 text-text-primary" />
          <p className="text-[11px] font-black uppercase tracking-[0.42em] text-brand">{eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-black leading-[0.95] tracking-tighter md:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">{subtitle}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 md:py-16">{children}</main>
    </div>
  );
}

export default function Submit() {
  const { kind } = useParams();
  const spec = SUBMIT_KINDS[kind];
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = spec ? `${spec.title} | MuviDB` : 'Submit | MuviDB';
    window.scrollTo(0, 0);
  }, [spec]);

  // Signing in is the only abuse control on this form (that plus RLS), so the
  // gate is hard. Wait for auth to settle first — `loading` is true on the
  // server and on the first client paint.
  const returnPath = `/submit/${kind || ''}`;
  useEffect(() => {
    if (!spec || loading || isAuthenticated) return;
    navigate(`/login?next=${encodeURIComponent(returnPath)}`, { replace: true });
  }, [spec, loading, isAuthenticated, navigate, returnPath]);

  if (!spec) {
    return (
      <Shell
        eyebrow="Contribute to MuviDB"
        title="We do not have a form for that."
        subtitle={`"${kind}" is not something you can submit. Pick one of these instead.`}
      >
        <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
          {Object.values(SUBMIT_KINDS).map(entry => (
            <li key={entry.kind}>
              <Link
                to={`/submit/${entry.kind}`}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-brand/50"
              >
                <Icon icon={entry.icon} width="26" className="text-brand" aria-hidden="true" />
                <span className="mt-4 font-heading text-lg font-black tracking-tight">
                  {entry.title}
                </span>
                <span className="mt-1.5 text-xs leading-relaxed text-text-muted">
                  {entry.subtitle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  if (loading || !isAuthenticated) {
    return (
      <Shell eyebrow="Contribute to MuviDB" title={spec.title} subtitle={spec.subtitle}>
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-8 text-center md:p-10">
          <Icon
            icon="solar:login-3-linear"
            width="30"
            className="mx-auto text-brand"
            aria-hidden="true"
          />
          <h2 className="mt-5 font-heading text-2xl font-black tracking-tight">
            Sign in to continue
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            Submissions are tied to an account so our editors can follow up on them. You will come
            straight back to this form.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to={`/login?next=${encodeURIComponent(returnPath)}`}
              className="rounded-lg bg-brand px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-95"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg border border-border bg-surface-2 px-6 py-3 text-xs font-black uppercase tracking-widest text-text-primary transition-all hover:border-brand hover:text-brand active:scale-95"
            >
              Create an account
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell eyebrow={`Add a ${spec.label.toLowerCase()}`} title={spec.title} subtitle={spec.subtitle}>
      <SubmitWizard key={spec.kind} spec={spec} />
    </Shell>
  );
}
