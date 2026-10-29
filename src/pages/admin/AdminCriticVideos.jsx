import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import FilmSearchCombobox from '../../components/admin/FilmSearchCombobox';
import { authHeaders } from '../../lib/apiAuth';
import { fetchWithLocalClipperAuth } from '../../lib/localClipperFetch';
import { fetchCritics, upsertCriticReview } from '../../lib/critics';
import CriticReviewExtractorBox from '../../components/admin/CriticReviewExtractorBox';

const LOCAL_CLIPPER_URL = 'http://127.0.0.1:4317';
const API = '/api/critic-videos';

const RATING_OPTIONS = [
  { value: '', label: '— No Rating —' },
  { value: '1', label: '1 ★ (2/10)' },
  { value: '1.5', label: '1.5 ★ (3/10)' },
  { value: '2', label: '2 ★★ (4/10)' },
  { value: '2.5', label: '2.5 ★★ (5/10)' },
  { value: '3', label: '3 ★★★ (6/10)' },
  { value: '3.5', label: '3.5 ★★★ (7/10)' },
  { value: '4', label: '4 ★★★★ (8/10)' },
  { value: '4.5', label: '4.5 ★★★★ (9/10)' },
  { value: '5', label: '5 ★★★★★ (10/10)' },
];

function timecode(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const PLATFORM_ICONS = {
  youtube: 'mdi:youtube',
  instagram: 'mdi:instagram',
  tiktok: 'ic:baseline-music-note',
  other: 'mdi:video-outline',
};

async function callApi(action, { method = 'GET', body, params } = {}) {
  const search = new URLSearchParams({ action, ...(params || {}) });
  const response = await fetch(`${API}?${search}`, {
    method,
    headers: await authHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export default function AdminCriticVideos() {
  const [clipperStatus, setClipperStatus] = useState('checking');
  const [awaiting, setAwaiting] = useState([]);
  const [queue, setQueue] = useState([]);
  const [critics, setCritics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [queueStatus, setQueueStatus] = useState('pending_review');

  const [submitUrl, setSubmitUrl] = useState('');
  const [submitCriticId, setSubmitCriticId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [instantCriticId, setInstantCriticId] = useState('');
  const [instantFilmId, setInstantFilmId] = useState('');
  const [instantQuote, setInstantQuote] = useState('');
  const [instantRating, setInstantRating] = useState('');
  const [instantUrl, setInstantUrl] = useState('');
  const [instantTranscript, setInstantTranscript] = useState('');
  const [publishingInstant, setPublishingInstant] = useState(false);
  const editorCardRef = useRef(null);

  const criticsById = useMemo(
    () => Object.fromEntries(critics.map(critic => [critic.id, critic])),
    [critics],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, reviewQueue] = await Promise.all([
        callApi('pending', { params: { limit: '25' } }),
        callApi('review-queue', { params: { limit: '50', status: queueStatus } }),
      ]);
      setAwaiting(pending.candidates || []);
      setQueue(reviewQueue.candidates || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [queueStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchCritics().then(setCritics).catch(() => setCritics([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetchWithLocalClipperAuth(`${LOCAL_CLIPPER_URL}/health`, { method: 'GET' });
        if (!cancelled) setClipperStatus(response.ok ? 'running' : 'offline');
      } catch {
        if (!cancelled) setClipperStatus('offline');
      }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  function startDesktopClipper() {
    try {
      const launcher = document.createElement('a');
      launcher.href = 'muvidb-clipper://start';
      launcher.style.display = 'none';
      document.body.appendChild(launcher);
      launcher.click();
      launcher.remove();
      toast.success('Starting the desktop clipper… a separate PowerShell window should open.');
      window.setTimeout(async () => {
        try {
          const response = await fetchWithLocalClipperAuth(`${LOCAL_CLIPPER_URL}/health`, { method: 'GET' });
          if (response.ok) setClipperStatus('running');
        } catch {}
      }, 2500);
    } catch {
      toast.error('Install the MuviDB clipper launcher on this computer first.');
    }
  }

  function stopDesktopClipper() {
    try {
      const launcher = document.createElement('a');
      launcher.href = 'muvidb-clipper://stop';
      launcher.style.display = 'none';
      document.body.appendChild(launcher);
      launcher.click();
      launcher.remove();
      toast.success('Stopping the desktop clipper…');
    } catch {
      toast.error('Could not stop the desktop clipper.');
    }
  }

  /** Fetch one transcript, populate the editable box at the top (just like OCR), and update the queue. */
  async function fetchTranscript(candidate) {
    setBusyId(candidate.id);
    try {
      let transcript = '';
      let source = 'captions';

      if (clipperStatus === 'running') {
        try {
          const response = await fetchWithLocalClipperAuth(`${LOCAL_CLIPPER_URL}/metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: candidate.video_url, transcribe: 'auto' }),
          });
          const meta = await response.json().catch(() => ({}));
          if (response.ok && String(meta.transcript || '').trim()) {
            transcript = String(meta.transcript || '').trim();
            source = meta.transcript_source === 'whisper' ? 'whisper' : 'captions';
          }
        } catch {
          // Fall back to server YouTube extraction below
        }
      }

      if (transcript) {
        const result = await callApi('transcript', {
          method: 'POST',
          body: { video_id: candidate.video_id, transcript, source },
        });
        const cleanRaw = (result.transcript || transcript).replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
        setInstantTranscript(cleanRaw);
        if (result.quote) setInstantQuote(result.quote);
        if (result.rating != null) setInstantRating(String(result.rating));
        if (candidate.video_url) setInstantUrl(candidate.video_url);
        if (candidate.film_id) setInstantFilmId(candidate.film_id);
        if (candidate.critic_id) setInstantCriticId(candidate.critic_id);

        if (result.status === 'failed') {
          toast.error(`Loaded raw transcript into editor (${result.reason})`);
        } else {
          toast.success(`Transcript & quote extracted${result.rating ? ` · rated ${result.rating}/5` : ''} — review & edit above!`);
        }
        editorCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        await load();
        return;
      }

      // Fallback when desktop clipper is offline or video had no captions: extract via server YouTube API
      const fallback = await callApi('extract-youtube', {
        method: 'POST',
        body: {
          url: candidate.video_url,
          title: candidate.video_title,
          critic_id: candidate.critic_id || null,
        },
      });
      if (fallback.quote) setInstantQuote(fallback.quote);
      if (fallback.rating != null) setInstantRating(String(fallback.rating));
      if (candidate.video_url) setInstantUrl(candidate.video_url);
      if (fallback.matchedFilm?.id) setInstantFilmId(fallback.matchedFilm.id);
      else if (candidate.film_id) setInstantFilmId(candidate.film_id);
      if (candidate.critic_id) setInstantCriticId(candidate.critic_id);
      else if (fallback.channelTitle) {
        const found = critics.find(
          c => c.name?.toLowerCase().includes(fallback.channelTitle.toLowerCase()) ||
               c.publication?.toLowerCase().includes(fallback.channelTitle.toLowerCase())
        );
        if (found) setInstantCriticId(found.id);
      }

      toast.success('Extracted review into the editor above — review & edit before publishing!');
      editorCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  }

  async function fetchAll() {
    for (const candidate of awaiting) {
      await fetchTranscript(candidate);
    }
  }

  async function act(action, candidate, body) {
    setBusyId(candidate.id);
    try {
      const result = await callApi(action, { method: 'POST', body: { id: candidate.id, ...body } });
      toast.success(
        action === 'approve' ? 'Published to the film page' :
        action === 'reject' ? 'Rejected' : 'Saved',
      );
      await load();
      return result;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function submitByUrl(event) {
    event.preventDefault();
    if (!submitUrl.trim()) return;
    setSubmitting(true);
    try {
      const result = await callApi('submit', {
        method: 'POST',
        body: { url: submitUrl.trim(), critic_id: submitCriticId || null },
      });
      toast.success(`Queued a ${result.platform} review`);
      setSubmitUrl('');
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function pollChannels() {
    try {
      const result = await callApi('poll', { method: 'POST', body: { limit: 20 } });
      toast.success(`Checked ${result.channels} channels · queued ${result.queued}`);
      if (result.errors?.length) toast.error(`${result.errors.length} channel(s) failed`);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <SEO title="Video Critic Reviews · Admin" noindex />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Video Critic Reviews</h1>
          <p className="text-sm opacity-70 mt-1 max-w-2xl">
            Reviews published as video rather than as articles. Transcripts are fetched by the
            desktop clipper on this computer, because YouTube blocks the server&apos;s IP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clipperStatus === 'running' ? stopDesktopClipper : startDesktopClipper}
            className={`px-3 py-2 text-sm rounded-md font-medium flex items-center gap-1.5 border ${
              clipperStatus === 'running'
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-brand text-on-brand border-brand hover:bg-brand-hover'
            }`}
            title="Start or stop the local FFmpeg/YouTube desktop video clipper"
          >
            <Icon icon={clipperStatus === 'running' ? 'solar:check-circle-bold' : 'solar:laptop-minimalistic-bold'} className="w-4 h-4" />
            <span>{clipperStatus === 'running' ? 'Clipper Ready' : 'Start Clipper'}</span>
          </button>
          <button type="button" onClick={pollChannels}
            className="px-3 py-2 text-sm rounded-md border border-current/20 hover:bg-current/5">
            <Icon icon="mdi:magnify-scan" className="inline mr-1" />
            Check channels
          </button>
          <button type="button" onClick={load}
            className="px-3 py-2 text-sm rounded-md border border-current/20 hover:bg-current/5">
            <Icon icon="mdi:refresh" className="inline mr-1" />
            Refresh
          </button>
        </div>
      </div>

      <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 mb-6 ${
        clipperStatus === 'running'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
      }`}>
        <Icon icon={clipperStatus === 'running' ? 'mdi:check-circle' : 'mdi:alert-circle'} />
        <span>
          {clipperStatus === 'running'
            ? 'Desktop clipper connected — transcripts can be fetched.'
            : clipperStatus === 'checking'
              ? 'Looking for the desktop clipper…'
              : 'Desktop clipper offline. Start it to fetch transcripts; everything else still works.'}
        </span>
        {clipperStatus !== 'running' && (
          <button
            type="button"
            onClick={startDesktopClipper}
            className="ml-auto px-3 py-1 rounded-md text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1 shrink-0"
          >
            <Icon icon="solar:laptop-minimalistic-bold" className="w-3.5 h-3.5" />
            <span>Start Clipper</span>
          </button>
        )}
      </div>

      {/* Instant OCR Screenshot & YouTube Review Extractor */}
      <div ref={editorCardRef} className="rounded-xl border border-current/15 p-4 mb-6 space-y-4">
        <div>
          <h2 className="font-medium mb-1">Extract Review from Screenshot (OCR) or YouTube URL</h2>
          <p className="text-sm opacity-70">
            Upload or paste (Ctrl+V) a review screenshot, paste a YouTube review URL, or click &ldquo;Fetch transcript&rdquo; below to inspect and edit the extracted quote before publishing.
          </p>
        </div>

        <CriticReviewExtractorBox
          criticId={instantCriticId || null}
          onExtracted={({ quote, rawText, rating, reviewUrl, matchedFilm, criticName }) => {
            if (quote) setInstantQuote(quote);
            if (rawText) setInstantTranscript(rawText);
            if (rating != null) setInstantRating(String(rating));
            if (reviewUrl) setInstantUrl(reviewUrl);
            if (matchedFilm?.id) setInstantFilmId(matchedFilm.id);
            if (criticName && !instantCriticId) {
              const found = critics.find(
                c => c.name?.toLowerCase().includes(criticName.toLowerCase()) ||
                     c.publication?.toLowerCase().includes(criticName.toLowerCase())
              );
              if (found) setInstantCriticId(found.id);
            }
          }}
        />

        {instantTranscript && (
          <div className="rounded-lg border border-current/15 bg-current/5 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                Fetched Video Transcript / Raw Text
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setInstantQuote(instantTranscript)}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Use Full Transcript as Quote
                </button>
                <button
                  type="button"
                  onClick={() => setInstantTranscript('')}
                  className="text-xs opacity-60 hover:opacity-100"
                >
                  Hide
                </button>
              </div>
            </div>
            <p className="text-xs opacity-80 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {instantTranscript}
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs opacity-70 mb-1">Critic *</label>
            <select
              value={instantCriticId}
              onChange={e => setInstantCriticId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-transparent border border-current/20 text-sm"
            >
              <option value="">Choose critic…</option>
              {critics.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.publication ? ` (${c.publication})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs opacity-70 mb-1">Film *</label>
            <FilmSearchCombobox value={instantFilmId} onChange={setInstantFilmId} />
          </div>
        </div>

        <div>
          <label className="block text-xs opacity-70 mb-1">Extracted Review Quote (Editable) *</label>
          <textarea
            rows={3}
            value={instantQuote}
            onChange={e => setInstantQuote(e.target.value)}
            placeholder="Extracted quote will appear here (editable)…"
            className="w-full px-3 py-2 rounded-md bg-transparent border border-current/20 text-sm"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs opacity-70 mb-1">Rating (1–5 or /10 equivalent)</label>
            <select
              value={instantRating}
              onChange={e => setInstantRating(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-transparent border border-current/20 text-sm"
            >
              {RATING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs opacity-70 mb-1">Review Source URL (Optional)</label>
            <input
              type="url"
              value={instantUrl}
              onChange={e => setInstantUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full px-3 py-2 rounded-md bg-transparent border border-current/20 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={publishingInstant || !instantCriticId || !instantFilmId || !instantQuote.trim()}
            onClick={async () => {
              setPublishingInstant(true);
              try {
                const critic = criticsById[instantCriticId] || {};
                await upsertCriticReview({
                  critic_id: instantCriticId,
                  film_id: instantFilmId,
                  quote: instantQuote.trim(),
                  rating: instantRating !== '' ? Number(instantRating) : null,
                  review_url: instantUrl.trim() || null,
                  publication: critic.publication || null,
                  critic_name: critic.name || 'Film critic',
                });
                toast.success('Critic review published!');
                setInstantQuote('');
                setInstantRating('');
                setInstantUrl('');
                setInstantTranscript('');
              } catch (err) {
                toast.error(err.message || 'Failed to publish review');
              } finally {
                setPublishingInstant(false);
              }
            }}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            {publishingInstant ? 'Publishing…' : 'Publish Review Now'}
          </button>
        </div>
      </div>

      <form onSubmit={submitByUrl} className="rounded-lg border border-current/15 p-4 mb-8">
        <h2 className="font-medium mb-1">Add a review by link</h2>
        <p className="text-sm opacity-70 mb-3">
          For critics who post on Instagram or TikTok, or a one-off a channel sweep missed.
          YouTube, Instagram and TikTok links are accepted.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={submitUrl}
            onChange={event => setSubmitUrl(event.target.value)}
            placeholder="https://www.instagram.com/reel/…"
            className="flex-1 px-3 py-2 rounded-md bg-transparent border border-current/20"
          />
          <select
            value={submitCriticId}
            onChange={event => setSubmitCriticId(event.target.value)}
            className="px-3 py-2 rounded-md bg-transparent border border-current/20"
          >
            <option value="">Attribute later…</option>
            {critics.map(critic => (
              <option key={critic.id} value={critic.id}>{critic.name}</option>
            ))}
          </select>
          <button type="submit" disabled={submitting || !submitUrl.trim()}
            className="px-4 py-2 rounded-md bg-current/10 hover:bg-current/20 disabled:opacity-50">
            {submitting ? 'Queueing…' : 'Queue'}
          </button>
        </div>
      </form>

      {/* ── Awaiting a transcript ─────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-medium">
            Awaiting transcript
            <span className="ml-2 text-sm opacity-60">{awaiting.length}</span>
          </h2>
          {awaiting.length > 1 && (
            <button type="button" onClick={fetchAll} disabled={Boolean(busyId)}
              className="px-3 py-1.5 text-sm rounded-md border border-current/20 hover:bg-current/5 disabled:opacity-50">
              Fetch all {awaiting.length}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm opacity-60">Loading…</p>
        ) : awaiting.length === 0 ? (
          <p className="text-sm opacity-60">Nothing waiting. Use “Check channels” to look for new uploads.</p>
        ) : (
          <ul className="space-y-2">
            {awaiting.map(candidate => (
              <li key={candidate.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-current/15 p-3">
                <div className="min-w-0 flex-1">
                  <a href={candidate.video_url} target="_blank" rel="noreferrer"
                    className="font-medium hover:underline break-words">
                    {candidate.video_title || candidate.video_url}
                  </a>
                  {!candidate.film_id && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      No film matched yet — assign one after the quote is extracted.
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => fetchTranscript(candidate)}
                  disabled={busyId === candidate.id}
                  className="px-3 py-1.5 text-sm rounded-md bg-current/10 hover:bg-current/20 disabled:opacity-50">
                  {busyId === candidate.id ? 'Fetching…' : 'Fetch transcript'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Review and approve ────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-medium">
            Review queue
            <span className="ml-2 text-sm opacity-60">{queue.length}</span>
          </h2>
          <div className="flex gap-1 text-sm">
            {['pending_review', 'failed', 'approved', 'rejected'].map(status => (
              <button key={status} type="button" onClick={() => setQueueStatus(status)}
                className={`px-2.5 py-1 rounded-md ${
                  queueStatus === status ? 'bg-current/15 font-medium' : 'hover:bg-current/5 opacity-70'
                }`}>
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm opacity-60">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm opacity-60">Nothing here.</p>
        ) : (
          <ul className="space-y-4">
            {queue.map(candidate => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                critics={critics}
                criticsById={criticsById}
                busy={busyId === candidate.id}
                onAct={act}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CandidateCard({ candidate, critics, criticsById, busy, onAct }) {
  const [filmId, setFilmId] = useState(candidate.film_id || '');
  const [criticId, setCriticId] = useState(candidate.critic_id || '');
  const [editedQuote, setEditedQuote] = useState(candidate.quote || '');
  const [editedRating, setEditedRating] = useState(candidate.rating != null ? String(candidate.rating) : '');
  const [showTranscript, setShowTranscript] = useState(false);

  const platform = candidate.source_platform || 'youtube';
  const stamp = timecode(candidate.quote_start_seconds);
  const verifiable = platform === 'youtube' && candidate.quote_start_seconds != null;
  const quoteLink = verifiable
    ? `https://www.youtube.com/watch?v=${candidate.video_id}&t=${Math.floor(candidate.quote_start_seconds)}`
    : candidate.video_url;

  const decided = candidate.status === 'approved' || candidate.status === 'rejected';
  const needsCritic = !criticId && !candidate.critic_channel_id;

  return (
    <li className="rounded-lg border border-current/15 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <a href={candidate.video_url} target="_blank" rel="noreferrer"
          className="font-medium hover:underline break-words flex items-center gap-1.5">
          <Icon icon={PLATFORM_ICONS[platform] || PLATFORM_ICONS.other} />
          {candidate.video_title || candidate.video_url}
        </a>
        <div className="flex items-center gap-2">
          {candidate.transcript && (
            <button
              type="button"
              onClick={() => setShowTranscript(prev => !prev)}
              className="text-xs px-2.5 py-1 rounded border border-current/20 hover:bg-current/5"
            >
              {showTranscript ? 'Hide Transcript' : 'View Full Transcript'}
            </button>
          )}
          {editedRating && (
            <span className="text-sm px-2 py-0.5 rounded bg-current/10 shrink-0">{editedRating} / 5</span>
          )}
        </div>
      </div>

      {showTranscript && candidate.transcript && (
        <div className="rounded-lg border border-current/15 bg-current/5 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Full Video Transcript
            </span>
            <button
              type="button"
              onClick={() => setEditedQuote(candidate.transcript)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Copy Full Transcript into Quote
            </button>
          </div>
          <p className="text-xs opacity-80 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {candidate.transcript}
          </p>
        </div>
      )}

      {candidate.status === 'failed' && !editedQuote ? (
        <p className="text-sm rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 px-3 py-2">
          {candidate.last_error || 'Extraction failed — paste or type a quote below to approve anyway.'}
        </p>
      ) : null}

      {!decided ? (
        <div>
          <label className="block text-xs opacity-70 mb-1">Review Quote (Editable)</label>
          <textarea
            rows={3}
            value={editedQuote}
            onChange={e => setEditedQuote(e.target.value)}
            placeholder="Edit or type the critic's review quote here…"
            className="w-full px-3 py-2 rounded-md bg-transparent border border-current/20 text-sm"
          />
          {candidate.excerpt_context && (
            <p className="text-xs opacity-70 mt-1">{candidate.excerpt_context}</p>
          )}
        </div>
      ) : (
        <blockquote className="border-l-2 border-current/30 pl-3 italic">
          “{candidate.quote}”
        </blockquote>
      )}

      <div className="text-sm">
        {verifiable ? (
          <a href={quoteLink} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline">
            <Icon icon="mdi:play-circle-outline" />
            Hear it at {stamp} — check the quote before approving
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Icon icon="mdi:alert-outline" />
            {platform === 'youtube'
              ? 'Open the video to verify the quote or inspect the transcript above.'
              : `${platform} has no timestamp links — open the post and check the quote by hand.`}
          </span>
        )}
      </div>

      {!decided && (
        <div className="pt-3 border-t border-current/10 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">Film</label>
              <FilmSearchCombobox
                value={filmId}
                onChange={async nextId => {
                  setFilmId(nextId);
                  if (nextId && nextId !== candidate.film_id) {
                    await onAct('assign-film', candidate, { film_id: nextId });
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Critic{needsCritic && <span className="text-amber-600 dark:text-amber-400"> · required</span>}
              </label>
              <select
                value={criticId}
                onChange={async event => {
                  const nextId = event.target.value;
                  setCriticId(nextId);
                  if (nextId) await onAct('attribute', candidate, { critic_id: nextId });
                }}
                className="w-full px-3 py-2 rounded-md bg-transparent border border-current/20 text-sm"
              >
                <option value="">
                  {candidate.critic_channel_id ? 'From the channel' : 'Choose a critic…'}
                </option>
                {critics.map(critic => (
                  <option key={critic.id} value={critic.id}>{critic.name}</option>
                ))}
              </select>
              {criticId && criticsById[criticId] && (
                <p className="text-xs opacity-60 mt-1">
                  Publishes as {criticsById[criticId].name}
                  {criticsById[criticId].publication ? ` · ${criticsById[criticId].publication}` : ''}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs opacity-70 mb-1">Rating (1–5 or /10 equivalent)</label>
              <select
                value={editedRating}
                onChange={e => setEditedRating(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-transparent border border-current/20 text-sm"
              >
                {RATING_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !filmId || !editedQuote.trim()}
              onClick={() => onAct('approve', candidate, {
                quote: editedQuote.trim(),
                rating: editedRating === '' ? null : Number(editedRating),
                film_id: filmId,
                ...(criticId ? { critic_id: criticId } : {}),
              })}
              className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? 'Working…' : 'Approve and publish'}
            </button>
            <button type="button" disabled={busy} onClick={() => onAct('reject', candidate)}
              className="px-4 py-2 text-sm rounded-md border border-current/20 hover:bg-current/5 disabled:opacity-50">
              Reject
            </button>
            {!filmId && (
              <span className="self-center text-xs opacity-70">Assign a film to enable approval.</span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
