import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  suggestNewPerson,
  suggestPersonEdit,
  suggestFilmEdit,
  reportLink,
  reportChannel,
} from '../../lib/contributions';
import { uploadContributionImage } from '../../lib/imageUpload';

// Shared modal shell ---------------------------------------------------------
function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-border sticky top-0 bg-surface">
          <div>
            <h3 className="text-text-primary text-lg font-bold tracking-tight">{title}</h3>
            {subtitle && <p className="text-text-muted text-xs mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <Icon icon="solar:close-circle-linear" width="24" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-surface-2 border border-border text-text-primary rounded-xl px-4 py-3 text-sm focus:border-brand focus:outline-none placeholder-text-muted transition-all';
const labelCls = 'text-text-secondary text-xs font-bold block mb-1.5 tracking-wide';

// Secure image upload field: validates + re-encodes + uploads to the private
// quarantine bucket, then reports the storage path up via onUploaded(path).
function ImageUploadField({ label, onUploaded }) {
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setStatus('uploading');
    setPreview(URL.createObjectURL(file));
    const { path, error } = await uploadContributionImage(file);
    if (error) {
      setStatus('error');
      setErr(error);
      onUploaded(null);
      return;
    }
    setStatus('done');
    onUploaded(path);
  };

  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <label className="cursor-pointer inline-flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-text-secondary hover:border-brand/50 transition-all">
          <Icon icon="solar:upload-linear" width="16" />
          {status === 'uploading' ? 'Uploading…' : status === 'done' ? 'Replace image' : 'Choose image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
        </label>
        {preview && (
          <div className="relative">
            <img src={preview} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
            {status === 'done' && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                <Icon icon="solar:check-circle-bold" width="14" />
              </span>
            )}
          </div>
        )}
      </div>
      {err && <p className="text-red-500 text-[11px] font-bold mt-1">{err}</p>}
      <p className="text-text-muted text-[10px] mt-1">PNG, JPEG or WebP · max 5 MB</p>
    </Field>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>
        {label} {required && <span className="text-brand">*</span>}
      </label>
      {children}
    </div>
  );
}

function SubmitRow({ submitting, onClose, label = 'Submit' }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className="flex-[2] bg-brand text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
      >
        {submitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Sending…</span>
          </>
        ) : (
          label
        )}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-surface-2 text-text-secondary font-bold py-3.5 rounded-xl text-sm hover:bg-surface-3 transition-all"
      >
        Cancel
      </button>
    </div>
  );
}

// Shared submit wrapper: requires auth, runs the lib call, toasts, closes.
function useContributionSubmit(onClose) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const run = async (fn) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to contribute.');
      navigate('/login');
      return;
    }
    setSubmitting(true);
    const { ok, error } = await fn();
    setSubmitting(false);
    if (ok) {
      toast.success('Thank you! Your submission is pending review.');
      onClose();
    } else {
      toast.error(error?.message || 'Could not submit. Please try again.');
    }
  };

  return { submitting, run };
}

// 1. Suggest a missing person ------------------------------------------------
export function SuggestPersonModal({ onClose }) {
  const { submitting, run } = useContributionSubmit(onClose);
  const [f, setF] = useState({
    name: '', social_link: '', sex: '', bio: '', date_of_birth: '', films: '',
  });
  const [imagePath, setImagePath] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.social_link.trim() || !f.sex) {
      toast.error('Name, a social link, and sex are required.');
      return;
    }
    run(() => suggestNewPerson({ ...f, image_path: imagePath }));
  };

  return (
    <ModalShell
      title="Suggest a missing person"
      subtitle="Know an actor or crew member we're missing? Tell us about them."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name" required>
          <input className={inputCls} value={f.name} onChange={set('name')} placeholder="e.g. Genevieve Nnaji" />
        </Field>
        <Field label="Social media link" required>
          <input className={inputCls} value={f.social_link} onChange={set('social_link')} placeholder="Instagram / X / etc." />
        </Field>
        <Field label="Sex" required>
          <select className={inputCls} value={f.sex} onChange={set('sex')}>
            <option value="">Select…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
        <Field label="Films they've acted in / worked on">
          <textarea className={`${inputCls} resize-none h-20`} value={f.films} onChange={set('films')} placeholder="One title per line, or comma-separated" />
        </Field>
        <Field label="Date of birth">
          <input type="date" className={inputCls} value={f.date_of_birth} onChange={set('date_of_birth')} />
        </Field>
        <ImageUploadField label="Photo" onUploaded={setImagePath} />
        <Field label="Short bio">
          <textarea className={`${inputCls} resize-none h-20`} value={f.bio} onChange={set('bio')} placeholder="Optional" />
        </Field>
        <SubmitRow submitting={submitting} onClose={onClose} label="Submit person" />
      </form>
    </ModalShell>
  );
}

// 2. Suggest an edit to a person or film ------------------------------------
export function SuggestEditModal({ onClose, target, targetId, targetName }) {
  // target: 'person' | 'film'
  const { submitting, run } = useContributionSubmit(onClose);
  const [changes, setChanges] = useState('');
  const [imagePath, setImagePath] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!changes.trim() && !imagePath) {
      toast.error('Describe what should change, or attach a new image.');
      return;
    }
    if (target === 'person') {
      run(() => suggestPersonEdit({ personId: targetId, changes, image_path: imagePath }));
    } else {
      run(() => suggestFilmEdit({ filmId: targetId, changes, image_path: imagePath }));
    }
  };

  return (
    <ModalShell
      title={`Suggest an edit`}
      subtitle={targetName ? `For "${targetName}"` : 'Help us fix or complete this entry.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="What's missing or wrong?" required>
          <textarea
            className={`${inputCls} resize-none h-32`}
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
            placeholder="e.g. The release year should be 2023, the director is X, add the social link…"
          />
        </Field>
        <ImageUploadField label="New image (optional)" onUploaded={setImagePath} />
        <SubmitRow submitting={submitting} onClose={onClose} label="Submit edit" />
      </form>
    </ModalShell>
  );
}

// 3. Report a link or a channel ---------------------------------------------
export function ReportModal({ onClose, kind, targetId, targetName, url }) {
  // kind: 'link' | 'channel'
  const { submitting, run } = useContributionSubmit(onClose);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const reasons =
    kind === 'link'
      ? ['Broken / dead link', 'Pirated copy', 'Wrong film', 'Geo-blocked', 'Other']
      : ['Pirated content', 'Spam / scam', 'Inappropriate', 'Inactive / dead', 'Other'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please choose a reason.');
      return;
    }
    if (kind === 'link') {
      run(() => reportLink({ filmId: targetId, reason, url, note }));
    } else {
      run(() => reportChannel({ channelId: targetId, reason, note }));
    }
  };

  return (
    <ModalShell
      title={kind === 'link' ? 'Report a watch link' : 'Report a channel'}
      subtitle={targetName ? `For "${targetName}"` : undefined}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Reason" required>
          <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            {reasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Anything else?">
          <textarea className={`${inputCls} resize-none h-24`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details" />
        </Field>
        <SubmitRow submitting={submitting} onClose={onClose} label="Send report" />
      </form>
    </ModalShell>
  );
}
