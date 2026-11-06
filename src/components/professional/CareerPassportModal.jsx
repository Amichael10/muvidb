import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import QRCode from 'qrcode';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  buildCareerPassportModel,
  careerPassportFilename,
  careerPassportShareText,
  generateCareerPassportJpeg,
} from '../../lib/careerPassport';
import CareerCVPdfDocument from './CareerCVPdfDocument';

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
  try {
    const res = await fetch(`/api/content?resource=costar-count&personId=${encodeURIComponent(person.id)}`);
    if (!res.ok) return 0;
    return (await res.json()).count || 0;
  } catch {
    return 0;
  }
}

export default function CareerPassportModal({ person, credits = [], stageCredits = [], personalized = false, onClose }) {
  useBodyScrollLock(true);
  
  // Tab: 'pdf' (Customizable Industry CV & EPK) vs 'social' (Square/Story JPEG card)
  const [activeTab, setActiveTab] = useState('pdf');

  // Social JPEG state
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);
  
  // PDF CV Customization State
  const [preset, setPreset] = useState('actor'); // 'actor' | 'director' | 'comprehensive'
  const [pdfOptions, setPdfOptions] = useState({
    includeHeadshot: true,
    includePhysicalSpecs: true,
    includeGuilds: true,
    includeMetrics: false, // Default off for actors, toggleable!
    includeScreenCredits: true,
    includeStageCredits: true, // Stage & Film included!
    includeAwards: true,
    includeRepresentation: true,
    includeQrCode: true,
  });
  const [customNotes, setCustomNotes] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const baseUrl = useMemo(() => typeof window === 'undefined' ? 'https://muvidb.com' : window.location.origin, []);
  const profileUrl = useMemo(() => `${baseUrl}/@${person.slug || person.handle || person.id}`, [baseUrl, person]);

  // Generate QR Code on mount
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(profileUrl, {
      width: 256,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.warn('QR Code generation failed:', err);
      });
    return () => { active = false; };
  }, [profileUrl]);

  // Generate JPEG for social card tab
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    (async () => {
      try {
        const collaboratorCount = await getCollaboratorCount(person, credits);
        const model = buildCareerPassportModel({ person, credits, stageCredits, collaboratorCount, baseUrl });
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
  }, [baseUrl, credits, person, stageCredits]);

  // Handle Preset Switching
  const handleApplyPreset = (p) => {
    setPreset(p);
    if (p === 'actor') {
      setPdfOptions({
        includeHeadshot: true,
        includePhysicalSpecs: true,
        includeGuilds: true,
        includeMetrics: false, // Actors focus on craft and roles
        includeScreenCredits: true,
        includeStageCredits: true,
        includeAwards: true,
        includeRepresentation: true,
        includeQrCode: true,
      });
    } else if (p === 'director') {
      setPdfOptions({
        includeHeadshot: true,
        includePhysicalSpecs: false, // Not relevant for directors
        includeGuilds: true,
        includeMetrics: true, // Directors and producers brag about box office gross!
        includeScreenCredits: true,
        includeStageCredits: true,
        includeAwards: true,
        includeRepresentation: true,
        includeQrCode: true,
      });
    } else if (p === 'comprehensive') {
      setPdfOptions({
        includeHeadshot: true,
        includePhysicalSpecs: true,
        includeGuilds: true,
        includeMetrics: true,
        includeScreenCredits: true,
        includeStageCredits: true,
        includeAwards: true,
        includeRepresentation: true,
        includeQrCode: true,
      });
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleCopyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Live profile link copied to clipboard!');
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const handleShare = async () => {
    if (!blob) return;
    setSharing(true);
    const filename = careerPassportFilename(person);
    const text = careerPassportShareText(person, personalized);
    const file = new File([blob], filename, { type: 'image/jpeg' });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${person.name} — MuviDB Career Passport`, text: `${text} ${profileUrl}`, files: [file] });
      } else {
        downloadBlob(blob, filename);
        try { await navigator.clipboard.writeText(`${text} ${profileUrl}`); } catch {}
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

  const handleDownloadJpeg = () => {
    if (!blob) return;
    downloadBlob(blob, careerPassportFilename(person));
    toast.success('Career Passport JPEG downloaded.');
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md overflow-y-auto" role="dialog" aria-modal="true" aria-label="Career Export Studio">
      <div className="relative flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#121214] shadow-2xl">
        {/* Top Bar with Mode Switcher & Close */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-3.5 bg-zinc-950 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-black">
              M
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-none">
                Career Export Studio
              </h2>
              <p className="text-[10px] sm:text-xs text-text-muted mt-0.5">
                Generate verified industry casting CVs, EPKs, and social cards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Toggle: PDF CV vs Social Card */}
            <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
              <button
                onClick={() => setActiveTab('pdf')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'pdf'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon icon="solar:document-text-bold" width="14" />
                <span>Printable PDF CV</span>
              </button>
              <button
                onClick={() => setActiveTab('social')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'social'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon icon="solar:gallery-wide-bold" width="14" />
                <span>Social Card (JPEG)</span>
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Close Export Studio"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white hover:border-brand hover:text-brand transition ml-2"
            >
              <Icon icon="solar:close-circle-linear" width="20" />
            </button>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: CUSTOMIZABLE PRINTABLE PDF CV & EPK                         */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {activeTab === 'pdf' && (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
            {/* Live Document Preview Container */}
            <div className="flex-1 overflow-y-auto bg-zinc-900 p-4 sm:p-8 custom-scrollbar">
              <div className="max-w-[850px] mx-auto bg-white shadow-2xl rounded-xl overflow-hidden">
                <CareerCVPdfDocument
                  person={person}
                  credits={credits}
                  stageCredits={stageCredits}
                  qrCodeUrl={qrCodeDataUrl}
                  profileUrl={profileUrl}
                  options={pdfOptions}
                  customNotes={customNotes}
                />
              </div>
            </div>

            {/* Customization Controls Sidebar */}
            <aside className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-white/10 bg-zinc-950 p-5 sm:p-6 overflow-y-auto flex-shrink-0 flex flex-col justify-between custom-scrollbar">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                    Casting & Production CV Presets
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Select a curated layout or customize individual sections.
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                    <button
                      onClick={() => handleApplyPreset('actor')}
                      className={`p-2 rounded-xl text-center border text-[11px] font-bold transition ${
                        preset === 'actor'
                          ? 'bg-brand/15 border-brand text-brand'
                          : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      🎭 Actor CV
                    </button>
                    <button
                      onClick={() => handleApplyPreset('director')}
                      className={`p-2 rounded-xl text-center border text-[11px] font-bold transition ${
                        preset === 'director'
                          ? 'bg-brand/15 border-brand text-brand'
                          : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      🎬 Director EPK
                    </button>
                    <button
                      onClick={() => handleApplyPreset('comprehensive')}
                      className={`p-2 rounded-xl text-center border text-[11px] font-bold transition ${
                        preset === 'comprehensive'
                          ? 'bg-brand/15 border-brand text-brand'
                          : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      📋 Full Record
                    </button>
                  </div>
                </div>

                {/* Section Toggles */}
                <div className="space-y-2.5 pt-3 border-t border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Visible Sections & Elements
                  </p>

                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon icon="solar:user-circle-bold" className="text-brand" width="16" />
                      Professional Headshot
                    </span>
                    <input
                      type="checkbox"
                      checked={pdfOptions.includeHeadshot}
                      onChange={(e) => setPdfOptions({ ...pdfOptions, includeHeadshot: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-brand focus:ring-brand"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon icon="solar:ruler-bold" className="text-brand" width="16" />
                      Physical Specs (Height, Eyes, Accents)
                    </span>
                    <input
                      type="checkbox"
                      checked={pdfOptions.includePhysicalSpecs}
                      onChange={(e) => setPdfOptions({ ...pdfOptions, includePhysicalSpecs: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-brand focus:ring-brand"
                    />
                  </label>

                  {/* Commercial Metrics Toggle */}
                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer p-2 rounded-lg bg-white/[0.03] border border-white/10">
                    <div>
                      <span className="flex items-center gap-2 font-bold text-white">
                        <Icon icon="solar:chart-square-bold" className="text-amber-400" width="16" />
                        Commercial Metrics (₦ Box Office Gross)
                      </span>
                      <span className="text-[10px] text-zinc-400 block ml-6">
                        Toggle ON to display box office metrics; toggle OFF for artistic/casting focus.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={pdfOptions.includeMetrics}
                      onChange={(e) => setPdfOptions({ ...pdfOptions, includeMetrics: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-brand focus:ring-brand"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon icon="solar:clapperboard-play-bold" className="text-brand" width="16" />
                      Screen Filmography (Cinema & TV)
                    </span>
                    <input
                      type="checkbox"
                      checked={pdfOptions.includeScreenCredits}
                      onChange={(e) => setPdfOptions({ ...pdfOptions, includeScreenCredits: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-brand focus:ring-brand"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon icon="solar:mask-hamsa-bold" className="text-brand" width="16" />
                      Stage & Live Theatre Productions
                    </span>
                    <input
                      type="checkbox"
                      checked={pdfOptions.includeStageCredits}
                      onChange={(e) => setPdfOptions({ ...pdfOptions, includeStageCredits: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-brand focus:ring-brand"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon icon="solar:medal-star-bold" className="text-brand" width="16" />
                      Major Awards & Accolades
                    </span>
                    <input
                      type="checkbox"
                      checked={pdfOptions.includeAwards}
                      onChange={(e) => setPdfOptions({ ...pdfOptions, includeAwards: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-brand focus:ring-brand"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Icon icon="solar:qr-code-bold" className="text-brand" width="16" />
                      Verified Profile Live QR Code
                    </span>
                    <input
                      type="checkbox"
                      checked={pdfOptions.includeQrCode}
                      onChange={(e) => setPdfOptions({ ...pdfOptions, includeQrCode: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-800 text-brand focus:ring-brand"
                    />
                  </label>
                </div>

                {/* Custom Notes */}
                <div className="pt-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Special Notes / Cover Statement (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g. Currently holding valid US & UK working permits; fluent in French..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-5 border-t border-white/10 mt-4">
                <button
                  onClick={handlePrintPdf}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-brand text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-brand/20 hover:bg-brand/90 transition active:scale-98"
                >
                  <Icon icon="solar:printer-bold" width="18" />
                  Print / Save as PDF
                </button>
                <button
                  onClick={handleCopyProfileLink}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition"
                >
                  <Icon icon="solar:copy-bold" width="15" />
                  Copy Verified Profile Link
                </button>
                <p className="text-[10px] text-zinc-500 text-center mt-1">
                  Tip: In the print dialog, select <strong>"Save as PDF"</strong> for a high-res vector document.
                </p>
              </div>
            </aside>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: SOCIAL JPEG CARD                                            */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {activeTab === 'social' && (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
            <div className="flex min-h-[380px] flex-1 items-center justify-center overflow-auto bg-[#090909] p-5 md:p-8">
              {!previewUrl && !error && (
                <div className="text-center">
                  <Icon icon="solar:magic-stick-3-linear" width="42" className="mx-auto animate-pulse text-brand" />
                  <p className="mt-4 text-sm font-black text-white">Creating your Career Passport…</p>
                  <p className="mt-2 text-xs text-text-muted">Adding your verified profile, credits and scannable link.</p>
                </div>
              )}
              {error && (
                <div className="max-w-sm text-center">
                  <Icon icon="solar:gallery-remove-linear" width="42" className="mx-auto text-brand" />
                  <h2 className="mt-4 text-xl font-black text-white">We couldn’t prepare this passport</h2>
                  <p className="mt-2 text-sm leading-6 text-text-muted">Please check the profile images and try again in a moment.</p>
                </div>
              )}
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={`${person.name} Career Passport preview`}
                  className="max-h-[75vh] w-auto max-w-full rounded-xl shadow-2xl"
                />
              )}
            </div>

            <aside className="w-full shrink-0 border-t border-white/10 p-6 lg:w-[330px] lg:border-l lg:border-t-0 lg:p-8 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.24em] text-brand">Share your story</p>
                <h2 className="mt-3 text-2xl font-black leading-tight text-white">Your career, in one image.</h2>
                <p className="mt-3 text-xs leading-5 text-text-muted">
                  This JPEG is formatted for Instagram stories and WhatsApp status, with a scannable QR code linking to your verified MuviDB profile.
                </p>
              </div>

              <div className="space-y-2 mt-6">
                <button
                  disabled={!blob || sharing}
                  onClick={handleShare}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3.5 text-xs font-black text-white shadow-lg shadow-brand/20 disabled:opacity-40"
                >
                  <Icon icon="solar:share-bold" width="18" />
                  {sharing ? 'Opening share options…' : 'Share to Instagram / WhatsApp'}
                </button>
                <button
                  disabled={!blob}
                  onClick={handleDownloadJpeg}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-xs font-bold text-white hover:border-brand hover:text-brand disabled:opacity-40"
                >
                  <Icon icon="solar:download-minimalistic-linear" width="16" />
                  Download JPEG
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
