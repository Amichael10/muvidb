import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  searchTmdbMovies,
  discoverNigerianMovies,
  getTmdbMovieDetails,
  tmdbPosterUrl,
  tmdbProfileUrl,
  mapTmdbGenre,
} from '../../utils/tmdb'

const TMDBSyncPanel = () => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Discover state
  const [discoverResults, setDiscoverResults] = useState([])
  const [discoverPage, setDiscoverPage] = useState(1)
  const [discoverTotalPages, setDiscoverTotalPages] = useState(0)
  const [discoverYear, setDiscoverYear] = useState('')
  const [discovering, setDiscovering] = useState(false)

  // Import state
  const [importingId, setImportingId] = useState(null)
  const [importProgress, setImportProgress] = useState('')
  const [importedTmdbIds, setImportedTmdbIds] = useState(new Set())
  const [importLog, setImportLog] = useState([])

  // Tab state
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'discover'

  // Stats
  const [stats, setStats] = useState({ totalFilms: 0, tmdbFilms: 0 })

  // Genre map from DB
  const [genreMap, setGenreMap] = useState({})

  useEffect(() => {
    loadExistingTmdbIds()
    loadGenreMap()
    loadStats()
  }, [])

  const loadExistingTmdbIds = async () => {
    const { data } = await supabase
      .from('films')
      .select('tmdb_id')
      .not('tmdb_id', 'is', null)
    
    setImportedTmdbIds(new Set((data || []).map(f => f.tmdb_id)))
  }

  const loadGenreMap = async () => {
    const { data } = await supabase.from('genres').select('*')
    const map = {}
    ;(data || []).forEach(g => {
      map[g.name.toLowerCase()] = g.id
    })
    setGenreMap(map)
  }

  const loadStats = async () => {
    const { count: totalFilms } = await supabase
      .from('films')
      .select('*', { count: 'exact', head: true })
    
    const { count: tmdbFilms } = await supabase
      .from('films')
      .select('*', { count: 'exact', head: true })
      .not('tmdb_id', 'is', null)

    setStats({ totalFilms: totalFilms || 0, tmdbFilms: tmdbFilms || 0 })
  }

  // ── Search ──
  const handleSearch = async (e) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return

    setSearching(true)
    const result = await searchTmdbMovies(searchQuery)
    setSearchResults(result.results || [])
    setSearching(false)
  }

  // ── Discover ──
  const handleDiscover = async (page = 1) => {
    setDiscovering(true)
    const year = discoverYear ? parseInt(discoverYear) : null
    const result = await discoverNigerianMovies(page, year)
    setDiscoverResults(result.results || [])
    setDiscoverTotalPages(result.totalPages)
    setDiscoverPage(result.page)
    setDiscovering(false)
  }

  // ── Import Single Film ──
  const handleImport = async (tmdbId, title) => {
    if (importedTmdbIds.has(tmdbId)) return

    setImportingId(tmdbId)
    setImportProgress('Fetching details...')
    addLog(`🎬 Importing "${title}"...`)

    try {
      // 1. Fetch full details from TMDB
      const details = await getTmdbMovieDetails(tmdbId)
      if (!details) {
        addLog(`❌ Failed to fetch details for "${title}"`)
        setImportingId(null)
        return
      }

      setImportProgress('Saving film...')

      // 2. Insert film
      const filmPayload = {
        title: details.title,
        synopsis: details.overview || null,
        tagline: details.tagline || null,
        year: details.year,
        runtime_minutes: details.runtime || null,
        poster_url: details.posterUrl,
        backdrop_url: details.backdropUrl,
        status: details.status,
        language: details.language,
        tmdb_id: details.tmdbId,
        tmdb_rating: details.rating || null,
        nfvcb_rating: '18',
        view_count: 0,
      }

      const { data: insertedFilm, error: filmError } = await supabase
        .from('films')
        .insert(filmPayload)
        .select('id')
        .single()

      if (filmError) {
        addLog(`❌ Film insert error: ${filmError.message}`)
        setImportingId(null)
        return
      }

      const filmId = insertedFilm.id

      // 3. Link genres
      setImportProgress('Linking genres...')
      const genreLinks = []
      for (const genre of details.genres) {
        const genreId = genreMap[genre.name.toLowerCase()]
        if (genreId) {
          genreLinks.push({ film_id: filmId, genre_id: genreId })
        }
      }
      if (genreLinks.length > 0) {
        await supabase.from('film_genres').insert(genreLinks)
      }

      // 4. Import cast
      setImportProgress(`Importing ${details.cast.length} cast members...`)
      for (const member of details.cast) {
        const personId = await upsertPerson(member)
        if (!personId) continue

        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role: 'actor',
          character_name: member.character || null,
          billing_order: member.order || 0,
        })
      }

      // 5. Import crew
      setImportProgress(`Importing ${details.crew.length} crew members...`)
      const roleMap = {
        'Director': 'director',
        'Writer': 'writer',
        'Screenplay': 'writer',
        'Producer': 'producer',
        'Executive Producer': 'producer',
        'Director of Photography': 'crew',
        'Editor': 'crew',
        'Original Music Composer': 'crew',
        'Production Design': 'crew',
        'Art Direction': 'crew',
        'Costume Design': 'crew',
        'Makeup Artist': 'crew',
        'Stunt Coordinator': 'crew',
        'Visual Effects Supervisor': 'crew',
        'Casting': 'crew',
      }

      for (const member of details.crew) {
        const personId = await upsertPerson(member)
        if (!personId) continue

        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role: roleMap[member.job] || 'crew',
          billing_order: 0,
        })
      }

      // 6. Import companies & link them
      setImportProgress('Importing production companies...')
      const companyLinks = []
      for (const company of details.companies) {
        const companyId = await upsertCompany(company)
        if (companyId) {
          companyLinks.push({ 
            film_id: filmId, 
            company_id: companyId 
          })
        }
      }
      if (companyLinks.length > 0) {
        await supabase.from('film_companies').insert(companyLinks)
      }

      // Done!
      setImportedTmdbIds(prev => new Set([...prev, tmdbId]))
      addLog(`✅ "${details.title}" imported with ${details.cast.length} cast, ${details.crew.length} crew`)
      loadStats()

    } catch (err) {
      addLog(`❌ Error importing "${title}": ${err.message}`)
    } finally {
      setImportingId(null)
      setImportProgress('')
    }
  }

  // ── Upsert person ──
  const upsertPerson = async (tmdbPerson) => {
    const { data: existing } = await supabase
      .from('people')
      .select('id, bio')
      .eq('tmdb_id', tmdbPerson.tmdbId)
      .maybeSingle()

    if (existing) return existing.id

    const { data: byName } = await supabase
      .from('people')
      .select('id, bio')
      .ilike('name', tmdbPerson.name)
      .maybeSingle()

    if (byName) {
      await supabase.from('people')
        .update({ tmdb_id: tmdbPerson.tmdbId })
        .eq('id', byName.id)
      return byName.id
    }

    // Fetch full person details (biography) for new record
    let bio = null
    try {
      const { getTmdbPerson } = await import('../../utils/tmdb')
      const fullPerson = await getTmdbPerson(tmdbPerson.tmdbId)
      bio = fullPerson.biography || null
    } catch (err) {
      console.warn('Failed to fetch biography:', err)
    }

    const { data: newPerson, error } = await supabase
      .from('people')
      .insert({
        name: tmdbPerson.name,
        tmdb_id: tmdbPerson.tmdbId,
        photo_url: tmdbPerson.photoUrl,
        bio: bio,
        nationality: 'Nigerian',
      })
      .select('id')
      .single()

    if (error) return null
    return newPerson.id
  }

  // ── Upsert company ──
  const upsertCompany = async (tmdbCompany) => {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('tmdb_id', tmdbCompany.tmdbId)
      .maybeSingle()

    if (existing) return existing.id

    const { data: byName } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', tmdbCompany.name)
      .maybeSingle()

    if (byName) {
      await supabase.from('companies')
        .update({ tmdb_id: tmdbCompany.tmdbId })
        .eq('id', byName.id)
      return byName.id
    }

    const { data: newCompany, error } = await supabase.from('companies').insert({
      name: tmdbCompany.name,
      tmdb_id: tmdbCompany.tmdbId,
    }).select('id').single()

    if (error) return null
    return newCompany.id
  }

  const addLog = (msg) => {
    setImportLog(prev => [msg, ...prev].slice(0, 50))
  }

  // ── Bulk import all on current page ──
  const handleBulkImport = async () => {
    const toImport = (activeTab === 'search' ? searchResults : discoverResults)
      .filter(m => !importedTmdbIds.has(m.tmdbId))

    if (toImport.length === 0) {
      addLog('⚠️ No new films to import on this page.')
      return
    }

    addLog(`🚀 Starting bulk import of ${toImport.length} films...`)

    for (const movie of toImport) {
      await handleImport(movie.tmdbId, movie.title)
      // Small delay to avoid overwhelming Supabase
      await new Promise(r => setTimeout(r, 300))
    }

    addLog(`✅ Bulk import complete!`)
  }

  return (
    <div className="space-y-8">

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Films in DB', value: stats.totalFilms, color: 'text-brand' },
          { label: 'Imported from TMDB', value: stats.tmdbFilms, color: 'text-green-400' },
          { label: 'Manual / YouTube', value: stats.totalFilms - stats.tmdbFilms, color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-surface rounded-lg p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-text-muted text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 bg-surface rounded-lg p-1.5">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all ${
            activeTab === 'search'
              ? 'bg-brand text-white shadow-lg shadow-brand/20'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          🔍 Search TMDB
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all ${
            activeTab === 'discover'
              ? 'bg-brand text-white shadow-lg shadow-brand/20'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          🇳🇬 Discover Nigerian Films
        </button>
      </div>

      {/* ── Search Tab ── */}
      {activeTab === 'search' && (
        <div className="bg-surface rounded-lg p-6">
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search TMDB for a film title..."
              className="flex-1 bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 focus:border-brand focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="bg-brand text-white font-semibold px-6 py-3 rounded-md hover:scale-[1.02] shadow-lg shadow-brand/20 transition-all disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-text-muted text-sm">{searchResults.length} results</p>
              <button
                onClick={handleBulkImport}
                disabled={importingId !== null}
                className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-4 py-2 rounded-md hover:bg-green-500/20 transition-all disabled:opacity-50"
              >
                Import All New
              </button>
            </div>
          )}

          <MovieList
            movies={searchResults}
            importedTmdbIds={importedTmdbIds}
            importingId={importingId}
            importProgress={importProgress}
            onImport={handleImport}
          />
        </div>
      )}

      {/* ── Discover Tab ── */}
      {activeTab === 'discover' && (
        <div className="bg-surface rounded-lg p-6">
          <div className="flex flex-wrap gap-3 mb-6">
            <input
              type="number"
              value={discoverYear}
              onChange={(e) => setDiscoverYear(e.target.value)}
              placeholder="Year (optional)"
              min="1990"
              max="2030"
              className="w-36 bg-surface-2 border border-border text-text-primary rounded-md px-4 py-3 focus:border-gold focus:outline-none transition-colors"
            />
            <button
              onClick={() => handleDiscover(1)}
              disabled={discovering}
              className="bg-brand text-white font-semibold px-6 py-3 rounded-md hover:scale-[1.02] shadow-lg shadow-brand/20 transition-all disabled:opacity-50"
            >
              {discovering ? 'Loading...' : '🇳🇬 Discover'}
            </button>
            {discoverResults.length > 0 && (
              <button
                onClick={handleBulkImport}
                disabled={importingId !== null}
                className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-4 py-2 rounded-md hover:bg-green-500/20 transition-all disabled:opacity-50 ml-auto"
              >
                Import All New on Page
              </button>
            )}
          </div>

          <MovieList
            movies={discoverResults}
            importedTmdbIds={importedTmdbIds}
            importingId={importingId}
            importProgress={importProgress}
            onImport={handleImport}
          />

          {/* Pagination */}
          {discoverTotalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-border">
              <button
                onClick={() => handleDiscover(discoverPage - 1)}
                disabled={discoverPage <= 1 || discovering}
                className="text-text-muted hover:text-brand disabled:opacity-30 text-sm font-semibold transition-colors"
              >
                ← Previous
              </button>
              <span className="text-text-muted text-sm">
                Page {discoverPage} of {discoverTotalPages}
              </span>
              <button
                onClick={() => handleDiscover(discoverPage + 1)}
                disabled={discoverPage >= discoverTotalPages || discovering}
                className="text-text-muted hover:text-brand disabled:opacity-30 text-sm font-semibold transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import Log */}
      {importLog.length > 0 && (
        <div className="bg-surface rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-text-primary font-semibold">Import Log</h3>
            <button
              onClick={() => setImportLog([])}
              className="text-text-muted text-xs hover:text-brand transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="p-4 max-h-60 overflow-y-auto space-y-1.5">
            {importLog.map((log, i) => (
              <p key={i} className="text-xs text-text-muted font-mono">
                {log}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Movie List Component ──
const MovieList = ({ movies, importedTmdbIds, importingId, importProgress, onImport }) => {
  if (movies.length === 0) {
    return (
      <div className="p-8 text-center text-text-muted text-sm">
        No results yet. Search or discover films above.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {movies.map(movie => {
        const isImported = importedTmdbIds.has(movie.tmdbId)
        const isImporting = importingId === movie.tmdbId

        return (
          <div
            key={movie.tmdbId}
            className={`flex gap-4 p-4 rounded-md border transition-all ${
              isImported
                ? 'bg-green-900/10 border-green-800/30'
                : 'bg-surface-2 border-border hover:border-brand/30'
            }`}
          >
            {/* Poster */}
            <div className="w-16 h-24 rounded-lg overflow-hidden bg-surface flex-shrink-0">
              {movie.posterUrl ? (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">
                  No Poster
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-text-primary font-semibold text-sm truncate">
                    {movie.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.language && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{movie.language}</span>
                      </>
                    )}
                    {movie.rating > 0 && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-brand">⭐ {movie.rating.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Import Button */}
                <div className="flex-shrink-0">
                  {isImported ? (
                    <span className="text-[10px] bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/20 font-semibold">
                      ✓ Imported
                    </span>
                  ) : isImporting ? (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] text-brand font-semibold">
                        {importProgress || 'Importing...'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onImport(movie.tmdbId, movie.title)}
                      className="text-[10px] bg-brand/10 text-brand px-3 py-1.5 rounded-lg border border-brand/20 font-semibold hover:bg-brand/20 transition-all"
                    >
                      + Import
                    </button>
                  )}
                </div>
              </div>

              {/* Genres */}
              {movie.genreNames?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {movie.genreNames.map(genre => (
                    <span
                      key={genre}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview snippet */}
              {movie.overview && (
                <p className="text-xs text-text-muted mt-2 line-clamp-2">
                  {movie.overview}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TMDBSyncPanel
