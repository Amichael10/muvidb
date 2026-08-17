import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import '@fontsource/bebas-neue/400.css';
import { supabase } from '../../lib/supabase';
import {
  buildCareerPassportModel,
  careerPassportFilename,
  careerPassportShareText,
  generateCareerPassportJpeg,
} from '../../lib/careerPassport';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function getCollaboratorCount(person, credits) {
  const filmIds = [...new Set(credits.map((credit) => credit.film_id || credit.films?.id).filter(Boolean))];
  if (!person?.id || !filmIds.length) return 0;
  const { data, error } = await supabase.from('credits').select('person_id').in('film_id', filmIds).neq('person_id', person.id);
  if (error) return 0;
  return new Set((data || []).map((credit) => credit.person_id).filter(Boolean)).size;
}

export default function CareerPassportModal({ person, credits = [], personalized = false, onClose }) {
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const baseUrl = useMemo(() => typeof window === 'undefined' ? 'https://muvidb.com' : window.location.origin, []);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    (async () => {
      try {
        const collaboratorCount = await getCollaboratorCount(person, credits);
        const model = buildCareerPassportModel({ person, credits, collaboratorCount, baseUrl });
        const generated = await generateCareerPassportJpeg(model);
        if (!active) return;
        objectUrl = URL.createObjectURL(generated);
        setBlob(generated);
        setPreviewUrl(objectUrl);
      } catch (generationError) {
        console.error('Career Passport generation failed', generationError);
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [baseUrl, credits, person]);

  const handleShare = async () => {
    if (!blob) return;
    setSharing(true);
    const filename = careerPassportFilename(person);
    const text = careerPassportShareText(person, personalized);
    const profileUrl = `${baseUrl}/people/${person.slug || person.id}`;
    const file = new File([blob], filename, { type: 'image/jpeg' });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${person.name} — MuviDB Career Passport`, text: `${text} ${profileUrl}`, files: [file] });
      } else {
        downloadBlob(blob, filename);
        try { await navigator.clipboard.writeText(`${text} ${profileUrl}`); } catch { /* download still succeeded */ }
        toast.success('Passport downloaded. Your share message is ready to paste.');
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') {
        downloadBlob(blob, filename);
        toast.success('Passport downloaded and ready to share.');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = () => {
    if (!blob) return;
    downloadBlob(blob, careerPassportFilename(person));
    toast.success('Career Passport downloaded.');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Career Passport preview">
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#131313] shadow-2xl lg:flex-row">
        <button onClick={onClose} aria-label="Close Career Passport" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/70 text-white hover:border-brand hover:text-brand"><Icon icon="solar:close-circle-linear" width="22" /></button>
        <div className="flex min-h-[380px] flex-1 items-center justify-center overflow-auto bg-[#090909] p-5 md:p-8">
          {!previewUrl && !error && <div className="text-center"><Icon icon="solar:magic-stick-3-linear" width="42" className="mx-auto animate-pulse text-brand" /><p className="mt-4 text-sm font-black text-white">Creating your Career Passport…</p><p className="mt-2 text-xs text-text-muted">Adding your verified profile, credits and scannable link.</p></div>}
          {error && <div className="max-w-sm text-center"><Icon icon="solar:gallery-remove-linear" width="42" className="mx-auto text-brand" /><h2 className="mt-4 text-xl font-black text-white">We couldn’t prepare this passport</h2><p className="mt-2 text-sm leading-6 text-text-muted">Please check the profile images and try again in a moment.</p></div>}
          {previewUrl && <img src={previewUrl} alt={`${person.name} Career Passport preview`} className="max-h-[82vh] w-auto max-w-full rounded-xl shadow-2xl" />}
        </div>
        <aside className="w-full shrink-0 border-t border-white/10 p-6 lg:w-[330px] lg:border-l lg:border-t-0 lg:p-8">
          <p className="text-[10px] font-black uppercase tracking-[.24em] text-brand">Share your story</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-white">Your career, in one image.</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">This JPEG is built from verified MuviDB information and includes a QR code linking to the full public profile.</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs leading-5 text-text-muted"><Icon icon="solar:smartphone-2-linear" className="mr-2 inline text-brand" />On a supported phone, Share opens the apps installed on the device. Otherwise, the JPEG downloads automatically.</div>
          <button disabled={!blob || sharing} onClick={handleShare} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-4 text-xs font-black text-white shadow-lg shadow-brand/20 disabled:opacity-40"><Icon icon="solar:share-bold" width="18" />{sharing ? 'Opening share options…' : 'Share Career Passport'}</button>
          <button disabled={!blob} onClick={handleDownload} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-4 text-xs font-black text-white hover:border-brand hover:text-brand disabled:opacity-40"><Icon icon="solar:download-minimalistic-linear" width="18" />Download JPEG</button>
          <p className="mt-5 text-center text-[10px] leading-4 text-text-muted">No extra image is stored in Supabase. The JPEG is generated on this device.</p>
        </aside>
      </div>
    </div>
  );
}
