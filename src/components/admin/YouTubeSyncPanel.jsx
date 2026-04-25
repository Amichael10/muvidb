import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { syncAllFilmStats, syncSingleFilmStats } from '../../utils/syncService'
import { formatViewCount } from '../../utils/youtube'
import AddChannel from './AddChannel'
import Drawer from './Drawer'
import SyncStatusOverlay from './SyncStatusOverlay'

const YouTubeSyncPanel = ({ currentUserId }) => {
  const [films, setFilms] = useState([])
  const [channels, setChannels] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(null)
  const [syncResult, setSyncResult] = useState(null)
  const [syncReport, setSyncReport] = useState(null)
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)
  
  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', channel_url: '', channel_id: '' })
  const [savingChannel, setSavingChannel] = useState(false)

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
    setSyncReport(null)
    setSyncProgress({ stage: 'fetching', total: filmsWithYouTube.length, current: 0, status: 'Initializing YouTube Handshake...' })

    const result = await syncAllFilmStats((progress) => {
      setSyncProgress({
        ...progress,
        current: progress.done,
        status: progress.stage === 'fetching' ? 'Requesting Signal Data...' : `Syncing ${progress.currentFilm || 'Assets'}...`
      })
    })

    setSyncing(false)
    setSyncProgress(null)
    
    if (result.success) {
      setSyncReport(filmsWithYouTube.map(f => {
        const error = result.errors?.find(e => e.film === f.title);
        return {
          name: f.title,
          success: !error,
          count: error ? 0 : 1, // Stats sync is 1 film at a time
          error: error?.error
        };
      }));
      loadData()
    } else {
      setSyncReport([{ name: 'Bulk Sync', success: false, error: result.error || 'Connection Timeout' }]);
    }
  }

  const handleSyncSingle = async (filmId, filmTitle) => {
    const result = await syncSingleFilmStats(filmId)
    if (result.success) {
      loadData()
    }
    return result
  }

  const handleOpenChannel = (channel) => {
    setSelectedChannel(channel)
    setEditForm({
      name: channel.name || '',
      description: channel.description || '',
      channel_url: channel.channel_url || '',
      channel_id: channel.channel_id || ''
    })
    setIsDrawerOpen(true)
  }

  const handleUpdateChannel = async (e) => {
    e.preventDefault()
    if (!selectedChannel) return
    setSavingChannel(true)
    
    const { error } = await supabase
      .from('youtube_channels')
      .update({
        name: editForm.name,
        description: editForm.description,
        channel_url: editForm.channel_url,
        channel_id: editForm.channel_id // Keeping it editable as requested, though risky
      })
      .eq('id', selectedChannel.id)

    if (error) {
      alert('Error updating channel: ' + error.message)
    } else {
      setIsDrawerOpen(false)
      loadData()
    }
    setSavingChannel(false)
  }

  const handleToggleChannel = async (channelId, isActive) => {
    await supabase
      .from('youtube_channels')
      .update({ is_active: !isActive })
      .eq('id', channelId)
    
    // If the drawer is open with this channel, update local state too
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(prev => ({ ...prev, is_active: !isActive }))
    }
    loadData()
  }

  const handleDeleteChannel = async (channelId) => {
    if (!window.confirm('Are you sure you want to delete this channel?')) return
    
    const { error } = await supabase
      .from('youtube_channels')
      .delete()
      .eq('id', channelId)
      
    if (error) {
      alert('Error deleting channel: ' + error.message)
    } else {
      setIsDrawerOpen(false)
      loadData()
    }
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
          <div key={stat.label} className="bg-surface rounded-lg p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-text-muted text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Sync Button ── */}
      <div className="bg-surface rounded-lg p-6">
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
            disabled={syncing || (filmsWithYouTube.length === 0 && channels.filter(c => c.is_active).length === 0)}
            className="flex items-center gap-2 bg-gold text-dark font-semibold px-6 py-3 rounded-md hover:bg-gold/90 transition-all disabled:opacity-50"
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

        {/* Warning when syncing */}
        {syncing && (
          <div className="mb-4 p-3 bg-amber-900/30 border border-amber-800/50 rounded-md flex items-start gap-3">
            <span className="text-amber-400 text-xl">⚠️</span>
            <div>
              <p className="text-amber-400 font-medium text-sm">Please do not switch tabs or minimize the window</p>
              <p className="text-amber-400/80 text-xs mt-0.5">Browsers pause background tasks to save memory. Switching tabs will stop the sync process.</p>
            </div>
          </div>
        )}

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
          <div className={`mt-4 p-3 rounded-md text-sm ${
            syncResult.success 
              ? 'bg-green-900/30 text-green-400 border border-green-800'
              : 'bg-red-900/30 text-red-400 border border-red-800'
          }`}>
            {syncResult.message || syncResult.error || 'An unknown error occurred.'}
            {syncResult.errors?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs opacity-80">
                {syncResult.errors.map((e, i) => (
                  <li key={i}>⚠ {e.film}: {e.error}</li>
                ))}
              </ul>
            )}
            {syncResult.debugLogs?.length > 0 && (
              <div className="mt-4 pt-2 border-t border-green-800/50">
                <p className="font-semibold mb-1">Debug Logs:</p>
                <ul className="space-y-1 text-xs opacity-80 max-h-40 overflow-y-auto">
                  {syncResult.debugLogs.map((log, i) => (
                    <li key={i}>{log}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-text-muted mt-3">
          Uses ~{filmsWithYouTube.length + (channels.filter(c => c.is_active).length * 2)} quota units 
          (free tier: 10,000/day)
        </p>
      </div>

      {/* ── Films Table ── */}
      <div className="bg-surface rounded-lg overflow-hidden">
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
      <div className="bg-surface rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-text-primary font-semibold">
            Trusted Channels ({channels.length})
          </h3>
          <button
            onClick={() => setShowAddChannel(!showAddChannel)}
            className="bg-gold text-dark text-sm font-semibold px-4 py-2 rounded-md hover:bg-gold/90 transition-all"
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
              onClick={() => handleOpenChannel(channel)}
              className="group flex items-center gap-4 p-4 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-text-primary font-medium text-sm group-hover:text-gold transition-colors">
                    {channel.name}
                  </p>
                  {!channel.is_active && (
                    <span className="text-[10px] bg-red-900/20 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-text-muted text-xs font-mono mt-0.5">
                  {channel.channel_id}
                </p>
                {channel.description && (
                  <p className="text-text-muted text-xs mt-0.5 truncate max-w-md">
                    {channel.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={channel.channel_url || `https://youtube.com/channel/${channel.channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-text-muted hover:text-gold text-xs transition-colors"
                >
                  ↗
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleChannel(channel.id, channel.is_active)
                  }}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    channel.is_active ? 'bg-gold' : 'bg-surface-2'
                  }`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    channel.is_active ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          ))}

          {channels.length === 0 && (
            <div className="p-8 text-center text-text-muted text-sm">
              No channels added yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Channel Detail Drawer ── */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Channel Details"
        width="480px"
      >
        {selectedChannel && (
          <div className="space-y-8">
            {/* Status Header */}
            <div className="bg-surface-2 p-6 rounded-lg border border-border flex items-center justify-between">
              <div>
                <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Current Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${selectedChannel.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-text-primary font-medium">{selectedChannel.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <button
                onClick={() => handleToggleChannel(selectedChannel.id, selectedChannel.is_active)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  selectedChannel.is_active 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                    : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                }`}
              >
                {selectedChannel.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleUpdateChannel} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Display Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 focus:border-gold focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Channel ID</label>
                  <input
                    type="text"
                    required
                    value={editForm.channel_id}
                    onChange={e => setEditForm({ ...editForm, channel_id: e.target.value })}
                    className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 focus:border-gold focus:outline-none transition-colors font-mono text-sm"
                  />
                  <p className="text-[10px] text-text-muted italic">Used by YouTube API to fetch trailers</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Channel URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={editForm.channel_url}
                      onChange={e => setEditForm({ ...editForm, channel_url: e.target.value })}
                      className="flex-1 bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 focus:border-gold focus:outline-none transition-colors text-sm"
                    />
                    <a
                      href={editForm.channel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center p-3 rounded-md bg-surface-2 border border-border text-text-muted hover:text-gold transition-colors"
                    >
                      ↗
                    </a>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-text-muted">Description</label>
                  <textarea
                    rows={4}
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 focus:border-gold focus:outline-none transition-colors resize-none text-sm"
                    placeholder="Notes about this channel..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => handleDeleteChannel(selectedChannel.id)}
                  className="px-6 py-3 rounded-md text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-all"
                >
                  Delete Channel
                </button>
                <button
                  type="submit"
                  disabled={savingChannel}
                  className="px-8 py-3 bg-gold text-dark font-bold rounded-md hover:bg-gold/90 transition-all disabled:opacity-50"
                >
                  {savingChannel ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Drawer>

      {/* Progress & Report Overlay */}
      <SyncStatusOverlay 
        progress={syncProgress} 
        report={syncReport} 
        onClose={() => setSyncReport(null)} 
      />
    </div>
  )
}

export default YouTubeSyncPanel