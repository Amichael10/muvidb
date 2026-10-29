import React, { useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { authHeaders } from '../../lib/apiAuth';
import { fetchWithLocalClipperAuth } from '../../lib/localClipperFetch';
import { extractRawTextWithLocalOCR } from '../../utils/localCreditOcr';

const LOCAL_CLIPPER_URL = 'http://127.0.0.1:4317';

export default function CriticReviewExtractorBox({
  disabled = false,
  criticId = null,
  onExtracted,
}) {
  const [activeTab, setActiveTab] = useState('ocr'); // 'ocr' | 'youtube'
  const [videoUrl, setVideoUrl] = useState('');
  const [extractingVideo, setExtractingVideo] = useState(false);

  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [extractingOcr, setExtractingOcr] = useState(false);
  const [rawOcrText, setRawOcrText] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const fileInputRef = useRef(null);

  async function processScreenshotDataUrl(dataUrl, mimeType = 'image/png') {
    if (!dataUrl || disabled) return;
    setScreenshotPreview(dataUrl);
    setExtractingOcr(true);
    setStatusMsg({ type: 'info', text: 'Scanning screenshot with OCR & AI Vision…' });
    setRawOcrText('');

    try {
      // Run local Tesseract OCR in parallel as a reliable text source / fallback
      const localTextPromise = extractRawTextWithLocalOCR(dataUrl).catch(() => '');
      const localText = await localTextPromise;
      if (localText) setRawOcrText(localText);

      const response = await fetch('/api/critic-videos?action=extract-ocr', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          image: dataUrl,
          mimeType,
          rawOcrText: localText || '',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (localText) {
          onExtracted?.({
            quote: localText,
            rawText: localText,
            rating: null,
            matchedFilm: null,
          });
          setStatusMsg({
            type: 'success',
            text: 'Extracted text using Local OCR (edit quote below as needed).',
          });
          return;
        }
        throw new Error(data.error || 'Could not extract text from screenshot');
      }

      const finalRaw = data.rawText || localText || '';
      setRawOcrText(finalRaw);

      onExtracted?.({
        quote: data.quote || finalRaw,
        rawText: finalRaw,
        rating: data.rating ?? null,
        matchedFilm: data.matchedFilm || null,
        filmTitle: data.filmTitle || null,
        criticName: data.criticName || null,
      });

      const details = [
        'OCR quote extracted',
        data.matchedFilm?.title ? `Matched film: ${data.matchedFilm.title}` : null,
        data.rating ? `Rating: ${data.rating}/5 ★` : null,
      ].filter(Boolean).join(' · ');

      setStatusMsg({ type: 'success', text: details });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Screenshot OCR failed' });
    } finally {
      setExtractingOcr(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      processScreenshotDataUrl(String(reader.result || ''), file.type || 'image/png');
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(e) {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          processScreenshotDataUrl(String(reader.result || ''), file.type || 'image/png');
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }

  async function handleExtractYouTube() {
    if (!videoUrl.trim() || disabled) return;
    setExtractingVideo(true);
    setStatusMsg({ type: 'info', text: 'Extracting review quote, rating & film from video…' });

    try {
      // Optional: try desktop clipper first if running locally for full transcript
      let clipperTranscript = '';
      try {
        const clipRes = await fetchWithLocalClipperAuth(`${LOCAL_CLIPPER_URL}/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoUrl.trim(), transcribe: 'auto' }),
        });
        if (clipRes.ok) {
          const clipMeta = await clipRes.json().catch(() => ({}));
          clipperTranscript = String(clipMeta.transcript || '');
        }
      } catch {
        // Desktop clipper offline; server-side YouTube extractor handles it
      }

      const response = await fetch('/api/critic-videos?action=extract-youtube', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          url: videoUrl.trim(),
          transcript: clipperTranscript,
          critic_id: criticId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to extract review from video URL');

      onExtracted?.({
        quote: data.quote || '',
        rating: data.rating ?? null,
        reviewUrl: data.videoUrl || videoUrl.trim(),
        matchedFilm: data.matchedFilm || null,
        filmTitle: data.filmTitle || data.videoTitle || null,
        criticName: data.channelTitle || null,
      });

      const details = [
        data.quote ? 'Video review extracted' : 'Video metadata loaded',
        data.matchedFilm?.title ? `Matched film: ${data.matchedFilm.title}` : null,
        data.rating ? `Rating: ${data.rating}/5 ★` : null,
      ].filter(Boolean).join(' · ');

      setStatusMsg({ type: 'success', text: details });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Video extraction failed' });
    } finally {
      setExtractingVideo(false);
    }
  }

  return (
    <div
      onPaste={handlePaste}
      className={`rounded-xl border border-brand/30 bg-brand/5 p-3.5 space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon icon="solar:magic-stick-3-bold" className="w-4 h-4 text-brand" />
          <span className="text-xs font-bold text-text-primary">
            Smart Review Extractor (OCR Screenshot & YouTube)
          </span>
        </div>

        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => { setActiveTab('ocr'); setStatusMsg(null); }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
              activeTab === 'ocr'
                ? 'bg-brand text-on-brand shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon icon="solar:camera-minimalistic-bold" className="w-3.5 h-3.5" />
            Screenshot OCR
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('youtube'); setStatusMsg(null); }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
              activeTab === 'youtube'
                ? 'bg-brand text-on-brand shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon icon="mdi:youtube" className="w-4 h-4" />
            YouTube / Video URL
          </button>
        </div>
      </div>

      {activeTab === 'ocr' ? (
        <div className="space-y-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              disabled={extractingOcr}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 border border-dashed border-brand/40 hover:border-brand bg-surface hover:bg-surface-2 rounded-xl px-4 py-3 text-xs font-bold text-text-primary transition-all"
            >
              {extractingOcr ? (
                <>
                  <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  <span>Extracting Review Text via OCR…</span>
                </>
              ) : (
                <>
                  <Icon icon="solar:upload-minimalistic-bold" className="w-4 h-4 text-brand" />
                  <span>Upload Review Screenshot (or press Ctrl+V to paste)</span>
                </>
              )}
            </button>

            {screenshotPreview && (
              <div className="flex items-center gap-2 bg-surface border border-border rounded-xl p-1.5 pr-3">
                <img
                  src={screenshotPreview}
                  alt="Review screenshot"
                  className="w-10 h-10 rounded-lg object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setScreenshotPreview(null);
                    setRawOcrText('');
                    setStatusMsg(null);
                  }}
                  className="text-[11px] text-red-400 hover:underline font-bold"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {rawOcrText && (
            <div className="bg-surface border border-border rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Extracted Raw OCR Text
                </span>
                <button
                  type="button"
                  onClick={() => onExtracted?.({ quote: rawOcrText, rawText: rawOcrText })}
                  className="text-[10px] font-bold text-brand hover:underline"
                >
                  Use Full Raw Text as Quote
                </button>
              </div>
              <p className="text-[11px] text-text-muted max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {rawOcrText}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Icon
              icon="mdi:youtube"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500"
            />
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="Paste YouTube, Instagram Reel, or TikTok review link..."
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-primary focus:border-brand outline-none"
            />
          </div>
          <button
            type="button"
            disabled={extractingVideo || !videoUrl.trim()}
            onClick={handleExtractYouTube}
            className="bg-brand text-on-brand font-bold px-4 py-2 rounded-xl hover:bg-brand-hover transition-colors text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            {extractingVideo ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-on-brand border-t-transparent rounded-full animate-spin" />
                <span>Extracting…</span>
              </>
            ) : (
              <>
                <Icon icon="solar:magic-stick-bold" className="w-4 h-4" />
                <span>Extract Review</span>
              </>
            )}
          </button>
        </div>
      )}

      {statusMsg && (
        <div
          className={`px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
            statusMsg.type === 'success'
              ? 'bg-green-500/10 text-green-500 border border-green-500/30'
              : statusMsg.type === 'error'
              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
              : 'bg-brand/10 text-brand border border-brand/20'
          }`}
        >
          <Icon
            icon={
              statusMsg.type === 'success'
                ? 'solar:check-circle-bold'
                : statusMsg.type === 'error'
                ? 'solar:danger-triangle-bold'
                : 'solar:info-circle-bold'
            }
            className="w-4 h-4 flex-shrink-0"
          />
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
}

