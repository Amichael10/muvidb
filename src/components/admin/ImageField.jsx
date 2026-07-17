import { useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { uploadAdminImage, isEphemeralImageUrl } from '../../lib/imageUpload';

const ASPECT = {
  poster: 'aspect-[2/3] w-20',
  backdrop: 'aspect-video w-32',
  square: 'aspect-square w-20',
};

/**
 * Image picker for the admin drawers: upload a file OR paste a link.
 *
 * Uploads go straight to a public bucket and come back as a permanent URL on
 * our own storage. Links are kept because they're still the fastest path for
 * TMDB/YouTube assets, which the mirror cron picks up later anyway.
 *
 * @param {{
 *   label: string,
 *   value: string,
 *   onChange: (url: string) => void,
 *   bucket?: 'posters'|'backdrops'|'people'|'film-images',
 *   aspect?: 'poster'|'backdrop'|'square',
 *   hint?: string,
 * }} props
 */
export default function ImageField({
  label,
  value,
  onChange,
  bucket = 'film-images',
  aspect = 'poster',
  hint,
}) {
  const [mode, setMode] = useState('link');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const { url, error: upErr } = await uploadAdminImage(file, bucket);
    setBusy(false);
    if (upErr) {
      setError(upErr);
      return;
    }
    onChange(url);
  };

  const tab = (id, icon, text) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${
        mode === id
          ? 'bg-brand text-white shadow-sm'
          : 'text-text-muted hover:text-text-primary'
      }`}
    >
      <Icon icon={icon} className="text-sm" />
      {text}
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold text-text-primary">{label}</label>
        <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-lg p-0.5">
          {tab('link', 'solar:link-linear', 'Link')}
          {tab('upload', 'solar:upload-minimalistic-linear', 'Upload')}
        </div>
      </div>

      <div className="flex gap-3">
        <div
          className={`${ASPECT[aspect]} shrink-0 rounded-md border border-border bg-surface-2 overflow-hidden flex items-center justify-center`}
        >
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon icon="solar:gallery-linear" className="text-lg text-text-muted" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {mode === 'link' ? (
            <input
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-md px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all"
              placeholder="https://"
            />
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => !busy && fileRef.current?.click()}
              className={`w-full border border-dashed border-border rounded-md px-4 py-3 text-center transition-all ${
                busy ? 'opacity-60' : 'cursor-pointer hover:border-brand hover:bg-surface-2'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <p className="text-xs font-bold text-text-primary">
                {busy ? 'Uploading…' : 'Drop an image or click to browse'}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">PNG, JPEG or WebP · max 5 MB</p>
            </div>
          )}

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setError(null);
              }}
              className="mt-1.5 text-[10px] font-bold text-text-muted hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}

          {error && <p className="mt-1.5 text-[10px] font-bold text-red-500">{error}</p>}

          {isEphemeralImageUrl(value) && (
            <p className="mt-1.5 text-[10px] font-bold text-amber-500 flex items-start gap-1">
              <Icon icon="solar:danger-triangle-linear" className="text-xs mt-px shrink-0" />
              <span>
                Instagram links expire after a few days and can&apos;t be mirrored. Upload the
                file instead.
              </span>
            </p>
          )}

          {hint && !error && <p className="mt-1.5 text-[10px] text-text-muted">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
