import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { useFollow } from '../hooks/useFollow'
import { useAuth } from '../context/AuthContext'
import { Icon } from '@iconify/react'
import { SuggestEditModal } from '../components/contribute/ContributeModals'
import {
  formatViewCount,
  fetchRecentVideosFromChannel,
  resolveChannelId
} from '../utils/youtube'
import { getPersonYoutubeChannelUrl } from '../lib/youtube'
import { normalizeRole, formatRole } from '../lib/creditRoles'
import { Skeleton } from '../components/ui/Skeleton'
import ShareAction from '../components/ui/ShareAction'
import ImageWithFallback from '../components/ui/ImageWithFallback'
import { slugOrId } from '../utils/slug'
import { formatPersonName, toTitleCase, toSentenceCase, formatFilmTitle } from '../utils/format'

const PLATFORM_STYLES = {
  cinema:   { label: 'Cinema',   bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
  netflix:  { label: 'Netflix',  bg: 'bg-red-600/20',     text: 'text-red-400',     dot: 'bg-red-500'    },
  youtube:  { label: 'YouTube',  bg: 'bg-red-500/20',     text: 'text-red-400',     dot: 'bg-red-500'    },
  amazon:   { label: 'Prime',    bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-400'   },
  showmax:  { label: 'Showmax',  bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: 'bg-purple-400' },
  iroko:    { label: 'iROKO',    bg: 'bg-green-500/20',   text: 'text-green-400',   dot: 'bg-green-400'  },
  kava:     { label: 'Kava',     bg: 'bg-orange-500/20',  text: 'text-orange-400',  dot: 'bg-orange-400' },
  docuth:   { label: 'Docuth',   bg: 'bg-zinc-800/40',    text: 'text-zinc-200',    dot: 'bg-zinc-400'   },
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
          <div className="w-48 md:w-56 aspect-[3/4] rounded-lg bg-surface-2 animate-shimmer shrink-0 shadow-2xl"></div>
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

  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [person, setPerson] = useState(null)
  const [awardFilms, setAwardFilms] = useState({}) // film_id -> { slug, title, poster_url }
  const [personId, setPersonId] = useState(null) // actual UUID
  const [channel, setChannel] = useState(null)
  const [channelVideos, setChannelVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [activeRole, setActiveRole] = useState('actor')
  const [youtubeVideoIds, setYoutubeVideoIds] = useState([])
  const [youtubeLoading, setYoutubeLoading] = useState(false)
  const [visibleCreditsCount, setVisibleCreditsCount] = useState(20)

  const {
    isFollowing,
    followerCount,
    loading: followLoading,
    toggleFollow
  } = useFollow(personId, user)

  useEffect(() => {
    fetchPerson()
  }, [slug])

  useEffect(() => {
    setVisibleCreditsCount(20)
  }, [activeRole])

  const fetchPerson = async () => {
    setLoading(true)
    setError(null)
    setYoutubeVideoIds([])
    setChannel(null)
    setChannelVideos([])

    const { col, val } = slugOrId(slug);
    const { data, error } = await supabase
      .from('people')
      .select(`
        *,
        credits(
          id, role, character_name, billing_order,
          films(
            id, title, year, poster_url, trailer_youtube_id,
            view_count, average_rating, liked_percent, slug,
            release_type, trailer_youtube_id,
            film_genres(genres(name))
          )
        )
      `)
      .eq(col, val)
      .single()

    if (error) {
      setError('Could not load this profile')
      setLoading(false)
      return
    }

    const basePerson = {
      ...data,
      credits: (data.credits || []).map((credit) => ({
        ...credit,
        role: normalizeRole(credit.role),
      })),
    }

    // Increment profile views in the background
    supabase.rpc('increment_profile_views', { person_uuid: data.id }).then(() => {});

    setPerson(basePerson)
    setPersonId(data.id)
    document.title = `MuviDB | ${data.name}`

    // Posters/slugs for the films an award was won/nominated for. They aren't
    // always in this person's credits (you can win for a film we don't credit
    // them on), so fetch them by the film_id stored on each award entry.
    const awardFilmIds = [...new Set(
      (Array.isArray(basePerson.awards) ? basePerson.awards : [])
        .map((a) => a?.film_id)
        .filter(Boolean)
    )]
    if (awardFilmIds.length) {
      supabase
        .from('films')
        .select('id, slug, title, poster_url')
        .in('id', awardFilmIds)
        .then(({ data: films }) => {
          setAwardFilms(Object.fromEntries((films || []).map((f) => [f.id, f])))
        })
    } else {
      setAwardFilms({})
    }

    const rolesOrder = ['actor', 'director', 'writer', 'producer']
    const initialRole = rolesOrder.find((role) =>
      basePerson.credits.some((credit) => normalizeRole(credit.role) === role)
    ) || normalizeRole(basePerson.credits[0]?.role)
    if (initialRole) setActiveRole(initialRole)

    // Channel enrichment is optional; render the core profile immediately.
    setLoading(false)

    // Fetch linked YouTube channel
    const { data: ch } = await supabase
      .from('channels')
      .select('id, name, channel_handle, channel_url, thumbnail_url, banner_url, subscriber_count, description, category')
      .eq('owner_person_id', data.id)
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
    const mergedCredits = [...basePerson.credits]
    const existingFilmIds = new Set(mergedCredits.map(c => c.films?.id))
    const existingVideoIds = new Set()

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
      if (vid.film_id && existingFilmIds.has(vid.film_id)) continue
      if (existingVideoIds.has(vid.video_id)) continue

      existingVideoIds.add(vid.video_id)

      mergedCredits.push({
        id: `vid-${vid.video_id}`,
        role: 'actor', 
        video: vid,
        is_virtual: true
      })
    }

    const updatedPerson = { ...basePerson, credits: mergedCredits }
    setPerson(updatedPerson)
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
              view_count, average_rating, liked_percent, release_type, youtube_watch_url,
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
          id, slug, title, year, poster_url, trailer_youtube_id,
          view_count, average_rating, liked_percent, release_type, youtube_watch_url,
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
          from: `/people/${person?.slug || person?.id || slug}`,
          message: 'Sign in to follow filmmakers'
        }
      })
      return
    }
    await toggleFollow()
  }

  const creditsByRole = (role) => {
    return person?.credits
      ?.filter(c => normalizeRole(c.role) === normalizeRole(role))
      ?.sort((a, b) => {
        const yearA = a.films?.year || (a.video?.published_at && new Date(a.video.published_at).getFullYear()) || 0
        const yearB = b.films?.year || (b.video?.published_at && new Date(b.video.published_at).getFullYear()) || 0
        
        if (yearA !== yearB) {
          return yearB - yearA
        }
        return a.billing_order - b.billing_order
      }) || []
  }

  const getAvailableRoles = () => {
    if (!person?.credits) return [];
    const roles = person.credits.map(c => normalizeRole(c.role)).filter(Boolean);
    return [...new Set(roles)];
  };

  const availableRoles = getAvailableRoles();
  const primaryRoleOrder = ['actor', 'director', 'producer', 'writer'];
  const heroRoles = primaryRoleOrder.filter((role) => availableRoles.includes(role));

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
  const activeCredits = creditsByRole(activeRole)
  const knownFor = [...new Map(
    (person.credits || [])
      .filter((credit) => credit.films?.id)
      .map((credit) => [credit.films.id, credit])
  ).values()]
    .sort((a, b) => {
      const views = (b.films?.view_count || 0) - (a.films?.view_count || 0)
      if (views !== 0) return views
      const ratings = (b.films?.liked_percent || 0) - (a.films?.liked_percent || 0)
      if (ratings !== 0) return ratings
      return (b.films?.year || 0) - (a.films?.year || 0)
    })
    .slice(0, 6)

  return (
    <div className="min-h-screen bg-bg">
      <Helmet>
        <title>{`MuviDB | ${formatPersonName(person.name)}`}</title>
        <meta name="description" content={toSentenceCase(person.biography)?.slice(0, 150) || `Discover ${formatPersonName(person.name)}'s filmography and videos on MuviDB.`} />
        <meta property="og:title" content={`MuviDB | ${formatPersonName(person.name)}`} />
        <meta property="og:description" content={toSentenceCase(person.biography)?.slice(0, 150) || `Discover ${formatPersonName(person.name)}'s filmography and videos on MuviDB.`} />
        {person.photo_url && <meta property="og:image" content={person.photo_url} />}
      </Helmet>
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border relative z-10">
          <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
            <div className="flex-shrink-0 relative">
              {person.photo_url ? (
                <img
                  src={person.photo_url}
                  alt={formatPersonName(person.name)}
                  className="relative w-48 md:w-56 aspect-[3/4] rounded-lg object-cover shadow-2xl border border-border"
                />
              ) : (
                <div className="relative w-48 md:w-56 aspect-[3/4] rounded-lg bg-surface flex items-center justify-center shadow-2xl border border-border">
                  <span className="text-6xl font-bold text-brand font-heading">
                    {formatPersonName(person.name)?.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start mb-2">
                  <h1 className="text-4xl md:text-5xl font-heading font-bold text-text-primary tracking-tighter">
                    {formatPersonName(person.name)}
                  </h1>
                  {person.is_verified && (
                    <span className="bg-brand/10 text-brand text-[10px] font-bold px-3 py-1 rounded-lg border border-brand/20">
                      Verified
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center md:justify-start max-w-full">
                  {heroRoles.map(role => (
                    <span
                      key={role}
                      className="text-text-muted text-[10px] font-bold"
                    >
                      {formatRole(role)}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setShowEdit(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-text-muted hover:text-brand text-[11px] font-bold transition-colors"
                >
                  <Icon icon="solar:pen-2-linear" width="14" />
                  Suggest an edit
                </button>
                {showEdit && (
                  <SuggestEditModal
                    target="person"
                    targetId={personId}
                    targetName={formatPersonName(person.name)}
                    onClose={() => setShowEdit(false)}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-0 border border-border rounded-lg overflow-hidden bg-surface max-w-sm mx-auto md:mx-0 shadow-sm">
                <div className="p-4 border-r border-border text-center">
                  <p className="text-brand text-xl font-bold font-heading">
                    {formatViewCount(person.profile_views || person.popularity_score || totalViews)}
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

              {(person.biography || person.bio) && (
                <Biography text={toSentenceCase(person.biography || person.bio)} />
              )}

              <div className="flex flex-wrap gap-6 text-[10px] font-bold tracking-wider justify-center md:justify-start">
                {person.nationality && (
                  <span className="text-text-muted">Nationality: {toTitleCase(person.nationality)}</span>
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

              <div className="flex flex-row items-center gap-3 pt-2 justify-center md:justify-start w-full overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-6 py-3 rounded-lg font-bold text-xs transition-all disabled:opacity-50 min-h-[44px] flex-shrink-0 ${
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
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-xs transition-all border border-border text-text-primary bg-surface hover:border-brand hover:text-brand min-h-[44px] flex-shrink-0"
                  >
                    Official Channel
                  </a>
                )}
                
                <ShareAction 
                  title={person.name}
                  text={`Check out ${person.name}'s profile on MuviDB`}
                  className="!w-auto"
                  containerClassName="w-auto flex-shrink-0"
                />

                {(person.instagram_url || person.facebook_url || person.twitter_url) && (
                  <div className="h-6 w-[1px] bg-border mx-2 self-center flex-shrink-0" />
                )}

                {person.instagram_url && (
                  <a
                    href={person.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-[44px] h-[44px] rounded-lg border border-border flex items-center justify-center text-text-muted hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex-shrink-0"
                    aria-label="Instagram"
                  >
                    <Icon icon="ri:instagram-line" className="text-lg" />
                  </a>
                )}

                {person.facebook_url && (
                  <a
                    href={person.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-[44px] h-[44px] rounded-lg border border-border flex items-center justify-center text-text-muted hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex-shrink-0"
                    aria-label="Facebook"
                  >
                    <Icon icon="ri:facebook-box-line" className="text-lg" />
                  </a>
                )}

                {person.twitter_url && (
                  <a
                    href={person.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-[44px] h-[44px] rounded-lg border border-border flex items-center justify-center text-text-muted hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex-shrink-0"
                    aria-label="X (Twitter)"
                  >
                    <Icon icon="ri:twitter-x-fill" className="text-lg" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border pb-20">
        {knownFor.length > 0 && (
          <section className="p-4 md:p-8 lg:p-12 border-b border-border">
            <p className="text-brand text-[10px] font-bold uppercase tracking-widest mb-2">Career highlights</p>
            <h2 className="text-text-primary text-3xl font-bold font-heading tracking-tighter mb-6">Known For</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
              {knownFor.map((credit) => (
                <Link
                  key={`known-${credit.films.id}`}
                  to={`/films/${credit.films.slug || credit.films.id}`}
                  className="group w-36 sm:w-40 md:w-44 shrink-0 snap-start"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-2 group-hover:border-brand transition-colors">
                    <ImageWithFallback
                      src={credit.films.poster_url}
                      alt={credit.films.title}
                      fallbackType="poster"
                      name={credit.films.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                  <p className="mt-3 text-sm font-bold text-text-primary line-clamp-2 group-hover:text-brand transition-colors">
                    {formatFilmTitle(credit.films.title)}
                  </p>
                  <p className="mt-1 text-xs text-text-muted line-clamp-1">
                    {[credit.films.year, credit.character_name ? `as ${toTitleCase(credit.character_name)}` : formatRole(credit.role)]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
        <div className="p-4 md:p-8 lg:p-12">
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
                  {formatRole(role)} ({creditsByRole(role).length})
                </button>
              ))}
            </div>
          )}

          {activeCredits.length > 0 ? (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {activeCredits.slice(0, visibleCreditsCount).map(credit => {
                const film = credit.films
                const video = credit.video
                const title = film?.title || video?.title
                const poster = film?.poster_url || video?.thumbnail_url
                const link = video 
                  ? `https://www.youtube.com/watch?v=${video.video_id}` 
                  : `/films/${film?.slug || film?.id}`
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
                        <p className="text-text-primary text-[11px] font-bold tracking-tight line-clamp-2 leading-tight group-hover:text-brand transition-colors">
                          {formatFilmTitle(title)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <p className="text-text-muted text-[9px] font-black tracking-widest uppercase">
                            {film?.year || (video?.published_at && new Date(video.published_at).getFullYear())}
                          </p>
                          {credit.character_name && (
                            <p className="text-brand text-[9px] font-bold truncate">
                              as {toTitleCase(credit.character_name)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            {activeCredits.length > visibleCreditsCount && (
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={() => setVisibleCreditsCount((count) => count + 20)}
                  className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-lg border border-border bg-surface text-sm font-bold text-text-primary hover:border-brand hover:text-brand transition-colors"
                >
                  <Icon icon="solar:add-circle-linear" width="18" />
                  Show more credits
                </button>
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-20 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
              <p className="text-text-muted font-bold text-xs">
                No credits available yet
              </p>
            </div>
          )}
        </div>

        {/* Awards (people.awards jsonb) */}
        {Array.isArray(person.awards) && person.awards.length > 0 && (
        <div className="p-4 md:p-8 lg:p-12 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-8">
            <h2 className="text-text-primary text-3xl font-bold font-heading tracking-tighter">
              Awards
            </h2>
            {Array.isArray(person.awards) && person.awards.length > 0 && (() => {
              // IMDb-style tally: wins counted separately from nominations.
              const wins = person.awards.filter((a) => a.won !== false).length
              const noms = person.awards.filter((a) => a.won === false).length
              const parts = []
              if (wins) parts.push(`${wins} ${wins === 1 ? 'win' : 'wins'}`)
              if (noms) parts.push(`${noms} ${noms === 1 ? 'nomination' : 'nominations'}`)
              return (
                <span className="text-[10px] font-black uppercase tracking-widest bg-brand/10 text-brand border border-brand/20 rounded-full px-3 py-1">
                  {parts.join(' & ')} total
                </span>
              )
            })()}
          </div>

          {Array.isArray(person.awards) && person.awards.length > 0 ? (
            <div className="space-y-8 max-w-3xl">
              {Object.entries(
                // Group by awarding body (IMDb lists a block per organisation).
                person.awards.reduce((acc, a) => {
                  const org = a.organization || 'Awards'
                  ;(acc[org] = acc[org] || []).push(a)
                  return acc
                }, {})
              ).map(([org, entries]) => (
                <div key={org}>
                  {/* Org heading with the brand accent bar */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-1 h-6 bg-brand rounded-full shrink-0" />
                    <h3 className="text-text-primary text-xl font-bold font-heading tracking-tight">
                      {org}
                    </h3>
                  </div>

                  <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
                    {[...entries]
                      .sort((a, b) => (b.year || 0) - (a.year || 0) || (b.season || 0) - (a.season || 0))
                      .map((award, idx) => {
                        const film = award.film_id ? awardFilms[award.film_id] : null
                        const workTitle = award.work || award.title
                        return (
                          <div
                            key={`${org}-${award.season}-${award.category}-${idx}`}
                            className="flex items-start gap-4 px-4 py-4"
                          >
                            {/* Poster thumb (IMDb shows the work's art) */}
                            <div className="w-[46px] shrink-0 aspect-[2/3] rounded overflow-hidden bg-surface-2 border border-border">
                              {film?.poster_url ? (
                                <ImageWithFallback
                                  src={film.poster_url}
                                  alt={workTitle || ''}
                                  fallbackType="banner"
                                  name={workTitle || ''}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Icon icon="solar:cup-star-bold" className="text-base text-text-muted/40" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* "2025 Nominee" / "2024 Winner" */}
                              <p className="text-sm">
                                <span className="text-text-primary font-bold">
                                  {award.year || (award.season ? `Season ${award.season}` : '')}{' '}
                                  {award.won === false ? 'Nominee' : 'Winner'}
                                </span>
                                <span className="text-text-muted ml-2">
                                  {org}
                                  {award.season ? ` ${award.season}` : ''}
                                </span>
                              </p>
                              {award.category && (
                                <p className="text-text-secondary text-sm mt-0.5">
                                  {toTitleCase(award.category)}
                                </p>
                              )}
                              {workTitle && (
                                film?.slug || film?.id ? (
                                  <Link
                                    to={`/films/${film.slug || film.id}`}
                                    className="text-brand text-sm hover:underline mt-0.5 inline-block"
                                  >
                                    {formatFilmTitle(workTitle)}
                                  </Link>
                                ) : (
                                  <p className="text-text-muted text-sm mt-0.5">{formatFilmTitle(workTitle)}</p>
                                )
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border bg-surface-2/20 py-16 flex flex-col items-center justify-center text-center gap-3">
              <Icon icon="solar:cup-star-bold" className="text-5xl text-text-muted/40" />
              <p className="text-text-secondary text-sm font-bold">No awards listed yet</p>
              <p className="text-text-muted text-xs max-w-md px-4">
                We&apos;re still compiling {formatPersonName(person.name)}&apos;s awards and honours.
              </p>
            </div>
          )}
        </div>
        )}

        {channel && (
          <div className="p-8 md:p-12 border-t border-border bg-surface-2/5 relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none"></div>
            <h2 className="text-text-primary text-2xl font-bold mb-8 font-heading tracking-tighter relative z-10">
              Official Channel
            </h2>

            <Link
              to={`/channels/${channel.slug || channel.id}`}
              className="relative z-10 group flex flex-col sm:flex-row items-center gap-8 bg-surface rounded-xl border border-border hover:border-brand transition-all duration-500 overflow-hidden shadow-sm p-8 max-w-3xl"
            >
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-brand blur-lg opacity-10 group-hover:opacity-30 transition-opacity"></div>
                <ImageWithFallback
                  src={channel.thumbnail_url}
                  alt={channel.name}
                  fallbackType="avatar"
                  name={channel.name}
                  className="relative w-24 h-24 rounded-lg border border-border object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center gap-3 justify-center sm:justify-start mb-2">
                  <p className="text-text-primary font-bold text-xl tracking-tighter group-hover:text-brand transition-colors truncate">
                    {toTitleCase(channel.name)}
                  </p>
                  <span className="bg-[#FF0000]/10 text-[#FF0000] text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border border-[#FF0000]/20">CHANNEL</span>
                </div>
                
                {channel.subscriber_count > 0 && (
                  <p className="text-text-muted text-[10px] font-black tracking-widest mb-4">
                    {formatViewCount(channel.subscriber_count)} Subscribers • {toTitleCase(channel.category || 'Official')}
                  </p>
                )}
                {channel.description && (
                  <p className="text-text-muted text-xs line-clamp-2 leading-relaxed italic opacity-80">
                    {toSentenceCase(channel.description)}
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
