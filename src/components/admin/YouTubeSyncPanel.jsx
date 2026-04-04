import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { syncAllFilmStats, syncSingleFilmStats } from '../../utils/syncService'
import { formatViewCount } from '../../utils/youtube'
import AddChannel from './AddChannel'

const YouTubeSyncPanel = ({ currentUserId }) => {
  const [films, setFilms] = useState([])
  const [channels, setChannels] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(null)
  const [syncResult, setSyncResult] = useState(null)
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [{ data: filmsData }, { data: channelsData }, { data: statsData }] = 
      await Promise.all([
        supabase
          .from('films')
          .select('id, title, trailer_youtube_id, trailer_source, view_count')
          .order('view_count', { ascending: false }),
        supabase
          .from('youtube_channels')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('youtube_stats')
          .select('synced_at')
          .order('synced_at', { ascending: false })
          .limit(1)
      ])

    setFilms(filmsData || [])
    setChannels(channelsData || [])
    if (statsData?.[0]) setLastSynced(statsData[0].synced_at)
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    setSyncResult(null)
    setSyncProgress({ stage: 'fetching', total: 0, done: 0 })

    const result = await syncAllFilmStats((progress) => {
      setSyncProgress(progress)
    })

    setSyncResult(result)
    setSyncing(false)
    if (result.success) {
      loadData()
    }
  }

  const handleSyncSingle = async (filmId, filmTitle) => {
    const result = await syncSingleFilmStats(filmId)
    if (result.success) {
      loadData()
    }
    return result
  }

  const handleToggleChannel = async (channelId, isActive) => {
    await supabase
      .from('youtube_channels')
      .update({ is_active: !isActive })
      .eq('id', channelId)
    loadData()
  }

  const handleDeleteChannel = async (channelId) => {
    await supabase
      .from('youtube_channels')
      .delete()
      .eq('id', channelId)
    loadData()
  }

  const filmsWithYouTube = films.filter(
    f => f.trailer_source === 'youtube' && f.trailer_youtube_id
  )
  const filmsMissingTrailer = films.filter(
    f => !f.trailer_youtube_id && f.trailer_source === 'youtube'
  )

  return (
    <div className="space-y-8">

      {/* ── Sync Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Films', value: films.length, color: 'text-gold' },
          { label: 'With YouTube ID', value: filmsWithYouTube.length, color: 'text-green-400' },
          { label: 'Missing Trailer', value: filmsMissingTrailer.length, color: 'text-amber-400' },
          { label: 'Active Channels', value: channels.filter(c => c.is_active).length, color: 'text-blue-400' }
        ].map(stat => (
          <div key={stat.label} className="bg-surface rounded-2xl p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-text-muted text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Sync Button ── */}
      <div className="bg-surface rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-text-primary font-semibold text-lg">
              Sync All Film Stats
            </h3>
            <p className="text-text-muted text-sm mt-1">
              Last synced: {lastSynced 
                ? new Date(lastSynced).toLocaleString() 
                : 'Never'}
            </p>
          </div>
          <button
            onClick={handleSyncAll}
            disabled={syncing || filmsWithYouTube.length === 0}
            className="flex items-center gap-2 bg-gold text-dark font-semibold px-6 py-3 rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50"
          >
            {syncing ? (
              <>
                <span className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>🔄 Sync All Films</>
            )}
          </button>
        </div>

        {/* Progress bar */}
        {syncProgress && syncing && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-text-muted">
              <span>
                {syncProgress.stage === 'fetching' 
                  ? 'Fetching from YouTube...' 
                  : `Saving: ${syncProgress.currentFilm || '...'}`}
              </span>
              <span>{syncProgress.done} / {syncProgress.total}</span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-300"
                style={{ 
                  width: syncProgress.total > 0 
                    ? `${(syncProgress.done / syncProgress.total) * 100}%` 
                    : '20%' 
                }}
              />
            </div>
          </div>
        )}

        {/* Sync result */}
        {syncResult && !syncing && (
          <div className={`mt-4 p-3 rounded-xl text-sm ${
            syncResult.success 
              ? 'bg-green-900/30 text-green-400 border border-green-800'
              : 'bg-red-900/30 text-red-400 border border-red-800'
          }`}>
            {syncResult.message}
            {syncResult.errors?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs opacity-80">
                {syncResult.errors.map((e, i) => (
                  <li key={i}>⚠ {e.film}: {e.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-xs text-text-muted mt-3">
          Uses ~{filmsWithYouTube.length} quota units 
          (free tier: 10,000/day)
        </p>
      </div>

      {/* ── Films Table ── */}
      <div className="bg-surface rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-text-primary font-semibold">Films</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="text-left p-4">Film</th>
                <th className="text-left p-4">YouTube ID</th>
                <th className="text-left p-4">Views</th>
                <th className="text-left p-4">Source</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {films.map(film => (
                <tr key={film.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                  <td className="p-4 text-text-primary font-medium">
                    {film.title}
                  </td>
                  <td className="p-4">
                    {film.trailer_youtube_id ? (
                      <a
                        href={`https://youtube.com/watch?v=${film.trailer_youtube_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold font-mono text-xs hover:underline"
                      >
                        {film.trailer_youtube_id}
                      </a>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="p-4 text-text-primary">
                    {film.view_count > 0 
                      ? formatViewCount(film.view_count)
                      : <span className="text-text-muted">—</span>
                    }
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      film.trailer_source === 'youtube' 
                        ? 'bg-red-900/40 text-red-400'
                        : film.trailer_source === 'external'
                        ? 'bg-blue-900/40 text-blue-400'
                        : 'bg-surface-2 text-text-muted'
                    }`}>
                      {film.trailer_source}
                    </span>
                  </td>
                  <td className="p-4">
                    {film.trailer_youtube_id && (
                      <button
                        onClick={() => handleSyncSingle(film.id, film.title)}
                        className="text-gold hover:text-gold/70 text-xs transition-colors"
                        title="Sync this film's stats"
                      >
                        🔄 Sync
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Channels ── */}
      <div className="bg-surface rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-text-primary font-semibold">
            Trusted Channels ({channels.length})
          </h3>
          <button
            onClick={() => setShowAddChannel(!showAddChannel)}
            className="bg-gold text-dark text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gold/90 transition-all"
          >
            + Add Channel
          </button>
        </div>

        {/* Add channel form */}
        {showAddChannel && (
          <div className="p-4 border-b border-border bg-surface-2">
            <AddChannel
              currentUserId={currentUserId}
              onChannelAdded={() => {
                setShowAddChannel(false)
                loadData()
              }}
            />
          </div>
        )}

        {/* Channels list */}
        <div className="divide-y divide-border/50">
          {channels.map(channel => (
            <div
              key={channel.id}
              className="flex items-center gap-4 p-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex-1">
                <p className="text-text-primary font-medium text-sm">
                  {channel.name}
                </p>
                <p className="text-text-muted text-xs font-mono mt-0.5">
                  {channel.channel_id}
                </p>
                {channel.description && (
                  <p className="text-text-muted text-xs mt-0.5">
                    {channel.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={channel.channel_url || `https://youtube.com/channel/${channel.channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-gold text-xs transition-colors"
                >
                  ↗ View
                </a>

                {/* Active toggle */}
                <button
                  onClick={() => handleToggleChannel(channel.id, channel.is_active)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    channel.is_active ? 'bg-gold' : 'bg-surface-2'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    channel.is_active ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>

                <button
                  onClick={() => handleDeleteChannel(channel.id)}
                  className="text-text-muted hover:text-red-400 text-xs transition-colors p-1"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

export default YouTubeSyncPanel