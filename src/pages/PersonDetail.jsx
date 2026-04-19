import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFollow } from '../hooks/useFollow'
import { useAuth } from '../context/AuthContext'
import { formatViewCount } from '../utils/youtube'
import { getPersonYoutubeChannelUrl } from '../lib/youtube'

const PLATFORM_STYLES = {
  cinema:   { label: 'Cinema',   bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
  netflix:  { label: 'Netflix',  bg: 'bg-red-600/20',     text: 'text-red-400',     dot: 'bg-red-500'    },
  youtube:  { label: 'YouTube',  bg: 'bg-red-500/20',     text: 'text-red-400',     dot: 'bg-red-500'    },
  amazon:   { label: 'Prime',    bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-400'   },
  showmax:  { label: 'Showmax',  bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: 'bg-purple-400' },
  iroko:    { label: 'iROKO',    bg: 'bg-green-500/20',   text: 'text-green-400',   dot: 'bg-green-400'  },
}

function PlatformBadge({ releaseType }) {
  if (!releaseType) return null
  const key = releaseType.toLowerCase()
  const style = PLATFORM_STYLES[key]
  if (!style) return (
    <span className="text-[9px] font-bold uppercase tracking-widest text-[#7A8099] bg-[#1C2440] px-1.5 py-0.5 rounded">
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

const PersonDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [person, setPerson] = useState(null)
  const [channel, setChannel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeRole, setActiveRole] = useState('actor')

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

    const { data, error } = await supabase
      .from('people')
      .select(`
        *,
        credits(
          id, role, character_name, billing_order,
          films(
            id, title, year, poster_url,
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

    // Set default active role tab
    const roles = ['actor', 'director', 'writer', 'producer']
    const firstRole = roles.find(r =>
      data.credits?.some(c => c.role === r)
    )
    if (firstRole) setActiveRole(firstRole)

    setLoading(false)
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

  // Group credits by role
  const creditsByRole = (role) => {
    return person?.credits
      ?.filter(c => c.role === role)
      ?.sort((a, b) => {
        if (a.films?.year && b.films?.year) {
          return b.films.year - a.films.year
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
    return (
      <div className="min-h-screen bg-[#0A0F1E] pt-20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="flex gap-6">
              <div className="w-48 h-48 rounded-2xl bg-[#13192B]" />
              <div className="flex-1 space-y-4">
                <div className="h-8 bg-[#13192B] rounded w-64" />
                <div className="h-4 bg-[#13192B] rounded w-48" />
                <div className="h-20 bg-[#13192B] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">
            {error || 'Person not found'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-[#D4A017] hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const totalFilms = person.credits?.length || 0
  const totalViews = person.credits?.reduce(
    (sum, c) => sum + (c.films?.view_count || 0), 0
  ) || 0

  return (
    <div className="min-h-screen bg-[#0A0F1E]">
      {/* Hero Section */}
      <div className="bg-[#13192B] border-b border-[#252D45]">
        <div className="max-w-6xl mx-auto px-4 py-8 pt-24">
          <div className="flex flex-col md:flex-row gap-8">

            {/* Photo */}
            <div className="flex-shrink-0">
              {person.photo_url ? (
                <img
                  src={person.photo_url}
                  alt={person.name}
                  className="w-48 h-48 md:w-56 md:h-56 rounded-2xl object-cover shadow-2xl"
                />
              ) : (
                <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl bg-[#1C2440] flex items-center justify-center shadow-2xl">
                  <span className="text-6xl font-bold text-[#D4A017]">
                    {person.name?.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              {/* Name + verified */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold text-[#F5F0E8]">
                  {person.name}
                </h1>
                {person.is_verified && (
                  <span className="bg-[#D4A017] text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* Roles */}
              <div className="flex flex-wrap gap-2">
                {availableRoles.map(role => (
                  <span
                    key={role}
                    className="text-[#7A8099] text-sm capitalize"
                  >
                    {roleLabels[role]}
                    {availableRoles.indexOf(role) <
                      availableRoles.length - 1 && ' ·'}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[#D4A017] text-2xl font-bold">
                    {formatViewCount(
                      person.popularity_score || totalViews
                    )}
                  </p>
                  <p className="text-[#7A8099] text-xs">
                    Total Views
                  </p>
                </div>
                <div>
                  <p className="text-[#D4A017] text-2xl font-bold">
                    {totalFilms}
                  </p>
                  <p className="text-[#7A8099] text-xs">
                    Credits
                  </p>
                </div>
                <div>
                  <p className="text-[#D4A017] text-2xl font-bold">
                    {followerCount.toLocaleString()}
                  </p>
                  <p className="text-[#7A8099] text-xs">
                    Followers
                  </p>
                </div>
              </div>

              {/* Bio */}
              {person.biography && (
                <p className="text-[#F5F0E8] text-sm leading-relaxed max-w-2xl">
                  {person.biography}
                </p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap gap-4 text-sm">
                {person.nationality && (
                  <span className="text-[#7A8099]">
                    🌍 {person.nationality}
                  </span>
                )}
                {person.birth_date && (
                  <span className="text-[#7A8099]">
                    🎂 {new Date(
                      person.birth_date
                    ).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                )}
              </div>

              {/* Actions: Follow + view YouTube */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-8 py-3 rounded-full font-semibold text-sm transition-all disabled:opacity-50 ${
                    isFollowing
                      ? 'bg-transparent border border-[#D4A017] text-[#D4A017] hover:bg-red-900/20 hover:border-red-400 hover:text-red-400'
                      : 'bg-[#D4A017] text-black hover:bg-[#D4A017]/90'
                  }`}
                >
                  {followLoading
                    ? '...'
                    : isFollowing
                    ? 'Following'
                    : '+ Follow'
                  }
                </button>

                {getPersonYoutubeChannelUrl(person) && (
                  <a
                    href={getPersonYoutubeChannelUrl(person)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all border-2 border-[#FF0000]/40 text-[#F5F0E8] bg-[#13192B] hover:bg-[#FF0000]/10 hover:border-[#FF0000]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[#FF0000]">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                    </svg>
                    View channel
                    {person.youtube_stats?.subscribers != null && (
                      <span className="text-[11px] font-normal text-[#7A8099] tabular-nums">
                        ({formatViewCount(Number(person.youtube_stats.subscribers))})
                      </span>
                    )}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filmography */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-[#F5F0E8] text-2xl font-bold mb-6">
          Filmography
        </h2>

        {/* Role tabs */}
        {availableRoles.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {availableRoles.map(role => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeRole === role
                    ? 'bg-[#D4A017] text-black'
                    : 'bg-[#13192B] text-[#7A8099] hover:text-[#F5F0E8]'
                }`}
              >
                {roleLabels[role]} ({creditsByRole(role).length})
              </button>
            ))}
          </div>
        )}

        {/* Credits grid */}
        {creditsByRole(activeRole).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {creditsByRole(activeRole).map(credit => (
              <Link
                key={credit.id}
                to={`/films/${credit.films?.id}`}
                className="group block"
              >
                <div className="relative overflow-hidden rounded-xl aspect-[2/3] bg-[#13192B]">
                  {credit.films?.poster_url ? (
                    <img
                      src={credit.films.poster_url}
                      alt={credit.films.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl">🎬</span>
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {/* Rating badge */}
                  {credit.films?.average_rating > 0 && (
                    <div className="absolute top-2 right-2 bg-[#D4A017] text-black text-xs font-bold px-2 py-0.5 rounded-lg">
                      {credit.films.average_rating} ★
                    </div>
                  )}

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-[#F5F0E8] text-xs font-semibold line-clamp-2">
                      {credit.films?.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <p className="text-[#7A8099] text-xs">
                        {credit.films?.year}
                      </p>
                      <PlatformBadge releaseType={credit.films?.release_type} />
                    </div>
                    {credit.character_name && (
                      <p className="text-[#D4A017] text-xs mt-0.5 italic">
                        as {credit.character_name}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🎬</p>
            <p className="text-[#F5F0E8] font-medium">
              No {roleLabels[activeRole]} credits yet
            </p>
          </div>
        )}
      </div>

      {/* YouTube Channel Section */}
      {channel && (
        <div className="max-w-6xl mx-auto px-4 pb-12">
          <h2 className="text-[#F5F0E8] text-2xl font-bold mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#FF0000">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
            YouTube Channel
          </h2>

          <Link
            to={`/channels/${channel.id}`}
            className="group flex items-center gap-5 bg-[#13192B] rounded-2xl border border-[#252D45] hover:border-[#FF0000]/40 transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-[#FF0000]/5 p-4 max-w-xl"
          >
            {/* Thumbnail */}
            {channel.thumbnail_url ? (
              <img
                src={channel.thumbnail_url}
                alt={channel.name}
                className="w-16 h-16 rounded-full border-2 border-[#252D45] object-cover flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-[#252D45] bg-[#1C2440] flex items-center justify-center flex-shrink-0">
                <span className="text-[#D4A017] font-bold text-2xl">{channel.name?.charAt(0)}</span>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[#F5F0E8] font-bold text-base group-hover:text-[#FF4444] transition-colors truncate">
                {channel.name}
              </p>
              {channel.channel_handle && (
                <p className="text-[#7A8099] text-xs mt-0.5">@{channel.channel_handle.replace(/^@/, '')}</p>
              )}
              {channel.subscriber_count > 0 && (
                <p className="text-[#7A8099] text-xs mt-1">
                  {formatViewCount(channel.subscriber_count)} subscribers
                </p>
              )}
              {channel.description && (
                <p className="text-[#7A8099] text-xs mt-1.5 line-clamp-2 leading-relaxed">
                  {channel.description}
                </p>
              )}
            </div>

            {/* Arrow */}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7A8099] group-hover:text-[#FF4444] flex-shrink-0 transition-colors">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}

export default PersonDetail