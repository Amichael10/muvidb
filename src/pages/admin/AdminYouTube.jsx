import { useState } from 'react'
import YouTubeSyncPanel from '../../components/admin/YouTubeSyncPanel'
import TMDBSyncPanel from '../../components/admin/TMDBSyncPanel'
import { useAuth } from '../../context/AuthContext'

const AdminYouTube = () => {
  const { user } = useAuth()
  const [activeSource, setActiveSource] = useState('tmdb') // 'youtube' | 'tmdb'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-clash">
            Data Sources
          </h1>
          <p className="text-text-muted text-sm mt-1 uppercase tracking-wider font-black">
            Import & Sync External Data
          </p>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveSource('tmdb')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeSource === 'tmdb'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-surface text-text-muted hover:text-text-primary border border-border'
          }`}
        >
          <span className="text-base">🎬</span>
          TMDB
        </button>
        <button
          onClick={() => setActiveSource('youtube')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeSource === 'youtube'
              ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
              : 'bg-surface text-text-muted hover:text-text-primary border border-border'
          }`}
        >
          <span className="text-base">▶️</span>
          YouTube
        </button>
      </div>

      {/* Active Panel */}
      {activeSource === 'youtube' ? (
        <YouTubeSyncPanel currentUserId={user?.id} />
      ) : (
        <TMDBSyncPanel />
      )}
    </div>
  )
}

export default AdminYouTube
