import { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { suggestPersonEdit } from '../../lib/contributions';
import { uploadContributionImage } from '../../lib/imageUpload';
import { getChangedProfileFields } from '../../lib/professionalProfile';
import { extractChannelIdentifier, fetchChannelData } from '../../lib/youtube';
import { formatViewCount } from '../../utils/youtube';

const fieldClass = 'mt-2 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10';

const fields = [
  ['name', 'Professional name', 'text', 'The name audiences and employers know you by'],
  ['known_for_department', 'Primary profession', 'text', 'Actor, Director, Producer…'],
  ['nationality', 'Nationality', 'text', 'e.g. Nigerian'],
  ['birthplace', 'Birthplace', 'text', 'City, country'],
  ['date_of_birth', 'Date of birth', 'date', ''],
  ['instagram_url', 'Instagram', 'url', 'https://instagram.com/yourname'],
  ['twitter_url', 'X / Twitter', 'url', 'https://x.com/yourname'],
  ['tiktok_url', 'TikTok', 'url', 'https://tiktok.com/@yourname'],
  ['facebook_url', 'Facebook', 'url', 'https://facebook.com/yourname'],
];

export default function ProfileEditorModal({ person, onClose, onSaved }) {
  const initial = useMemo(() => Object.fromEntries(fields.map(([key]) => [key, person?.[key] || ''])), [person]);
  const [values, setValues] = useState(initial);
  const [bio, setBio] = useState(person?.bio || '');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState(person.youtube_channel_id ? `https://youtube.com/channel/${person.youtube_channel_id}` : (person.youtube_handle || ''));
  const [youtubePreview, setYoutubePreview] = useState(person.youtube_stats || null);
  const [checkingYoutube, setCheckingYoutube] = useState(false);

  const checkYoutube = async () => {
    const identifier = extractChannelIdentifier(youtubeInput.trim());
    if (!identifier) return toast.error('Enter a YouTube channel URL, handle or channel ID.');
    setCheckingYoutube(true);
    try {
      const channel = await fetchChannelData(identifier);
      setYoutubePreview(channel);
      setValues((current) => ({ ...current, youtube_channel_id: channel.channelId, youtube_handle: channel.handle || '' }));
      toast.success('YouTube channel found. It will be connected after editorial review.');
    } catch (error) {
      console.error('YouTube channel lookup failed', error);
      toast.error('We couldn’t find that channel. Check the link or handle and try again.');
    } finally {
      setCheckingYoutube(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const changedFields = getChangedProfileFields(person, { ...values, bio });
    if (!Object.keys(changedFields).length && !photo) return toast.error('Make at least one change before submitting.');
    setSaving(true);
    try {
      let imagePath = null;
      if (photo) {
        const upload = await uploadContributionImage(photo);
        if (upload.error) {
          toast.error(upload.error);
          return;
        }
        imagePath = upload.path;
      }
      const result = await suggestPersonEdit({
        personId: person.id,
        fields: changedFields,
        image_path: imagePath,
        note: 'Submitted from the verified professional dashboard.',
      });
      if (!result.ok) throw result.error;
      toast.success('Profile update sent to the MuviDB editorial team.');
      onSaved();
      onClose();
    } catch (error) {
      console.error('Professional profile update failed', error);
      toast.error('We couldn’t submit your profile update. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#151515] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-white/10 bg-[#151515]/95 px-6 py-6 backdrop-blur md:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-brand">Professional profile</p>
            <h2 className="mt-2 text-2xl font-black text-text-primary">Complete your public profile</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Add the details casting teams and audiences need. MuviDB reviews changes before they appear publicly.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile editor" className="rounded-full p-1 text-text-muted hover:text-white"><Icon icon="solar:close-circle-linear" width="28" /></button>
        </header>

        <div className="grid gap-8 p-6 md:grid-cols-[220px_1fr] md:p-8">
          <aside>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface-2">
              <img src={photo ? URL.createObjectURL(photo) : (person.photo_url || '/images/person-placeholder.png')} alt="Profile preview" className="aspect-[4/5] w-full object-cover" />
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-black text-text-primary hover:border-brand hover:text-brand">
              <Icon icon="solar:camera-add-linear" width="18" /> Choose headshot
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
            </label>
            <p className="mt-2 text-center text-[10px] leading-4 text-text-muted">PNG, JPEG or WebP · large photos are compressed automatically</p>
          </aside>

          <div>
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map(([key, label, type, placeholder]) => (
                <label key={key} className={key.includes('url') || key === 'youtube_handle' ? 'sm:col-span-2' : ''}>
                  <span className="text-xs font-bold text-text-primary">{label}</span>
                  <input type={type} value={values[key]} placeholder={placeholder} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className={fieldClass} />
                </label>
              ))}
              <label className="sm:col-span-2">
                <span className="flex items-center justify-between text-xs font-bold text-text-primary"><span>Professional bio</span><span className="font-medium text-text-muted">{bio.length}/1200</span></span>
                <textarea value={bio} maxLength={1200} rows={7} onChange={(event) => setBio(event.target.value)} placeholder="Introduce your work, experience and career highlights in a few clear paragraphs." className={fieldClass} />
              </label>
              <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400"><Icon icon="logos:youtube-icon" width="22" /></span><div><p className="text-sm font-black text-text-primary">Connect your YouTube channel</p><p className="mt-1 text-xs leading-5 text-text-muted">Enter a channel link, @handle or channel ID. MuviDB previews it now and starts syncing analytics after approval.</p></div></div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={youtubeInput} onChange={(event) => setYoutubeInput(event.target.value)} placeholder="https://youtube.com/@yourchannel" className={`${fieldClass} mt-0 flex-1`} /><button type="button" disabled={checkingYoutube} onClick={checkYoutube} className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-xs font-black text-red-400 disabled:opacity-50">{checkingYoutube ? 'Checking…' : 'Preview channel'}</button></div>
                {youtubePreview && <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[.03] p-4"><img src={youtubePreview.thumbnail || '/images/person-placeholder.png'} alt="" className="h-12 w-12 rounded-full object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-text-primary">{youtubePreview.title || youtubePreview.handle || 'Connected channel'}</p><p className="mt-1 text-[10px] text-text-muted">{formatViewCount(youtubePreview.subscribers || 0)} subscribers · {formatViewCount(youtubePreview.views || 0)} channel views · {formatViewCount(youtubePreview.videos || 0)} videos</p></div><Icon icon="solar:verified-check-bold" width="22" className="text-emerald-400" /></div>}
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-[11px] leading-5 text-text-muted"><Icon icon="solar:shield-check-linear" className="mr-1 inline text-brand" /> Your public profile remains unchanged until an editor approves this request.</p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-3 text-xs font-black text-text-primary">Cancel</button>
                <button disabled={saving} className="rounded-xl bg-brand px-5 py-3 text-xs font-black text-white disabled:opacity-50">{saving ? 'Sending update…' : 'Send for review'}</button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
