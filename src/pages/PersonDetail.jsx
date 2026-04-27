import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFollow } from '../hooks/useFollow'
import { useAuth } from '../context/AuthContext'
import { Icon } from '@iconify/react'
import {
  formatViewCount,
  fetchRecentVideosFromChannel,
  resolveChannelId
} from '../utils/youtube'
import { getPersonYoutubeChannelUrl } from '../lib/youtube'
import { Skeleton } from '../components/ui/Skeleton'

const PLATFORM_STYLES = {
  cinema:   { label: 'Cinema',   bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
  netflix:  { label: 'Netflix',  bg: 'bg-red-600/20',     text: 'text-red-400',     dot: 'bg-red-500'    },
  youtube:  { label: 'YouTube',  bg: 'bg-red-500/20',     text: 'text-red-400',     dot: 'bg-red-500'    },
  amazon:   { label: 'Prime',    bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-400'   },
  showmax:  { label: 'Showmax',  bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: 'bg-purple-400' },
  iroko:    { label: 'iROKO',    bg: 'bg-green-500/20',   text: 'text-green-400',   dot: 'bg-green-400'  },
  kava:     { label: 'Kava',     bg: 'bg-orange-500/20',  text: 'text-orange-400',  dot: 'bg-orange-400' },
}

function PlatformBadge({ releaseType }) {
  if (!releaseType) return null
  const key = releaseType.toLowerCase()
  const style = PLATFORM_STYLES[key]
  if (!style) return (
    <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
      {releaseType}
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest ${style.text} ${style.bg} px-1.5 py-0.5 rounded`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

/** Format seconds → "1:23:45" or "23:45" */
function fmtDuration(secs) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

const PersonDetailSkeleton = () => (
  <div className="min-h-screen bg-bg">
    <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border relative z-10">
        <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
          <div className="w-48 h-48 md:w-56 md:h-56 rounded-xl bg-surface-2 animate-shimmer shrink-0 shadow-2xl"></div>
          <div className="flex-1 space-y-6 w-full">
            <div className="space-y-3">
              <div className="h-12 w-2/3 bg-surface-2 rounded-lg animate-shimmer mx-auto md:mx-0"></div>
              <div className="h-4 w-1/3 bg-surface-2 rounded-md animate-shimmer mx-auto md:mx-0"></div>
            </div>
            <div className="grid grid-cols-3 gap-0 border border-border rounded-lg max-w-sm mx-auto md:mx-0 bg-surface overflow-hidden">
              <div className="p-4 border-r border-border"><div className="h-8 w-full bg-surface-2 rounded-md animate-shimmer"></div></div>
              <div className="p-4 border-r border-border"><div className="h-8 w-full bg-surface-2 rounded-md animate-shimmer"></div></div>
              <div className="p-4"><div className="h-8 w-full bg-surface-2 rounded-md animate-shimmer"></div></div>
            </div>
            <div className="space-y-2 max-w-2xl mx-auto md:mx-0">
              <div className="h-4 w-full bg-surface-2 rounded-md animate-shimmer"></div>
              <div className="h-4 w-5/6 bg-surface-2 rounded-md animate-shimmer"></div>
              <div className="h-4 w-4/6 bg-surface-2 rounded-md animate-shimmer"></div>
            </div>
            <div className="flex gap-4 justify-center md:justify-start">
              <div className="h-12 w-32 bg-surface-2 rounded-lg animate-shimmer"></div>
              <div className="h-12 w-40 bg-surface-2 rounded-lg animate-shimmer"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto border-x border-border p-8 md:p-12 space-y-12">
      <div className="h-10 w-48 bg-surface-2 rounded-md animate-shimmer"></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="space-y-3">
            <div className="aspect-[2/3] bg-surface-2 rounded-lg border border-border animate-shimmer overflow-hidden"></div>
            <div className="h-3 w-3/4 bg-surface-2 rounded animate-shimmer"></div>
            <div className="h-2 w-1/2 bg-surface-2 rounded animate-shimmer opacity-60"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const Biography = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLong = text.length > 280
  const displayText = isExpanded ? text : text.slice(0, 280) + (isLong ? '...' : '')

  return (
    <div className="space-y-4">
      <p className="text-text-muted text-sm leading-relaxed max-w-2xl italic">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand text-[9px] font-black uppercase tracking-widest hover:underline transition-all"
        >
          {isExpanded ? 'READ LESS ↑' : 'READ FULL BIO ↓'}
        </button>
      )}
    </div>
  )
}

const PersonDetail = () => {

  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [person, setPerson] = useState(null)
  const [channel, setChannel] = useState(null)
  const [channelVideos, setChannelVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeRole, setActiveRole] = useState('actor')
  const [youtubeVideoIds, setYoutubeVideoIds] = useState([])
  const [youtubeLoading, setYoutubeLoading] = useState(false)

  const {
    isFollowing,
    followerCount,
    loading: followLoading,
    toggleFollow
  } = useFollow(id, user)

  useEffect(() => {
    fetchPerson()
  }, [id])

  const fetchPerson = async () => {
    setLoading(true)
    setError(null)
    setYoutubeVideoIds([])

    const { data, error } = await supabase
      .from('people')
      .select(`
        *,
        credits(
          id, role, character_name, billing_order,
          films(
            id, title, year, poster_url, trailer_youtube_id,
            view_count, average_rating,
            release_type, trailer_youtube_id,
            film_genres(genres(name))
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      setError('Could not load this profile')
      setLoading(false)
      return
    }

    setPerson(data)

    // Fetch linked YouTube channel
    const { data: ch } = await supabase
      .from('channels')
      .select('id, name, channel_handle, channel_url, thumbnail_url, banner_url, subscriber_count, description, category')
      .eq('owner_person_id', id)
      .maybeSingle()
    setChannel(ch ?? null)

    // Fetch channel videos and YouTube films
    let vids = []
    let ytFilms = []
    
    if (ch?.id) {
      const { data: vidsData } = await supabase
        .from('channel_videos')
        .select('id, video_id, title, thumbnail_url, published_at, duration_seconds, is_hidden, film_id, match_status')
        .eq('channel_id', ch.id)
        .order('published_at', { ascending: false })
        .limit(50)
      vids = vidsData ?? []
      setChannelVideos(vids)

      setYoutubeLoading(true)
      ytFilms = await fetchYoutubeFilms(data, ch)
      setYoutubeLoading(false)
    }

    // Merge YouTube films into credits if not already there
    const mergedCredits = [...(data.credits || [])]
    const existingFilmIds = new Set(mergedCredits.map(c => c.films?.id))

    // 1. Matched films
    for (const yf of ytFilms) {
      if (!existingFilmIds.has(yf.id)) {
        if (yf.needs_review) continue

        mergedCredits.push({
          id: `yt-film-${yf.id}`,
          role: 'producer',
          films: yf,
          is_virtual: true
        })
      }
    }

    // 2. All other videos from the channel
    for (const vid of vids) {
      if (vid.duration_seconds < 60) continue
      if (vid.is_hidden) continue

      mergedCredits.push({
        id: `vid-${vid.video_id}`,
        role: 'actor', 
        video: vid,
        is_virtual: true
      })
    }

    const updatedPerson = { ...data, credits: mergedCredits }
    setPerson(updatedPerson)

    const rolesOrder = ['actor', 'director', 'writer', 'producer']
    const firstRole = rolesOrder.find(r =>
      updatedPerson.credits?.some(c => c.role === r)
    )
    if (firstRole) setActiveRole(firstRole)

    setLoading(false)
  }

  const fetchYoutubeFilms = async (personData, linkedChannel) => {
    try {
      const ytVideoIdsSet = new Set()
      const discoverableFilms = []
      const seen = new Set()

      if (linkedChannel?.id) {
        const { data: linkedVideos } = await supabase
          .from('channel_videos')
          .select(`
            video_id, film_id,
            films(
              id, title, year, poster_url, trailer_youtube_id,
              view_count, average_rating, release_type, youtube_watch_url,
              source, source_video_id,
              film_genres(genres(name))
            )
          `)
          .eq('channel_id', linkedChannel.id)
          .not('film_id', 'is', null)
          .order('published_at', { ascending: false })
          .limit(100)

        for (const row of linkedVideos ?? []) {
          if (!row.films) continue
          if (seen.has(row.films.id)) continue
          seen.add(row.films.id)
          ytVideoIdsSet.add(row.video_id)
          
          discoverableFilms.push({
            ...row.films,
            genres: row.films.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [],
            _sourceVideoId: row.video_id,
          })
        }

        setYoutubeVideoIds(Array.from(ytVideoIdsSet))
        if (discoverableFilms.length > 0) return discoverableFilms
      }

      if (!personData?.youtube_channel_id && !personData?.youtube_handle) {
        return []
      }

      let channelId = personData.youtube_channel_id

      if (!channelId && personData.youtube_handle) {
        const resolved = await resolveChannelId(
          `@${String(personData.youtube_handle).replace(/^@/, '')}`
        )
        if (resolved?.error || !resolved?.channelId) {
          return []
        }
        channelId = resolved.channelId
      }

      if (!channelId) return []

      const videos = await fetchRecentVideosFromChannel(channelId, 50)
      const orderedVideoIds = [...new Set(videos.map(v => v.videoId).filter(Boolean))]

      if (orderedVideoIds.length === 0) return []

      setYoutubeVideoIds(orderedVideoIds)

      const { data: matchedFilms } = await supabase
        .from('films')
        .select(`
          id, title, year, poster_url, trailer_youtube_id,
          view_count, average_rating, release_type, youtube_watch_url,
          film_genres(genres(name))
        `)
        .in('trailer_youtube_id', orderedVideoIds)

      const ytFilms = (matchedFilms || [])
        .map(f => ({ ...f, genres: f.film_genres?.map(fg => fg.genres?.name).filter(Boolean) || [] }))
      
      return ytFilms
    } catch (err) {
      console.error('Error fetching YouTube films for person:', err)
      return []
    } finally {
      setYoutubeLoading(false)
    }
  }

  const handleFollow = async () => {
    if (!user) {
      navigate('/login', {
        state: {
          from: `/people/${id}`,
          message: 'Sign in to follow filmmakers'
        }
      })
      return
    }
    await toggleFollow()
  }

  const creditsByRole = (role) => {
    return person?.credits
      ?.filter(c => c.role === role)
      ?.sort((a, b) => {
        const yearA = a.films?.year || (a.video?.published_at && new Date(a.video.published_at).getFullYear()) || 0
        const yearB = b.films?.year || (b.video?.published_at && new Date(b.video.published_at).getFullYear()) || 0
        
        if (yearA !== yearB) {
          return yearB - yearA
        }
        return a.billing_order - b.billing_order
      }) || []
  }

  const availableRoles = ['actor', 'director', 'writer', 'producer']
    .filter(role => creditsByRole(role).length > 0)

  const roleLabels = {
    actor: 'Actor',
    director: 'Director',
    writer: 'Writer',
    producer: 'Producer'
  }

  if (loading) {
    return <PersonDetailSkeleton />
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 border-x border-border py-32 text-center w-full">
          <p className="text-red-400 text-lg mb-8 font-black uppercase tracking-widest">
            {error || 'Person not found'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="bg-brand text-white font-black uppercase tracking-widest px-8 py-4 rounded-lg hover:shadow-brand/20 transition-all"
          >
            GO BACK
          </button>
        </div>
      </div>
    )
  }

  const totalFilms = [...new Set(person.credits?.map(c => c.films?.id).filter(Boolean))].length
  const totalViews = person.credits?.reduce(
    (sum, c) => sum + (c.films?.view_count || 0), 0
  ) || 0

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border relative z-10">
          <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
            <div className="flex-shrink-0 relative">
              <div className="absolute -inset-1 bg-brand/20 blur-xl rounded-full"></div>
              {person.photo_url ? (
                <img
                  src={person.photo_url}
                  alt={person.name}
                  className="relative w-48 h-48 md:w-56 md:h-56 rounded-xl object-cover shadow-2xl border border-border"
                />
              ) : (
                <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-xl bg-surface flex items-center justify-center shadow-2xl border border-border">
                  <span className="text-6xl font-bold text-brand font-heading">
                    {person.name?.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start mb-2">
                  <h1 className="text-4xl md:text-5xl font-heading font-bold text-text-primary tracking-tighter">
                    {person.name}
                  </h1>
                  {person.is_verified && (
                    <span className="bg-brand/10 text-brand text-[10px] font-bold px-3 py-1 rounded-lg border border-brand/20">
                      Verified
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {availableRoles.map(role => (
                     <span
                      key={role}
                      className="text-text-muted text-[10px] font-bold tracking-wider"
                    >
                      {roleLabels[role]}
                      {availableRoles.indexOf(role) <
                        availableRoles.length - 1 && ' ·'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-surface max-w-sm mx-auto md:mx-0 shadow-sm">
                <div className="p-4 border-r border-border text-center">
                  <p className="text-brand text-xl font-bold font-heading">
                    {formatViewCount(person.popularity_score || totalViews)}
                  </p>
                  <p className="text-text-muted text-[9px] font-bold">Views</p>
                </div>
                <div className="p-4 border-r border-border text-center">
                  <p className="text-text-primary text-xl font-bold font-heading">
                    {totalFilms}
                  </p>
                  <p className="text-text-muted text-[9px] font-bold">Credits</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-text-primary text-xl font-bold font-heading">
                    {followerCount.toLocaleString()}
                  </p>
                  <p className="text-text-muted text-[9px] font-bold">Followers</p>
                </div>
              </div>

              {person.biography && (
                <div className="space-y-4">
                  <p className="text-text-muted text-sm leading-relaxed max-w-2xl">
                    {person.biography}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-6 text-[10px] font-bold tracking-wider justify-center md:justify-start">
                {person.nationality && (
                  <span className="text-text-muted">Nationality: {person.nationality}</span>
                )}
                {person.date_of_birth && (
                  <span className="text-text-muted">
                    Born: {new Date(person.date_of_birth).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2 justify-center md:justify-start">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-8 py-3 rounded-lg font-bold text-xs transition-all disabled:opacity-50 min-h-[44px] ${
                    isFollowing
                      ? 'bg-surface border border-brand text-brand hover:bg-brand/5'
                      : 'bg-brand text-white hover:shadow-brand/20 hover:scale-[1.02]'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                {getPersonYoutubeChannelUrl(person) && (
                  <a
                    href={getPersonYoutubeChannelUrl(person)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-xs transition-all border border-border text-text-primary bg-surface hover:border-brand hover:text-brand min-h-[44px]"
                  >
                    Official Channel
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border pb-20">
        <div className="p-8 md:p-12">
          <h2 className="text-text-primary text-3xl font-bold font-heading mb-8 tracking-tighter">
            Filmography
          </h2>

          {availableRoles.length > 1 && (
            <div className="flex bg-surface p-1 rounded-lg border border-border w-fit mb-10 overflow-x-auto no-scrollbar">
              {availableRoles.map(role => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`px-6 py-2 rounded-md text-[10px] font-bold transition-all whitespace-nowrap ${
                    activeRole === role
                      ? 'bg-brand text-white shadow-md'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {roleLabels[role]} ({creditsByRole(role).length})
                </button>
              ))}
            </div>
          )}

          {creditsByRole(activeRole).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {creditsByRole(activeRole).map(credit => {
                const film = credit.films
                const video = credit.video
                const title = film?.title || video?.title
                const poster = film?.poster_url || video?.thumbnail_url
                const link = video 
                  ? `https://www.youtube.com/watch?v=${video.video_id}` 
                  : `/films/${film?.id}`
                const isExternal = !!video

                return (
                  <Link
                    key={credit.id}
                    to={isExternal ? '#' : link}
                    onClick={(e) => {
                      if (isExternal) {
                        e.preventDefault()
                        window.open(link, '_blank')
                      }
                    }}
                    className="group block"
                  >
                    <div className="relative overflow-hidden rounded-lg aspect-[2/3] bg-surface-2 border border-border group-hover:border-brand transition-all shadow-sm">
                      {poster ? (
                        <img
                          src={poster}
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon icon="solar:clapperboard-play-linear" className="text-4xl text-text-muted/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-text-primary text-[11px] font-bold uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-brand transition-colors">
                          {title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <p className="text-text-muted text-[9px] font-black tracking-widest uppercase">
                            {film?.year || (video?.published_at && new Date(video.published_at).getFullYear())}
                          </p>
                          {credit.character_name && (
                          <p className="text-brand text-[9px] font-bold truncate">
                              as {credit.character_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
              <p className="text-text-muted font-bold text-xs">
                No credits available yet
              </p>
            </div>
          )}
        </div>

        {channel && (
          <div className="p-8 md:p-12 border-t border-border bg-surface-2/5 relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
            <h2 className="text-text-primary text-2xl font-bold mb-8 font-heading tracking-tighter relative z-10">
              Official Channel
            </h2>

            <Link
              to={`/channels/${channel.id}`}
              className="relative z-10 group flex flex-col sm:flex-row items-center gap-8 bg-surface rounded-xl border border-border hover:border-brand transition-all duration-500 overflow-hidden shadow-sm p-8 max-w-3xl"
            >
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-brand blur-lg opacity-10 group-hover:opacity-30 transition-opacity"></div>
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.name}
                    className="relative w-24 h-24 rounded-lg border border-border object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="relative w-24 h-24 rounded-lg bg-surface-2 flex items-center justify-center border border-border">
                    <span className="text-brand font-bold text-3xl font-heading">{channel.name?.charAt(0)}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center gap-3 justify-center sm:justify-start mb-2">
                  <p className="text-text-primary font-bold text-xl uppercase tracking-tighter group-hover:text-brand transition-colors truncate">
                    {channel.name}
                  </p>
                  <span className="bg-[#FF0000]/10 text-[#FF0000] text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border border-[#FF0000]/20">CHANNEL</span>
                </div>
                
                {channel.subscriber_count > 0 && (
                  <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-4">
                    {formatViewCount(channel.subscriber_count)} SUBSCRIBERS • {channel.category || 'OFFICIAL'}
                  </p>
                )}
                {channel.description && (
                  <p className="text-text-muted text-xs line-clamp-2 leading-relaxed italic opacity-80">
                    {channel.description}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-surface-2 border border-border group-hover:border-brand group-hover:text-brand transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default PersonDetail
