import { useState } from 'react'
import { searchTrailer } from '../../utils/youtube'
import { queueTrailerForReview, approveTrailer } from '../../utils/syncService'
import { supabase } from '../../lib/supabase'

const TrailerSearch = ({ film, onTrailerSaved, currentUserId }) => {
  const [source, setSource] = useState(
    film.trailer_source || 'youtube'
  )
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [manualId, setManualId] = useState(film.trailer_youtube_id || '')
  const [externalUrl, setExternalUrl] = useState(film.trailer_external_url || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSearch = async () => {
    setSearching(true)
    setResults([])
    setMessage(null)

    const candidates = await searchTrailer(film.title)
    
    if (candidates.length === 0) {
      setMessage({ 
        type: 'warning', 
        text: 'No trailers found. Try entering the YouTube ID manually.' 
      })
    } else {
      await queueTrailerForReview(film.id, candidates)
      setResults(candidates)
    }
    setSearching(false)
  }

  const handleApprove = async (candidate) => {
    setSaving(true)
    const result = await approveTrailer(
      candidate.queueId || 'direct',
      film.id,
      candidate.videoId,
      currentUserId
    )
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Trailer saved and stats synced!' })
      onTrailerSaved?.()
    } else {
      setMessage({ type: 'error', text: result.error })
    }
    setSaving(false)
  }

  const handleManualSave = async () => {
    if (!manualId.trim()) return
    setSaving(true)
    
    // Extract video ID from full URL if pasted
    let videoId = manualId.trim()
    if (videoId.includes('youtube.com/watch?v=')) {
      videoId = new URL(videoId).searchParams.get('v')
    } else if (videoId.includes('youtu.be/')) {
      videoId = videoId.split('youtu.be/')[1].split('?')[0]
    }

    await handleApprove({ videoId })
    setSaving(false)
  }

  const handleExternalSave = async () => {
    if (!externalUrl.trim()) return
    setSaving(true)

    await supabase
      .from('films')
      .update({
        trailer_source: 'external',
        trailer_external_url: externalUrl.trim(),
        trailer_youtube_id: null
      })
      .eq('id', film.id)

    setMessage({ type: 'success', text: 'External trailer URL saved!' })
    setSaving(false)
    onTrailerSaved?.()
  }

  const handleSetNone = async () => {
    await supabase
      .from('films')
      .update({
        trailer_source: 'none',
        trailer_youtube_id: null,
        trailer_external_url: null
      })
      .eq('id', film.id)

    setMessage({ type: 'success', text: 'Trailer set to "coming soon"' })
    onTrailerSaved?.()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-muted mb-3">Trailer Source</p>
        
        {/* Source selector */}
        <div className="flex gap-3">
          {['youtube', 'external', 'none'].map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                source === s
                  ? 'bg-gold text-dark'
                  : 'bg-surface-2 text-text-muted hover:text-text-primary'
              }`}
            >
              {s === 'youtube' ? '▶ YouTube' : 
               s === 'external' ? '🔗 External URL' : 
               '✕ No Trailer'}
            </button>
          ))}
        </div>
      </div>

      {/* ── YouTube flow ── */}
      {source === 'youtube' && (
        <div className="space-y-4">
          
          {/* Auto search */}
          <div>
            <p className="text-sm text-text-muted mb-2">
              Search YouTube for "{film.title}" trailer
            </p>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="flex items-center gap-2 bg-surface-2 hover:bg-surface text-text-primary px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            >
              {searching ? (
                <>
                  <span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  Searching YouTube...
                </>
              ) : (
                <>🔍 Search YouTube</>
              )}
            </button>
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Select the correct trailer — do not guess:
              </p>
              {results.map((result, i) => (
                <div
                  key={result.videoId}
                  className="flex gap-3 p-3 bg-surface-2 rounded-xl border border-border hover:border-gold/50 transition-all"
                >
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium line-clamp-2">
                      {result.title}
                    </p>
                    <p className="text-text-muted text-xs mt-1">
                      {result.channelTitle} · {result.duration} · {result.viewCount.toLocaleString()} views
                    </p>
                    {/* Confidence indicator */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            result.confidence >= 70 ? 'bg-green-500' :
                            result.confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${result.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-muted">
                        {result.confidence >= 70 ? '✓ Likely trailer' :
                         result.confidence >= 40 ? '? Possible' : '✗ Unlikely'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleApprove(result)}
                    disabled={saving}
                    className="self-center flex-shrink-0 bg-gold text-dark text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gold/90 transition-all disabled:opacity-50"
                  >
                    Use This
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Manual entry */}
          <div>
            <p className="text-sm text-text-muted mb-2">
              Or enter YouTube URL / Video ID manually:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or video ID"
                className="flex-1 bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none"
              />
              <button
                onClick={handleManualSave}
                disabled={saving || !manualId.trim()}
                className="bg-gold text-dark font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          {/* Preview if ID exists */}
          {film.trailer_youtube_id && (
            <div>
              <p className="text-sm text-text-muted mb-2">Current trailer:</p>
              <img
                src={`https://img.youtube.com/vi/${film.trailer_youtube_id}/hqdefault.jpg`}
                alt="Current trailer thumbnail"
                className="w-48 rounded-xl"
              />
              <p className="text-xs text-text-muted mt-1">
                ID: {film.trailer_youtube_id}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── External URL flow ── */}
      {source === 'external' && (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Paste the URL where the trailer is hosted (Prime Video, 
            Netflix, Vimeo, studio website, etc.)
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={externalUrl}
              onChange={e => setExternalUrl(e.target.value)}
              placeholder="https://www.primevideo.com/..."
              className="flex-1 bg-bg border border-border text-text-primary rounded-xl px-4 py-2 text-sm focus:border-gold focus:outline-none"
            />
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-2 text-text-muted px-3 py-2 rounded-xl text-sm hover:text-text-primary transition-colors"
            >
              Preview ↗
            </a>
          </div>
          <button
            onClick={handleExternalSave}
            disabled={saving || !externalUrl.trim()}
            className="bg-gold text-dark font-semibold px-6 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            Save External URL
          </button>
          <p className="text-xs text-text-muted">
            Note: View counts won't be tracked for external trailers.
          </p>
        </div>
      )}

      {/* ── No trailer flow ── */}
      {source === 'none' && (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            The film page will show "Trailer coming soon" 
            until a trailer is added.
          </p>
          <button
            onClick={handleSetNone}
            className="bg-surface-2 text-text-primary font-semibold px-6 py-2 rounded-xl text-sm hover:bg-surface transition-all"
          >
            Confirm — No Trailer
          </button>
        </div>
      )}

      {/* Message display */}
      {message && (
        <div className={`p-3 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-800' :
          message.type === 'warning' ? 'bg-amber-900/30 text-amber-400 border border-amber-800' :
          'bg-red-900/30 text-red-400 border border-red-800'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

export default TrailerSearch