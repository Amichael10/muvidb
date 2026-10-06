import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link, useLoaderData } from 'react-router-dom'
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
import { normalizeRole, formatRole, canonicalizeRole } from '../lib/creditRoles'
import { Skeleton } from '../components/ui/Skeleton'
import ShareAction from '../components/ui/ShareAction'
import ImageWithFallback from '../components/ui/ImageWithFallback'
import { slugOrId } from '../utils/slug'
import { formatPersonName, toTitleCase, toSentenceCase, formatFilmTitle, formatDateOfBirth } from '../utils/format'
import { nationalityToCountryName } from '../utils/africanCountries'
import { fetchPersonStageCredits, getPlayDateLabel } from '../lib/plays'
import ProVideoTheaterModal from '../components/professional/ProVideoTheaterModal'
import CareerPassportModal from '../components/professional/CareerPassportModal'
import WhatsAppOptInModal from '../components/person/WhatsAppOptInModal'
import AddPersonMediaModal from '../components/person/AddPersonMediaModal'
import PersonPhotoLightboxModal from '../components/person/PersonPhotoLightboxModal'
import BookingModal from '../components/person/BookingModal'

const PLATFORM_STYLES = {
  cinema:      { label: 'Cinema',   bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  netflix:     { label: 'Netflix',  bg: 'bg-red-600/20',    text: 'text-red-400',    dot: 'bg-red-500'    },
  youtube:     { label: 'YouTube',  bg: 'bg-red-500/20',    text: 'text-red-400',    dot: 'bg-red-500'    },
  amazon:      { label: 'Prime',    bg: 'bg-blue-500/20',   text: 'text-blue-400',   dot: 'bg-blue-400'   },
  prime_video: { label: 'Prime',    bg: 'bg-blue-500/20',   text: 'text-blue-400',   dot: 'bg-blue-400'   },
  iroko:       { label: 'iROKO',    bg: 'bg-green-500/20',  text: 'text-green-400',  dot: 'bg-green-400'  },
  kava:        { label: 'Kava',     bg: 'bg-pink-500/20',   text: 'text-pink-400',   dot: 'bg-pink-500'   },
  docuth:      { label: 'Docuth',   bg: 'bg-zinc-800/40',   text: 'text-zinc-200',   dot: 'bg-zinc-400'   },
}

function PlatformBadge({ releaseType, film }) {
  if (!releaseType) return null
  const key = String(releaseType).toLowerCase().trim()
  if (key === 'showmax' || key === 'mubi' || key === 'unreleased' || key === 'unknown') return null

  if (key === 'cinema' || key === 'theatrical') {
    const isVerifiedCinema = Boolean(
      film?.is_in_cinemas ||
      (film?.box_office_domestic && Number(film.box_office_domestic) > 0) ||
      film?.box_office_source ||
      film?.streaming_links?.box_office ||
      film?.streaming_links?.cinema ||
      film?.streaming_links?.showtimes
    )
    if (!isVerifiedCinema) return null
  }

  const style = PLATFORM_STYLES[key]
  if (!style) return null

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${style.text} ${style.bg} px-2 py-0.5 rounded`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

function canonicalizeAwardOrg(org) {
  if (!org) return 'Honorary Awards'
  const raw = String(org).trim()
  const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (lower.includes('citypeople')) return 'City People'
  if (lower.includes('amvca') || lower.includes('africamagic')) return 'AMVCA'
  if (lower.includes('bon') || lower.includes('bestofnollywood')) return 'BON Awards'
  if (lower.includes('oafp')) return 'OAFP Awards'
  if (lower.includes('amaa') || lower.includes('africamovieacademy')) return 'AMAA'
  if (lower.includes('tinff') || lower.includes('toronto')) return 'TINFF'
  if (lower.includes('nma') || lower.includes('nollywoodmovies')) return 'NMA'
  return raw.replace(/_/g, ' ')
}

function getVideoEmbedData(video) {
  if (!video) return { isDirect: false, embedSrc: '' }
  const isYouTube = video.embed_provider === 'youtube' || video.url?.includes('youtube.com') || video.url?.includes('youtu.be')
  const isVimeo = video.embed_provider === 'vimeo' || video.url?.includes('vimeo.com')
  const isGDrive = video.embed_provider === 'gdrive' || video.url?.includes('drive.google.com')
  const isDailymotion = video.embed_provider === 'dailymotion' || video.url?.includes('dailymotion.com') || video.url?.includes('dai.ly')
  const isDirect = video.embed_provider === 'r2' || (!isYouTube && !isVimeo && !isGDrive && !isDailymotion)

  let embedSrc = ''
  if (isYouTube) {
    const id = video.embed_id || video.url?.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]+)/)?.[1]
    embedSrc = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
  } else if (isVimeo) {
    const match = video.url?.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/) || video.url?.match(/vimeo\.com\/(\d+)/)
    const id = video.embed_id || (match ? (match[3] || match[1] || match[0]) : null)
    embedSrc = `https://player.vimeo.com/video/${id}?autoplay=1`
  } else if (isGDrive) {
    const match = video.url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || video.url?.match(/id=([a-zA-Z0-9_-]+)/)
    const id = video.embed_id || (match ? match[1] : null)
    embedSrc = id ? `https://drive.google.com/file/d/${id}/preview` : video.url
  } else if (isDailymotion) {
    const match = video.url?.match(/(?:video\/|dai\.ly\/)([a-zA-Z0-9]+)/)
    const id = video.embed_id || (match ? match[1] : null)
    embedSrc = `https://www.dailymotion.com/embed/video/${id}?autoplay=1`
  }
  return { isDirect, embedSrc }
}

const Biography = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLong = text.length > 320
  const displayText = isExpanded ? text : text.slice(0, 320) + (isLong ? '...' : '')

  return (
    <div className="space-y-3">
      <p className="text-text-secondary text-sm md:text-base leading-relaxed max-w-3xl">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-brand text-[10px] font-black uppercase tracking-widest hover:underline transition-all inline-flex items-center gap-1"
        >
          {isExpanded ? 'READ LESS ↑' : 'READ FULL BIOGRAPHY ↓'}
        </button>
      )}
    </div>
  )
}

const PersonDetailSkeleton = () => (
  <div className="min-h-screen bg-bg">
    <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-12 pt-24 border-x border-border">
        <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
          <div className="w-56 aspect-[3/4] rounded-2xl bg-surface-2 animate-shimmer shrink-0 shadow-2xl"></div>
          <div className="flex-1 space-y-6 w-full">
            <div className="h-12 w-2/3 bg-surface-2 rounded-lg animate-shimmer"></div>
            <div className="h-4 w-1/3 bg-surface-2 rounded-md animate-shimmer"></div>
            <div className="h-20 w-full bg-surface-2 rounded-xl animate-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

export default function PersonDetailV2() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user, refreshUserProfile } = useAuth()
  const loaderData = useLoaderData()

  const seededPerson = loaderData?.person
    ? {
        ...loaderData.person,
        credits: (loaderData.person.credits || []).map((credit) => ({
          ...credit,
          role: canonicalizeRole(credit.role),
        })),
      }
    : null

  const [person, setPerson] = useState(seededPerson)
  const [representations, setRepresentations] = useState(seededPerson?.talent_representations || [])
  const [media, setMedia] = useState(seededPerson?.person_media || [])
  const [stageCredits, setStageCredits] = useState([])
  const [awardFilms, setAwardFilms] = useState({})
  const [personId, setPersonId] = useState(seededPerson?.id ?? null)
  const [channel, setChannel] = useState(null)
  const [channelVideos, setChannelVideos] = useState([])
  const [loading, setLoading] = useState(!seededPerson)
  const [error, setError] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [activeRole, setActiveRole] = useState('actor')
  const [visibleCreditsCount, setVisibleCreditsCount] = useState(24)
  const [filmographySearch, setFilmographySearch] = useState('')
  const [filmographyView, setFilmographyView] = useState('grid') // 'grid' | 'list'
  const [filmographyMedium, setFilmographyMedium] = useState('screen') // 'screen' | 'stage'
  const [visibleStageCount, setVisibleStageCount] = useState(6)
  const [passportOpen, setPassportOpen] = useState(false)
  const [whatsappOptInOpen, setWhatsappOptInOpen] = useState(false)
  const [showAddMedia, setShowAddMedia] = useState(false)
  const [addMediaInitialType, setAddMediaInitialType] = useState('video')
  const [bookingModalOpen, setBookingModalOpen] = useState(false)

  // Header Dropdown Menu State
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  const moreActionsRef = useRef(null)

  // Awards Section States
  const [selectedAwardOrg, setSelectedAwardOrg] = useState('all')

  // Media Hub States
  const [mediaTab, setMediaTab] = useState('all') // 'all' | 'videos' | 'monologues' | 'photos'
  const [activeVideoModal, setActiveVideoModal] = useState(null)
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(null)
  const [inlinePlayingVideoId, setInlinePlayingVideoId] = useState(null)

  const awardsRef = useRef(null)

  const canManage = Boolean(
    user && (
      user.id === person?.claimed_by ||
      user.role === 'admin' ||
      user.is_admin ||
      user.app_metadata?.role === 'admin' ||
      user.user_metadata?.role === 'admin'
    )
  )

  const {
    isFollowing,
    followerCount,
    loading: followLoading,
    toggleFollow
  } = useFollow(personId, user)

  const seededSlug = useRef(seededPerson ? slug : null)

  useEffect(() => {
    let preloaded = null
    if (seededSlug.current === slug) {
      preloaded = loaderData?.person ?? null
      seededSlug.current = null
    }
    fetchPerson(preloaded)
  }, [slug])

  useEffect(() => {
    setVisibleCreditsCount(24)
  }, [activeRole, filmographySearch, filmographyView, filmographyMedium])

  // Handle click outside More Actions menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target)) {
        setMoreActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchPerson = async (preloaded = null) => {
    if (!preloaded) setLoading(true)
    setError(null)
    setChannel(null)
    setChannelVideos([])

    const { col, val } = slugOrId(slug)
    const { data, error } = preloaded
      ? { data: preloaded, error: null }
      : await supabase
      .from('people')
      .select(`
        *,
        person_aliases(alias),
        credits(
          id, role, character_name, billing_order,
          films(
            id, title, year, poster_url, trailer_youtube_id,
            view_count, average_rating, liked_percent, slug,
            release_type, streaming_links,
            box_office_domestic, box_office_currency, box_office_source,
            film_genres(genres(name))
          )
        ),
        person_media(
          id, media_type, category, title, description,
          url, thumbnail_url, r2_key, embed_provider, embed_id,
          duration_seconds, width, height, aspect_ratio,
          film_id, character_name, photographer_credit, year,
          is_primary, sort_order, status,
          films(id, title, year, poster_url, slug)
        ),
        talent_representations(
          id, representation_type, agent_name, contact_email, contact_phone, booking_url, is_primary, notes,
          companies(id, name, slug, logo_url, company_type, headquarters, website, instagram_url)
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
        role: canonicalizeRole(credit.role),
      })),
    }

    supabase.rpc('increment_profile_views', { person_uuid: data.id }).then(() => {})

    setPerson(basePerson)
    setPersonId(data.id)

    if (data.talent_representations) {
      setRepresentations(data.talent_representations)
    } else {
      supabase
        .from('talent_representations')
        .select(`
          id, representation_type, agent_name, contact_email, contact_phone, booking_url, is_primary, notes,
          companies(id, name, slug, logo_url, company_type, headquarters, website, instagram_url)
        `)
        .eq('person_id', data.id)
        .then(({ data: repData }) => {
          if (repData) setRepresentations(repData)
        })
    }

    if (data.person_media) {
      setMedia(data.person_media)
    } else {
      supabase
        .from('person_media')
        .select(`
          id, media_type, category, title, description,
          url, thumbnail_url, r2_key, embed_provider, embed_id,
          duration_seconds, width, height, aspect_ratio,
          film_id, character_name, photographer_credit, year,
          is_primary, sort_order, status,
          films(id, title, year, poster_url, slug)
        `)
        .eq('person_id', data.id)
        .eq('status', 'approved')
        .order('sort_order', { ascending: true })
        .then(({ data: mediaData }) => {
          if (mediaData) setMedia(mediaData)
        })
    }

    fetchPersonStageCredits(data.id).then(sc => setStageCredits(sc || []))

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

    // Determine initial role
    const rolesOrder = ['actor', 'director', 'producer', 'writer']
    const initialRole = rolesOrder.find((role) =>
      basePerson.credits.some((credit) => canonicalizeRole(credit.role) === role)
    ) || canonicalizeRole(basePerson.credits[0]?.role)
    if (initialRole) setActiveRole(initialRole)

    // YouTube Channel Discovery
    const channelQuery = data.youtube_channel_id
      ? { col: 'channel_id', val: data.youtube_channel_id }
      : data.youtube_handle
      ? { col: 'slug', val: data.youtube_handle.replace(/^@/, '') }
      : null

    if (channelQuery) {
      supabase
        .from('channels')
        .select('*')
        .eq(channelQuery.col, channelQuery.val)
        .maybeSingle()
        .then(({ data: channelData }) => {
          if (channelData) {
            setChannel(channelData)
            fetchRecentVideosFromChannel(channelData.channel_id, 4).then(setChannelVideos)
          } else if (data.youtube_handle) {
            resolveChannelId(data.youtube_handle).then(async (resolvedId) => {
              if (resolvedId) {
                const { data: c2 } = await supabase
                  .from('channels')
                  .select('*')
                  .eq('channel_id', resolvedId)
                  .maybeSingle()
                if (c2) {
                  setChannel(c2)
                  fetchRecentVideosFromChannel(c2.channel_id, 4).then(setChannelVideos)
                }
              }
            })
          }
        })
    }

    setLoading(false)
  }

  const handleFollow = async () => {
    if (!user) {
      navigate(`/login?redirect=/people/${slug}`)
      return
    }
    const wasFollowing = isFollowing
    const success = await toggleFollow()
    if (!success) return

    // If user just followed (was not following before):
    if (!wasFollowing) {
      const savedPhone = user.whatsapp_phone || user.user_metadata?.whatsapp_phone || localStorage.getItem('muvidb_user_whatsapp_phone')
      if (savedPhone) {
        // User already has WhatsApp configured in profile: 1-click follow with automatic alerts
        supabase
          .from('follows')
          .update({ notify_whatsapp: true })
          .eq('user_id', user.id)
          .eq('person_id', personId)
          .then(() => {})
        toast.success(`Following ${person?.name || 'filmmaker'}! WhatsApp alerts active.`)
      } else {
        // User doesn't have a phone number yet: open modal once to save it to profile
        setWhatsappOptInOpen(true)
      }
    } else {
      toast.success(`Unfollowed ${person?.name || 'filmmaker'}.`)
    }
  }

  // ── Role normalization & Deduplication ──
  const roleCounts = useMemo(() => {
    const counts = {}
    ;(person?.credits || []).forEach((c) => {
      const canonical = canonicalizeRole(c.role)
      if (canonical) {
        counts[canonical] = (counts[canonical] || 0) + 1
      }
    })
    return counts
  }, [person])

  // Sort available roles descending by credit count
  const sortedRoles = useMemo(() => {
    return Object.keys(roleCounts).sort((a, b) => roleCounts[b] - roleCounts[a])
  }, [roleCounts])

  // Display top 4 as direct buttons, collapse the rest into a clean dropdown
  const primaryRoleButtons = sortedRoles.slice(0, 4)
  const secondaryRoles = sortedRoles.slice(4)

  const creditsByRole = (role) => {
    return (person?.credits || [])
      .filter((credit) => canonicalizeRole(credit.role) === role)
      .sort((a, b) => {
        const yearA = a.films?.year || 0
        const yearB = b.films?.year || 0
        if (yearA !== yearB) return yearB - yearA
        return (a.billing_order ?? 99) - (b.billing_order ?? 99)
      })
  }

  const primaryRoleOrder = ['actor', 'director', 'producer', 'writer']
  const heroRoles = primaryRoleOrder.filter((role) => sortedRoles.includes(role))

  // ── Media Processing (Showreels, Monologues, & Photos - User/Admin Uploaded & Approved Only) ──
  const { photos, videos, monologues } = useMemo(() => {
    const p = []
    const v = []
    const m = []

    if (media && Array.isArray(media)) {
      media.forEach((item) => {
        if (!item || (item.status && item.status !== 'approved')) return
        const isMono = item.category === 'monologue' || item.title?.toLowerCase().includes('monologue')
        const isVideo = item.media_type === 'video' || (item.url && (item.url.includes('youtube.com') || item.url.includes('youtu.be') || item.url.includes('vimeo.com') || item.url.includes('drive.google.com') || item.url.includes('dailymotion.com') || item.url.includes('dai.ly')))
        
        let thumb = item.thumbnail_url || item.url
        if (!item.thumbnail_url && item.url) {
          const ytMatch = item.url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&?#/]+)/)
          if (ytMatch) {
            thumb = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
          } else if (item.url.includes('dailymotion') || item.url.includes('dai.ly')) {
            const dmMatch = item.url.match(/(?:video\/|dai\.ly\/)([a-zA-Z0-9]+)/)
            if (dmMatch) thumb = `https://www.dailymotion.com/thumbnail/video/${dmMatch[1]}`
          }
        }

        const mediaObj = {
          id: item.id,
          type: isVideo ? 'video' : 'photo',
          category: item.category || (isMono ? 'monologue' : 'showreel'),
          title: item.title || (isMono ? 'Monologue Performance' : 'Featured Media'),
          description: item.description,
          url: item.url,
          thumbnail: thumb,
          embed_provider: item.embed_provider || (item.url?.includes('drive.google') ? 'gdrive' : item.url?.includes('vimeo') ? 'vimeo' : item.url?.includes('dailymotion') || item.url?.includes('dai.ly') ? 'dailymotion' : 'youtube'),
          embed_id: item.embed_id,
          duration: item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, '0')}` : null,
          film_title: item.films?.title || item.film_title || null,
          character_name: item.character_name || null,
          year: item.year || null,
          is_primary: item.is_primary || false
        }

        if (mediaObj.type === 'photo') {
          p.push(mediaObj)
        } else {
          v.push(mediaObj)
          if (isMono) m.push(mediaObj)
        }
      })
    }

    return { photos: p, videos: v, monologues: m }
  }, [media])

  const featuredVideo = videos.find(v => v.category === 'monologue') || videos.find(v => v.category === 'showreel') || videos[0] || null

  // ── Known For Calculation ──
  const rawAwards = Array.isArray(person?.awards) ? person.awards : []
  const canonicalAwardEntries = useMemo(() => {
    return rawAwards.map(a => ({
      ...a,
      canonicalOrg: canonicalizeAwardOrg(a.organization)
    }))
  }, [rawAwards])

  const awardWins = canonicalAwardEntries.filter((award) => award.won !== false).length
  const awardNominations = canonicalAwardEntries.filter((award) => award.won === false).length
  const awardSummary = [
    awardWins ? `${awardWins} ${awardWins === 1 ? 'Win' : 'Wins'}` : '',
    awardNominations ? `${awardNominations} ${awardNominations === 1 ? 'Nomination' : 'Nominations'}` : '',
  ].filter(Boolean).join(' · ')

  // Awards Organization Grouping & Filtering (Canonicalized & Sorted by Count)
  const awardOrgs = useMemo(() => {
    const orgs = {}
    canonicalAwardEntries.forEach((a) => {
      orgs[a.canonicalOrg] = (orgs[a.canonicalOrg] || 0) + 1
    })
    return orgs
  }, [canonicalAwardEntries])

  const sortedAwardOrgs = useMemo(() => {
    return Object.entries(awardOrgs).sort((a, b) => b[1] - a[1])
  }, [awardOrgs])

  const filteredAwards = useMemo(() => {
    let list = [...canonicalAwardEntries]
    if (selectedAwardOrg !== 'all') {
      list = list.filter((a) => a.canonicalOrg === selectedAwardOrg)
    }
    return list.sort((a, b) => (b.year || 0) - (a.year || 0))
  }, [canonicalAwardEntries, selectedAwardOrg])

  const getCreditBoxOffice = (credit) => {
    const film = credit.films || {}
    const source = film.streaming_links?.box_office?.source || film.box_office_source
    if (!source && !film.box_office_domestic) return 0
    const dom = film.streaming_links?.box_office?.domestic || film.box_office_domestic || 0
    return typeof dom === 'number' ? dom : parseFloat(dom) || 0
  }

  const scoreCreditForKnownFor = (credit) => {
    const film = credit.films || {}
    let score = 0
    if (film.poster_url && !film.poster_url.includes('placeholder')) score += 10000
    const boxOffice = getCreditBoxOffice(credit)
    if (boxOffice >= 1_000_000_000) score += 8000
    else if (boxOffice >= 100_000_000) score += 4500
    else if (boxOffice > 0) score += 3000

    const relType = String(film.release_type || '').toLowerCase()
    if (relType === 'cinema' || relType === 'theatrical') score += 2000
    else if (['netflix', 'prime', 'amazon_prime'].includes(relType)) score += 1500

    const role = canonicalizeRole(credit.role)
    const order = credit.billing_order ?? 99
    if (role === 'actor') {
      if (order === 1) score += 2000
      else if (order <= 3) score += 1500
      else if (order <= 6) score += 900
    } else if (['director', 'creator'].includes(role)) {
      score += 1800
    }
    const views = typeof film.view_count === 'number' ? film.view_count : parseInt(film.view_count, 10) || 0
    if (views > 0) score += Math.min(2500, Math.floor(Math.log10(views + 1) * 250))
    return score
  }

  const filmCreditMap = new Map()
  for (const credit of (person?.credits || [])) {
    const filmId = credit.films?.id
    if (!filmId) continue
    const existing = filmCreditMap.get(filmId)
    if (!existing || scoreCreditForKnownFor(credit) > scoreCreditForKnownFor(existing)) {
      filmCreditMap.set(filmId, credit)
    }
  }

  const knownFor = [...filmCreditMap.values()]
    .sort((a, b) => scoreCreditForKnownFor(b) - scoreCreditForKnownFor(a))
    .slice(0, 6)

  // ── Impact Stats ──
  const allCredits = person?.credits || []
  const leadCredits = allCredits.filter(c => {
    const role = canonicalizeRole(c.role)
    const order = c.billing_order ?? 99
    return (role === 'actor' && order <= 3) || ['producer', 'director'].includes(role)
  })
  const totalBoxOffice = allCredits.reduce((acc, c) => acc + getCreditBoxOffice(c), 0)
  const leadBoxOffice = leadCredits.reduce((acc, c) => acc + getCreditBoxOffice(c), 0)
  const displayBoxOffice = leadBoxOffice > 0 ? leadBoxOffice : totalBoxOffice

  const totalYoutubeViews = allCredits.reduce((acc, c) => {
    const v = c.films?.view_count || 0
    return acc + (typeof v === 'number' ? v : parseInt(v, 10) || 0)
  }, 0) + (channelVideos || []).reduce((acc, v) => acc + (v.view_count || 0), 0)

  const fmtMoney = (num) => {
    if (num >= 1_000_000_000) return `₦${(num / 1_000_000_000).toFixed(2)}B`
    if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`
    return `₦${num.toLocaleString()}`
  }
  const fmtViews = (num) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return String(num)
  }

  // ── Classic List View Helpers ──
  const getCreditTitle = (credit) => credit.films?.title || credit.video?.title || 'Untitled'
  const getCreditPoster = (credit) => credit.films?.poster_url || credit.video?.thumbnail_url
  const getCreditYear = (credit) => {
    if (credit.films?.year) return credit.films.year
    if (!credit.video?.published_at) return null
    const year = new Date(credit.video.published_at).getFullYear()
    return Number.isNaN(year) ? null : year
  }
  const getCreditLink = (credit) => {
    if (credit.video?.video_id) return `https://www.youtube.com/watch?v=${credit.video.video_id}`
    const film = credit.films
    return film ? `/films/${film.slug || film.id}` : '#'
  }
  const isExternalCredit = (credit) => Boolean(credit.video?.video_id)
  const getCreditViews = (credit) => {
    const raw = credit.video?.view_count ?? credit.films?.view_count ?? 0
    return typeof raw === 'number' ? raw : parseInt(raw, 10) || 0
  }
  const isYoutubeCredit = (credit) => {
    const film = credit.films || {}
    return Boolean(
      credit.video
      || credit.is_virtual
      || film.youtube_watch_url
      || film.trailer_youtube_id
      || film.release_type === 'youtube'
      || film.source === 'youtube'
    )
  }

  // ── Filtered Filmography Credits ──
  const activeCredits = creditsByRole(activeRole)
  const filmographyQuery = filmographySearch.trim().toLowerCase()
  const filteredActiveCredits = activeCredits.filter((credit) => {
    if (!filmographyQuery) return true
    return [
      credit.films?.title,
      credit.character_name,
      credit.role,
      credit.films?.year,
      credit.films?.release_type,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(filmographyQuery))
  })
  const visibleActiveCredits = filteredActiveCredits.slice(0, visibleCreditsCount)

  // ── Aliases ──
  const cleanForCompare = (str) => {
    return String(str || '')
      .toLowerCase()
      .replace(/^(chief|alhaji|alhaja|dr\.?|doctor|pastor|evang\.?|prince|king|sir|amb\.?)\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }
  const personNameClean = cleanForCompare(person?.name)
  const uniqueAliases = Array.from(
    new Set(
      (person?.person_aliases || [])
        .map(a => (typeof a === 'string' ? a : a.alias || '').trim())
        .filter(Boolean)
    )
  ).filter(alias => {
    const clean = cleanForCompare(alias)
    return clean && clean !== personNameClean
  })

  if (loading) return <PersonDetailSkeleton />

  if (error || !person) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <p className="text-red-400 font-bold mb-6">{error || 'Person not found'}</p>
          <button onClick={() => navigate(-1)} className="bg-brand text-white font-bold px-6 py-3 rounded-xl">
            GO BACK
          </button>
        </div>
      </div>
    )
  }

  const totalFilms = [...new Set(person.credits?.map(c => c.films?.id).filter(Boolean))].length

  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-brand selection:text-white">

      {/* ── 1. PRESTIGE HERO (Theatrical Backdrop & Vital Profile) ── */}
      <section className="relative border-b border-border bg-gradient-to-b from-surface-2/30 via-bg to-bg pt-8 pb-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 grid-bg opacity-15" />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10 items-start">
            
            {/* Left: Headshot Portrait with Seal & Quick Photo Trigger */}
            <div className="md:col-span-4 lg:col-span-3 flex flex-col items-center md:items-start">
              <div className="group relative aspect-[3/4] w-56 sm:w-64 md:w-full overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-2xl transition duration-500 hover:border-brand/60">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
                  <ImageWithFallback
                    src={person.photo_url || person.photo}
                    alt={formatPersonName(person.name)}
                    fallbackType="avatar"
                    name={formatPersonName(person.name)}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

                  {/* Verified Icon Seal */}
                  <div className="absolute bottom-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/90 p-1 backdrop-blur-md shadow-xl">
                    <img src="/images/muvidb-icon-watermark.png" alt="" className="h-full w-full object-contain" />
                  </div>

                  {/* Photo Gallery Trigger Pill */}
                  {photos.length > 0 && (
                    <button
                      onClick={() => setActiveLightboxIndex(0)}
                      className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-md border border-white/15 hover:bg-brand transition"
                    >
                      <Icon icon="solar:camera-bold" width="13" />
                      <span>{photos.length} Photos</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Middle: Name, Accolades Pill, Bio, Vital Facts, Actions */}
            <div className="md:col-span-8 lg:col-span-6 space-y-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-black tracking-tight text-text-primary">
                    {formatPersonName(person.name)}
                  </h1>
                  {person.is_pro ? (
                    <span className="bg-amber-500/15 text-amber-400 text-xs font-black px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1 shadow-sm shadow-amber-500/10" title="Talent Pro Verified Creator">
                      <Icon icon="solar:crown-bold" width="14" />
                      Talent Pro
                    </span>
                  ) : person.is_verified ? (
                    <span className="bg-brand/15 text-brand text-xs font-black px-2.5 py-1 rounded-lg border border-brand/30 flex items-center gap-1">
                      <Icon icon="solar:verified-check-bold" width="14" />
                      Verified
                    </span>
                  ) : null}
                </div>

                {/* Live Availability Status */}
                {person.availability_status && (
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      person.availability_status === 'on_set'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : person.availability_status === 'booked'
                        ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
                        : person.availability_status === 'not_taking_offers'
                        ? 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        person.availability_status === 'on_set'
                          ? 'bg-amber-400 animate-pulse'
                          : person.availability_status === 'booked'
                          ? 'bg-orange-400'
                          : person.availability_status === 'not_taking_offers'
                          ? 'bg-zinc-400'
                          : 'bg-emerald-400 animate-pulse'
                      }`} />
                      <span>
                        {person.availability_status === 'on_set'
                          ? 'On Set / Filming'
                          : person.availability_status === 'booked'
                          ? 'Booked for Production'
                          : person.availability_status === 'not_taking_offers'
                          ? 'Not Accepting Offers'
                          : 'Available for Bookings'}
                      </span>
                    </span>
                    {person.availability_note && (
                      <span className="text-[11px] text-text-muted truncate">
                        • {person.availability_note}
                      </span>
                    )}
                  </div>
                )}

                {/* Primary Roles */}
                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  {heroRoles.map((role, idx) => (
                    <span key={role} className="flex items-center gap-2">
                      <span className="text-brand uppercase tracking-wider text-[11px] font-black">
                        {formatRole(role)}
                      </span>
                      {idx < heroRoles.length - 1 && <span className="w-1.5 h-1.5 rounded-full bg-border" />}
                    </span>
                  ))}
                </div>

                {/* Aliases / Popular Monikers */}
                {uniqueAliases.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-text-muted/80">Also known as:</span>
                    {uniqueAliases.slice(0, 3).map(alias => (
                      <span key={alias} className="inline-block rounded-md border border-border/80 bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 🏆 PRESTIGE ACCOLADES RIBBON (Instant Hero Hook - Scrolls down to Awards section) */}
              {canonicalAwardEntries.length > 0 && (
                <div
                  onClick={() => awardsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="cursor-pointer group flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-brand/5 to-transparent px-4 py-2.5 text-xs transition duration-300 hover:border-amber-400 hover:from-amber-500/20"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <Icon icon="solar:cup-star-bold" width="18" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-black text-amber-300 text-xs sm:text-sm tracking-tight flex items-center gap-2">
                      <span className="whitespace-nowrap">{awardSummary || `${canonicalAwardEntries.length} Listed Honors`}</span>
                      <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest hidden sm:inline">· View Awards Archive ↓</span>
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      Honored across {Object.keys(awardOrgs).join(', ') || 'Nollywood Film Awards'}
                    </p>
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" width="16" className="text-amber-400 group-hover:translate-y-0.5 transition-transform" />
                </div>
              )}

              {/* Editorial Bio */}
              {(person.biography || person.bio) && (
                <div className="pt-1">
                  <Biography text={toSentenceCase(person.biography || person.bio)} />
                </div>
              )}

              {/* Vital Facts Grid */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold tracking-wide pt-1 text-text-muted">
                {person.nationality && (() => {
                  const countryName = nationalityToCountryName(person.nationality)
                  const label = toTitleCase(person.nationality)
                  return countryName ? (
                    <Link to={`/browse?country=${encodeURIComponent(countryName)}`} className="hover:text-brand transition">
                      Nationality: <span className="underline decoration-border hover:decoration-brand text-text-secondary">{label}</span>
                    </Link>
                  ) : <span>Nationality: {label}</span>
                })()}

                {representations?.length > 0 && representations[0]?.companies?.name && (
                  <span>
                    Agency:{' '}
                    <Link to={`/companies/${representations[0].companies.slug || representations[0].companies.id}`} className="text-brand font-medium hover:underline">
                      {representations[0].companies.name}
                    </Link>
                  </span>
                )}

                {person.date_of_birth && (
                  <span>Born: {formatDateOfBirth(person.date_of_birth)}</span>
                )}
                {person.date_of_death && (
                  <span className="text-text-muted/80">Died: {formatDateOfBirth(person.date_of_death)}</span>
                )}
              </div>

              {/* ── CONSOLIDATED HERO ACTIONS SUITE (Clean 1-Row Responsive Layout) ── */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 pt-3 w-full sm:w-auto">
                {/* 1. Primary Action: Follow */}
                <div className="relative group/follow flex-1 sm:flex-none">
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition min-h-[40px] flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap ${
                      isFollowing
                        ? 'bg-surface border border-brand text-brand hover:bg-brand/10'
                        : 'bg-brand text-white hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25'
                    }`}
                    title={`Follow ${person.name} to receive updates whenever they appear in or release a new movie.`}
                  >
                    <Icon icon={isFollowing ? 'solar:user-check-rounded-bold' : 'solar:user-plus-bold'} width="16" />
                    <span>{isFollowing ? 'Following' : 'Follow'}</span>
                  </button>

                  {/* Micro-Tooltip on Cursor Hover */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/follow:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border shadow-2xl text-[11px] font-medium text-text-primary whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-150">
                    <Icon icon="solar:bell-bing-bold" width="14" className="text-brand shrink-0" />
                    <span>
                      {isFollowing
                        ? `You'll be updated whenever ${person.name} appears in or releases a new movie`
                        : `Follow to get updated whenever ${person.name} appears in or releases a new movie`}
                    </span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-surface" />
                  </div>
                </div>

                {/* 2. Official YouTube Channel (if present) */}
                {getPersonYoutubeChannelUrl(person) && (
                  <a
                    href={getPersonYoutubeChannelUrl(person)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition whitespace-nowrap"
                    title="Official YouTube Channel"
                  >
                    <Icon icon="ri:youtube-fill" width="16" />
                    <span>Official Channel</span>
                  </a>
                )}

                {/* 3. Representation & Talent Booking (Talent Pro & Verified Representation) */}
                {(person.is_pro || person.booking_email || person.booking_phone || person.booking_whatsapp || representations?.length > 0) && (
                  <button
                    onClick={() => setBookingModalOpen(true)}
                    className="flex-1 sm:flex-none inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition whitespace-nowrap shadow-sm group/rep"
                    title={`View verified booking & agency representation details for ${person.name}`}
                  >
                    <Icon icon="solar:letter-bold" width="16" className="text-amber-400 group-hover/rep:scale-110 transition-transform" />
                    <span>Contact Rep / Book</span>
                  </button>
                )}

                {/* Compact Utilities Bar (Share · Socials · More) */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 3. Quick Share (Icon button with dropdown) */}
                  <ShareAction
                    title={person.name}
                    text={`Check out ${person.name}'s profile on MuviDB`}
                    variant="icon"
                    className="!p-0 !w-10 !h-10 !rounded-xl !border !border-border !bg-surface hover:!border-brand hover:!text-brand flex items-center justify-center text-text-muted transition shrink-0"
                  />

                  {/* 4. Social Links (Compact icon buttons) */}
                  {person.instagram_url && (
                    <a
                      href={person.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center text-text-muted hover:border-brand hover:text-brand transition shrink-0"
                      aria-label="Instagram"
                      title="Instagram"
                    >
                      <Icon icon="ri:instagram-line" width="16" />
                    </a>
                  )}
                  {person.twitter_url && (
                    <a
                      href={person.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center text-text-muted hover:border-brand hover:text-brand transition shrink-0"
                      aria-label="X (Twitter)"
                      title="X (Twitter)"
                    >
                      <Icon icon="ri:twitter-x-fill" width="15" />
                    </a>
                  )}

                  {/* 5. More Actions Dropdown */}
                  <div className="relative shrink-0" ref={moreActionsRef}>
                    <button
                      onClick={() => setMoreActionsOpen(!moreActionsOpen)}
                      className="h-10 px-3.5 rounded-xl border border-border bg-surface flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary hover:border-brand transition"
                      title="More options"
                      aria-label="More options"
                    >
                      <span>More</span>
                      <Icon
                        icon="solar:alt-arrow-down-linear"
                        width="14"
                        className={`transition-transform duration-200 ${moreActionsOpen ? 'rotate-180 text-brand' : ''}`}
                      />
                    </button>

                    {moreActionsOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-xl shadow-2xl z-50 py-1 text-xs backdrop-blur-xl animate-in fade-in">
                        {!person.claimed_by && !person.is_deceased && !person.date_of_death && (
                          <Link
                            to={`/claim?person=${encodeURIComponent(person.slug || person.id)}`}
                            onClick={() => setMoreActionsOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-text-primary hover:bg-surface-2 hover:text-brand transition font-medium"
                          >
                            <Icon icon="solar:shield-check-linear" width="16" className="text-brand" />
                            <span>Claim this profile</span>
                          </Link>
                        )}
                        <button
                          onClick={() => { setBookingModalOpen(true); setMoreActionsOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-text-primary hover:bg-surface-2 hover:text-amber-400 transition font-medium text-left"
                        >
                          <Icon icon="solar:letter-bold" width="16" className="text-amber-400" />
                          <span>Contact Rep / Book</span>
                        </button>
                        {person.claimed_by && (
                          <button
                            onClick={() => { setPassportOpen(true); setMoreActionsOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-text-primary hover:bg-surface-2 hover:text-brand transition font-medium text-left"
                          >
                            <Icon icon="solar:passport-linear" width="16" className="text-brand" />
                            <span>Career Passport</span>
                          </button>
                        )}
                        <button
                          onClick={() => { setShowEdit(true); setMoreActionsOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-text-primary hover:bg-surface-2 hover:text-brand transition font-medium text-left"
                        >
                          <Icon icon="solar:pen-2-linear" width="16" className="text-text-muted" />
                          <span>Suggest an edit</span>
                        </button>
                        <button
                          onClick={() => { setShowAddMedia(true); setMoreActionsOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-text-primary hover:bg-surface-2 hover:text-brand transition font-medium text-left"
                        >
                          <Icon icon="solar:video-frame-linear" width="16" className="text-brand" />
                          <span>Submit reel or photo</span>
                        </button>
                        <button
                          onClick={() => {
                            setWhatsappOptInOpen(true);
                            setMoreActionsOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-text-primary hover:bg-surface-2 hover:text-[#25D366] transition font-medium text-left"
                        >
                          <Icon icon="ri:whatsapp-line" width="16" className="text-[#25D366]" />
                          <span>WhatsApp alerts</span>
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            setMoreActionsOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-text-muted hover:bg-surface-2 hover:text-text-primary transition font-medium text-left border-t border-border/50"
                        >
                          <Icon icon="solar:copy-linear" width="16" />
                          <span>Copy profile link</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Right: Career Metrics & Audience Reach */}
            <div className="md:col-span-12 lg:col-span-3 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                
                {/* Credits & Followers Card */}
                <div className="flex items-center border border-border rounded-2xl overflow-hidden bg-surface shadow-sm">
                  <div className="flex-1 p-4 text-center border-r border-border">
                    <p className="text-text-primary text-2xl font-black font-heading tracking-tight">{totalFilms}</p>
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1">Screen Credits</p>
                  </div>
                  <div className="flex-1 p-4 text-center">
                    <p className="text-text-primary text-2xl font-black font-heading tracking-tight">{followerCount.toLocaleString()}</p>
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest mt-1">Followers</p>
                  </div>
                </div>

                {/* Box Office & YouTube Card */}
                {(displayBoxOffice > 0 || totalYoutubeViews > 0) && (
                  <div className="border border-border rounded-2xl bg-surface/80 p-5 space-y-4 shadow-md backdrop-blur-sm">
                    {displayBoxOffice > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Reported Theatrical Gross</p>
                        <p className="text-2xl font-black font-heading text-brand mt-0.5 tracking-tight">
                          {fmtMoney(displayBoxOffice)}
                        </p>
                      </div>
                    )}
                    {totalYoutubeViews > 0 && (
                      <div className={displayBoxOffice > 0 ? 'pt-3 border-t border-border/80' : ''}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Audience Views</p>
                        <p className="text-2xl font-black font-heading text-text-primary mt-0.5 tracking-tight">
                          {fmtViews(totalYoutubeViews)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. VISUAL MEDIA HUB (Videos · Monologues · Showreels · Photos) ── */}
      {(videos.length > 0 || photos.length > 0) && (
        <section className="border-b border-border bg-surface-2/30 py-10">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <p className="text-brand text-[10px] font-black uppercase tracking-[0.25em]">Talent Media Gallery</p>
                <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight flex items-center gap-2">
                  <span>Videos & Visual Portfolio</span>
                  <span className="text-xs font-bold text-text-muted bg-surface px-2.5 py-1 rounded-full border border-border">
                    {videos.length} Videos · {photos.length} Photos
                  </span>
                </h2>
              </div>

              {/* Media Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-surface border border-border p-1 rounded-xl">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'monologues', label: `Monologues (${monologues.length})`, count: monologues.length },
                  { id: 'videos', label: `Videos (${videos.length})`, count: videos.length },
                  { id: 'photos', label: `Photos (${photos.length})`, count: photos.length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMediaTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                      mediaTab === tab.id
                        ? 'bg-brand text-white shadow'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Bento Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              {/* Featured Video Player Box (Showreel / Monologue / Trailer) OR Empty Video Placeholder */}
              {(mediaTab === 'all' || mediaTab === 'videos' || mediaTab === 'monologues') && (
                featuredVideo ? (
                  <div
                    className="group relative md:col-span-8 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl hover:border-brand/60 transition duration-300"
                  >
                    {inlinePlayingVideoId ? (
                      (() => {
                        const playingVideo = videos.find((v) => v.id === inlinePlayingVideoId) || featuredVideo;
                        const { isDirect, embedSrc } = getVideoEmbedData(playingVideo);
                        return (
                          <div className="relative aspect-video w-full overflow-hidden bg-black">
                            {/* Floating Top Bar: Info + Fullscreen + Close */}
                            <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
                              <span className="flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white border border-white/20 backdrop-blur-md">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-ping" />
                                Now Playing: {playingVideo.category === 'monologue' ? 'Monologue' : playingVideo.category?.replace('_', ' ') || 'Video'}
                              </span>
                              <div className="flex items-center gap-2 pointer-events-auto">
                                <button
                                  type="button"
                                  onClick={() => setActiveVideoModal(playingVideo)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 hover:bg-black text-white text-xs font-bold backdrop-blur-md border border-white/20 hover:border-brand/60 transition shadow-lg"
                                  title="Open in Theater Mode / Full Screen"
                                >
                                  <Icon icon="solar:maximize-square-minimalistic-bold" width="16" />
                                  <span className="hidden sm:inline">Full Screen</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlinePlayingVideoId(null)}
                                  className="grid h-8 w-8 place-items-center rounded-lg bg-black/80 hover:bg-black text-white/80 hover:text-white backdrop-blur-md border border-white/20 transition shadow-lg"
                                  title="Stop inline video"
                                >
                                  <Icon icon="solar:close-circle-linear" width="18" />
                                </button>
                              </div>
                            </div>

                            {isDirect ? (
                              <video
                                src={playingVideo.url}
                                controls
                                autoPlay
                                playsInline
                                className="h-full w-full object-contain bg-black"
                              />
                            ) : (
                              <iframe
                                src={embedSrc}
                                title={playingVideo.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                                className="h-full w-full border-0 bg-black"
                              />
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div
                        onClick={() => setInlinePlayingVideoId(featuredVideo.id)}
                        className="relative aspect-video w-full overflow-hidden bg-black cursor-pointer"
                      >
                        <img
                          src={featuredVideo.thumbnail}
                          alt={featuredVideo.title}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-105 opacity-85 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

                        {/* Top Pill: Category */}
                        <div className="absolute top-4 left-4 z-10">
                          <span className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                            {featuredVideo.category === 'monologue' ? 'Featured Monologue' : featuredVideo.category?.replace('_', ' ') || 'Performance Reel'}
                          </span>
                        </div>

                        {/* Top Right Quick Action: Full Screen Option */}
                        <div className="absolute top-4 right-4 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveVideoModal(featuredVideo);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 hover:bg-black text-white text-[11px] font-bold border border-white/20 hover:border-brand/60 backdrop-blur-md transition shadow-lg"
                            title="Open directly in Full Screen Theater"
                          >
                            <Icon icon="solar:maximize-square-minimalistic-bold" width="14" />
                            <span className="hidden sm:inline">Theater Fullscreen</span>
                          </button>
                        </div>

                        {/* Center / Bottom Play CTA */}
                        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-4 z-10">
                          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-xl shadow-brand/40 group-hover:scale-110 transition duration-300">
                            <Icon icon="solar:play-bold" width="26" className="translate-x-0.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-heading font-black text-white truncate group-hover:text-brand transition">
                              {featuredVideo.title}
                            </h3>
                            <p className="text-xs text-text-muted truncate mt-0.5">
                              {featuredVideo.description || (featuredVideo.film_title ? `From film "${featuredVideo.film_title}"` : 'Click to play right here or open in theater mode')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Symmetrical Empty Video Spot: Black overlay indicator so users know video reel belongs here */
                  <div
                    onClick={() => {
                      setAddMediaInitialType('video');
                      setShowAddMedia(true);
                    }}
                    className="group relative md:col-span-8 overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-black/75 p-8 shadow-xl hover:border-brand/60 hover:bg-black/85 transition duration-300 min-h-[260px] sm:min-h-[320px] flex flex-col justify-center items-center text-center backdrop-blur-sm cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90 pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center gap-3 max-w-sm">
                      <div className="grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-2xl bg-white/5 border border-white/10 text-white/50 group-hover:text-brand group-hover:scale-110 group-hover:border-brand/40 group-hover:bg-brand/10 transition duration-300 shadow-xl">
                        <Icon icon="solar:clapperboard-play-linear" width="30" />
                      </div>
                      <div>
                        <p className="text-base sm:text-lg font-heading font-black text-white tracking-wide">
                          Video Reel & Monologue
                        </p>
                        <p className="text-xs text-white/50 mt-1">
                          No performance reel or monologue uploaded for this artist yet.
                        </p>
                      </div>
                      <span className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-brand text-white text-xs font-bold border border-white/10 group-hover:border-brand shadow-lg transition">
                        <Icon icon="solar:add-circle-linear" width="14" />
                        <span>Upload / Add Video Reel</span>
                      </span>
                    </div>
                  </div>
                )
              )}

              {/* Side Stack: Photo Teaser & Additional Clips */}
              <div className={`flex flex-col gap-5 ${mediaTab === 'photos' ? 'md:col-span-12' : 'md:col-span-4'}`}>
                
                {/* Photo Gallery Box OR Empty Photo Spot */}
                {photos.length > 0 ? (
                  <div
                    onClick={() => setActiveLightboxIndex(0)}
                    className="group relative flex-1 cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xl hover:border-brand/60 transition duration-300 min-h-[160px] flex flex-col justify-end"
                  >
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={photos[1]?.url || photos[0]?.url}
                        alt=""
                        className="h-full w-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-105 transition duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/20 text-brand border border-brand/40">
                          <Icon icon="solar:gallery-wide-bold" width="20" />
                        </div>
                        <div>
                          <p className="text-sm font-heading font-black text-white">Photo Gallery</p>
                          <p className="text-xs text-text-muted">{photos.length} Headshots & Stills</p>
                        </div>
                      </div>
                      <Icon icon="solar:alt-arrow-right-linear" width="18" className="text-text-muted group-hover:text-brand group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                ) : (
                  /* Empty Spot: Black overlay indicator so users know photos belong here */
                  <div
                    onClick={() => {
                      setAddMediaInitialType('photo');
                      setShowAddMedia(true);
                    }}
                    className="group relative flex-1 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-black/75 p-6 shadow-xl hover:border-brand/60 hover:bg-black/85 transition duration-300 min-h-[170px] flex flex-col justify-center items-center text-center backdrop-blur-sm"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90 pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center gap-2.5">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 border border-white/10 text-white/50 group-hover:text-brand group-hover:scale-110 group-hover:border-brand/40 group-hover:bg-brand/10 transition duration-300">
                        <Icon icon="solar:camera-minimalistic-linear" width="26" />
                      </div>
                      <div>
                        <p className="text-sm font-heading font-black text-white tracking-wide">Photo Gallery</p>
                        <p className="text-xs text-white/50 mt-0.5 max-w-[200px]">No photos uploaded yet</p>
                      </div>
                      <span className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-brand text-white text-[11px] font-bold border border-white/10 group-hover:border-brand transition">
                        <Icon icon="solar:add-circle-linear" width="13" />
                        <span>Upload / Add Photo</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Additional Video or Monologue Tile */}
                {videos.length > 1 && (
                  <div
                    onClick={() => setInlinePlayingVideoId(videos[1].id)}
                    className="group relative flex-1 cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xl hover:border-brand/60 transition duration-300 min-h-[160px] flex flex-col justify-end"
                  >
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={videos[1]?.thumbnail}
                        alt=""
                        className="h-full w-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-105 transition duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/20 text-brand border border-brand/40">
                          <Icon icon="solar:videocamera-record-bold" width="20" />
                        </div>
                        <div className="min-w-0 max-w-[200px]">
                          <p className="text-sm font-heading font-black text-white truncate">{videos[1].title}</p>
                          <p className="text-xs text-text-muted capitalize">{videos[1].category || 'Video Clip'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveVideoModal(videos[1]);
                          }}
                          className="p-1 rounded text-white/60 hover:text-white"
                          title="Fullscreen"
                        >
                          <Icon icon="solar:maximize-square-minimalistic-linear" width="18" />
                        </button>
                        <Icon icon="solar:play-circle-bold" width="24" className="text-brand group-hover:scale-110 transition" />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. SIGNATURE ROLES ("KNOWN FOR") ── */}
      {knownFor.length > 0 && (
        <section className="border-b border-border py-10 bg-bg">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <p className="text-brand text-[10px] font-black uppercase tracking-[0.25em] mb-1">Hallmark Work</p>
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight mb-6">Known For</h2>
            
            <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
              {knownFor.map((credit) => (
                <Link
                  key={`known-${credit.films.id}`}
                  to={`/films/${credit.films.slug || credit.films.id}`}
                  className="group w-40 sm:w-48 shrink-0 snap-start"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-surface-2 group-hover:border-brand transition duration-300 shadow-md">
                    <ImageWithFallback
                      src={credit.films.poster_url}
                      alt={credit.films.title}
                      fallbackType="film"
                      name={credit.films.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Box Office badge */}
                    {credit.films.box_office_domestic > 0 && (
                      <div className="absolute top-2 right-2 bg-amber-500/90 text-black text-[9px] font-black px-2 py-0.5 rounded shadow backdrop-blur-md">
                        🎟️ {fmtMoney(credit.films.box_office_domestic)}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-text-primary line-clamp-1 group-hover:text-brand transition">
                    {formatFilmTitle(credit.films.title)}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                    {[credit.films.year, credit.character_name ? `as ${toTitleCase(credit.character_name)}` : formatRole(credit.role)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. COMPREHENSIVE FILMOGRAPHY & THEATRE HUB ── */}
      <section className="py-12 bg-bg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          
          {/* Section Header with Medium Selector */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <p className="text-brand text-[10px] font-black uppercase tracking-[0.25em]">Career Catalog</p>
              <h2 className="text-3xl sm:text-4xl font-heading font-black text-text-primary tracking-tight">
                Filmography & Theatre
              </h2>
            </div>

            {/* Medium Selector (Screen vs Stage) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilmographyMedium('screen')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  filmographyMedium === 'screen'
                    ? 'bg-brand text-white shadow'
                    : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon icon="solar:clapperboard-linear" width="16" />
                Screen Films ({allCredits.length})
              </button>
              {stageCredits.length > 0 && (
                <button
                  onClick={() => setFilmographyMedium('stage')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    filmographyMedium === 'stage'
                      ? 'bg-brand text-white shadow'
                      : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Icon icon="solar:masks-bold" width="16" />
                  Stage & Theatre ({stageCredits.length})
                </button>
              )}
            </div>
          </div>

          {filmographyMedium === 'screen' && (
            <>
              {/* Role Filter Pills & Search Bar & View Mode */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                
                {/* ── CLEAN ROLE SELECTOR (Top 4 buttons + More dropdown) ── */}
                <div className="flex items-center gap-2 flex-wrap">
                  {primaryRoleButtons.map((role) => (
                    <button
                      key={role}
                      onClick={() => setActiveRole(role)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        activeRole === role
                          ? 'bg-brand text-white shadow-md'
                          : 'bg-surface border border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                      }`}
                    >
                      {formatRole(role)} ({roleCounts[role]})
                    </button>
                  ))}

                  {/* Clean Dropdown for Additional Roles (Never overflows!) */}
                  {secondaryRoles.length > 0 && (
                    <div className="relative">
                      <select
                        value={secondaryRoles.includes(activeRole) ? activeRole : ''}
                        onChange={(e) => e.target.value && setActiveRole(e.target.value)}
                        className={`h-[36px] px-3 pr-8 rounded-xl text-xs font-bold transition appearance-none cursor-pointer outline-none border ${
                          secondaryRoles.includes(activeRole)
                            ? 'bg-brand text-white border-brand shadow-md'
                            : 'bg-surface border border-border text-text-muted hover:text-text-primary hover:border-brand/40'
                        }`}
                      >
                        <option value="" disabled className="bg-surface text-text-muted">
                          {secondaryRoles.includes(activeRole) ? `${formatRole(activeRole)} (${roleCounts[activeRole]})` : `More Roles (${secondaryRoles.length}) ▾`}
                        </option>
                        {secondaryRoles.map((role) => (
                          <option key={role} value={role} className="bg-surface text-text-primary">
                            {formatRole(role)} ({roleCounts[role]})
                          </option>
                        ))}
                      </select>
                      <Icon icon="solar:alt-arrow-down-linear" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs opacity-70 text-text-muted" />
                    </div>
                  )}
                </div>

                {/* Search & Grid/List view Toggle */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Icon icon="solar:magnifer-linear" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" width="16" />
                    <input
                      type="search"
                      value={filmographySearch}
                      onChange={(e) => setFilmographySearch(e.target.value)}
                      placeholder="Search title, role..."
                      className="h-10 pl-9 pr-4 rounded-xl border border-border bg-surface text-xs text-text-primary placeholder:text-text-muted focus:border-brand outline-none w-56 sm:w-64"
                    />
                  </div>

                  <div className="flex items-center border border-border rounded-xl overflow-hidden bg-surface">
                    <button
                      onClick={() => setFilmographyView('grid')}
                      className={`h-10 px-3 flex items-center justify-center transition ${filmographyView === 'grid' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
                      title="Grid View"
                    >
                      <Icon icon="solar:widget-5-bold" width="16" />
                    </button>
                    <button
                      onClick={() => setFilmographyView('list')}
                      className={`h-10 px-3 flex items-center justify-center transition ${filmographyView === 'list' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
                      title="List View"
                    >
                      <Icon icon="solar:list-bold" width="16" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Films Display */}
              {visibleActiveCredits.length > 0 ? (
                <>
                  {filmographyView === 'grid' ? (
                    /* ── POSTER GRID VIEW ── */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                      {visibleActiveCredits.map((credit) => {
                        const film = credit.films || {}
                        return (
                          <Link
                            key={credit.id}
                            to={`/films/${film.slug || film.id}`}
                            className="group block"
                          >
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 border border-border group-hover:border-brand/70 transition duration-300 shadow-sm">
                              <ImageWithFallback
                                src={film.poster_url}
                                alt={film.title}
                                fallbackType="film"
                                name={film.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              {film.box_office_domestic > 0 && (
                                <div className="absolute top-2 right-2 bg-amber-500/90 text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow">
                                  🎟️ {fmtMoney(film.box_office_domestic)}
                                </div>
                              )}
                            </div>

                            <div className="mt-2.5 space-y-0.5">
                              <h4 className="text-sm font-bold text-text-primary group-hover:text-brand transition line-clamp-1">
                                {formatFilmTitle(film.title)}
                              </h4>
                              <p className="text-xs text-text-muted line-clamp-1">
                                {[film.year, credit.character_name ? `as ${toTitleCase(credit.character_name)}` : formatRole(credit.role)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  ) : (
                    /* ── CLASSIC TABLE / LIST VIEW (Exact structure beloved by user) ── */
                    <div className="space-y-3">
                      {visibleActiveCredits.map((credit) => {
                        const film = credit.films || {}
                        const title = getCreditTitle(credit)
                        const poster = getCreditPoster(credit)
                        const link = getCreditLink(credit)
                        const isExternal = isExternalCredit(credit)
                        const views = getCreditViews(credit)
                        const year = getCreditYear(credit)

                        return (
                          <Link
                            key={credit.id}
                            to={isExternal ? '#' : link}
                            onClick={(e) => {
                              if (isExternal) {
                                e.preventDefault()
                                window.open(link, '_blank', 'noopener,noreferrer')
                              }
                            }}
                            className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-3 hover:border-brand transition-colors"
                          >
                            {/* Poster Thumbnail */}
                            <div className="relative w-16 h-24 rounded-lg flex-shrink-0 overflow-hidden bg-surface-2 border border-border group-hover:border-brand/70 transition-all duration-300 shadow-sm">
                              <ImageWithFallback
                                src={poster}
                                alt={title}
                                fallbackType="film"
                                name={title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                width={128}
                                sizes="64px"
                                loading="lazy"
                              />
                              {film.box_office_domestic > 0 && (
                                <div className="absolute top-1.5 right-1.5 bg-amber-500/90 text-bg text-[7px] font-black px-1 py-0.5 rounded shadow">
                                  🎟️ {fmtMoney(film.box_office_domestic)}
                                </div>
                              )}
                              {isYoutubeCredit(credit) && views > 0 && (
                                <div className="absolute bottom-1 left-1 bg-bg/90 text-text-primary text-[8px] font-black px-1 py-0.5 rounded shadow flex items-center gap-0.5">
                                  <Icon icon="solar:eye-bold" width="9" className="text-brand" />
                                  <span>{formatViewCount(views)}</span>
                                </div>
                              )}
                            </div>

                            {/* Details: Year, Platform, Title, Role/Character */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {year && (
                                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-text-muted">
                                    {year}
                                  </span>
                                )}
                                <PlatformBadge releaseType={film.release_type || (credit.video ? 'youtube' : '')} film={film} />
                              </div>
                              <h3 className="text-sm sm:text-base font-bold text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                                {formatFilmTitle(title)}
                              </h3>
                              <p className="mt-1 text-xs text-text-muted line-clamp-1">
                                {[formatRole(credit.role), credit.character_name ? `as ${toTitleCase(credit.character_name)}` : null]
                                  .filter(Boolean)
                                  .join(' / ')}
                              </p>
                            </div>

                            {/* Views badge & Arrow */}
                            {isYoutubeCredit(credit) && views > 0 && (
                              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-1 text-[10px] font-black text-text-primary">
                                <Icon icon="solar:eye-bold" width="13" className="text-brand" />
                                {formatViewCount(views)}
                              </span>
                            )}
                            <Icon icon={isExternal ? 'solar:arrow-up-right-linear' : 'solar:alt-arrow-right-linear'} className="text-text-muted group-hover:text-brand shrink-0" width="18" />
                          </Link>
                        )
                      })}
                    </div>
                  )}

                  {filteredActiveCredits.length > visibleCreditsCount && (
                    <div className="flex justify-center mt-10">
                      <button
                        onClick={() => setVisibleCreditsCount(c => c + 24)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-xs font-bold text-white hover:border-brand transition"
                      >
                        <Icon icon="solar:add-circle-linear" width="18" />
                        Show More ({filteredActiveCredits.length - visibleCreditsCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
                  <p className="text-sm font-bold text-text-muted">No credits match your filter criteria.</p>
                </div>
              )}
            </>
          )}

          {/* Stage & Theatre Credits View */}
          {filmographyMedium === 'stage' && stageCredits.length > 0 && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stageCredits.slice(0, visibleStageCount).map((play) => (
                  <Link
                    key={play.id}
                    to={`/plays/${play.slug}`}
                    className="group bg-surface border border-border hover:border-brand rounded-2xl p-4 flex gap-4 items-stretch transition duration-300"
                  >
                    <ImageWithFallback
                      src={play.poster_url}
                      alt={play.title}
                      fallbackType="film"
                      name={play.title}
                      className="w-20 h-28 rounded-xl object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0 flex flex-col justify-center">
                      <h4 className="text-base font-bold text-white group-hover:text-brand transition line-clamp-2">
                        {play.title}
                      </h4>
                      <span className="text-xs font-bold text-brand block mt-1">
                        {play.role || 'Actor'} {play.character_name ? `as ${play.character_name}` : ''}
                      </span>
                      <p className="text-xs text-text-muted mt-2">
                        📍 {play.venue || play.city || 'Theatre'} ({getPlayDateLabel(play, 'TBA')})
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {stageCredits.length > visibleStageCount && (
                <div className="flex justify-center mt-10">
                  <button
                    onClick={() => setVisibleStageCount((c) => c + 6)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-xs font-bold text-white hover:border-brand transition shadow-sm"
                  >
                    <Icon icon="solar:add-circle-linear" width="18" />
                    Show More ({stageCredits.length - visibleStageCount} remaining)
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </section>

      {/* ── 5. AWARDS & HONORS ARCHIVE (Now Placed BELOW Filmography & Redesigned as Prestige Ledger) ── */}
      {canonicalAwardEntries.length > 0 && (
        <section ref={awardsRef} id="awards-archive" className="border-b border-border py-12 bg-surface/20">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            
            {/* Header with Title & Stats in a clean, non-wrapping straight line */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
              <div>
                <p className="text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.25em] mb-1">Accolades & Recognition</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-heading font-black text-text-primary tracking-tight whitespace-nowrap">
                    Awards & Honors Archive
                  </h2>
                  <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-3.5 py-1.5 rounded-full shadow-sm">
                    <Icon icon="solar:cup-star-bold" width="14" className="shrink-0 text-amber-500" />
                    <span className="whitespace-nowrap tracking-wide">{awardSummary || `${canonicalAwardEntries.length} listed`}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Dedicated full-width Organization Filter Tabs (Horizontally scrollable with smooth scroll & edge padding) */}
            <div className="relative mb-6">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <button
                  onClick={() => setSelectedAwardOrg('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                    selectedAwardOrg === 'all'
                      ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20'
                      : 'bg-surface border border-border text-text-muted hover:text-text-primary hover:border-amber-500/40'
                  }`}
                >
                  All Honors ({canonicalAwardEntries.length})
                </button>
                {sortedAwardOrgs.map(([org, count]) => (
                  <button
                    key={org}
                    onClick={() => setSelectedAwardOrg(org)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                      selectedAwardOrg === org
                        ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20'
                        : 'bg-surface border border-border text-text-muted hover:text-text-primary hover:border-amber-500/40'
                    }`}
                  >
                    {org} ({count})
                  </button>
                ))}
              </div>
            </div>

            {/* Prestige Honors Ledger Table (Clean, compact, no repetitive square boxes!) */}
            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xl">
              
              {/* Table Header Bar */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-border/80 bg-surface-2/60 text-[10px] font-black uppercase tracking-wider text-text-muted">
                <div className="col-span-2">Year & Result</div>
                <div className="col-span-4">Awarding Body & Category</div>
                <div className="col-span-6">Work / Film Title</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-border/60">
                {filteredAwards.map((award, idx) => {
                  const film = award.film_id ? awardFilms[award.film_id] : null
                  const workTitle = award.work || award.title
                  const isWin = award.won !== false

                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-4 items-center hover:bg-surface-2/50 transition"
                    >
                      {/* Year & Won/Nominee Pill */}
                      <div className="sm:col-span-2 flex sm:flex-col items-center sm:items-start gap-2">
                        <span className="text-text-primary font-heading font-black text-sm">
                          {award.year || (award.season ? `Season ${award.season}` : '—')}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isWin
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40'
                            : 'bg-surface-2 text-text-muted border-border'
                        }`}>
                          <Icon icon={isWin ? 'solar:cup-star-bold' : 'solar:medal-star-linear'} width="12" />
                          <span>{isWin ? 'Winner' : 'Nominee'}</span>
                        </span>
                      </div>

                      {/* Organization & Category */}
                      <div className="sm:col-span-4">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          {award.canonicalOrg || 'Honorary Award'}
                        </p>
                        <p className="text-sm font-bold text-text-primary mt-0.5">
                          {toTitleCase(award.category || 'Special Recognition')}
                        </p>
                      </div>

                      {/* Work / Film Tag */}
                      <div className="sm:col-span-6 flex items-center justify-between gap-4">
                        {workTitle ? (
                          <div className="flex items-center gap-3 min-w-0">
                            {film?.poster_url && (
                              <img
                                src={film.poster_url}
                                alt=""
                                className="w-8 h-11 rounded object-cover border border-border shrink-0 shadow-sm"
                              />
                            )}
                            <div className="min-w-0">
                              {film?.slug || film?.id ? (
                                <Link
                                  to={`/films/${film.slug || film.id}`}
                                  className="text-sm font-bold text-brand hover:underline truncate block"
                                >
                                  {formatFilmTitle(workTitle)}
                                </Link>
                              ) : (
                                <span className="text-sm font-medium text-text-secondary truncate block">
                                  {formatFilmTitle(workTitle)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted italic">Lifetime / Career Achievement</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>

          </div>
        </section>
      )}

      {/* ── 6. OFFICIAL YOUTUBE CHANNEL (Low Hierarchy Discovery Bar) ── */}
      {channel && (
        <section className="border-b border-border bg-surface-2/30 py-6">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 rounded-xl border border-red-500/20 bg-red-950/10 hover:border-red-500/40 transition">
              <div className="flex items-center gap-3.5 text-center sm:text-left">
                <div className="relative shrink-0">
                  <ImageWithFallback
                    src={channel.thumbnail_url}
                    alt={channel.name}
                    fallbackType="avatar"
                    name={channel.name}
                    className="w-11 h-11 rounded-lg border border-red-500/30 object-cover shadow-sm shrink-0"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-white">
                    <Icon icon="ri:youtube-fill" width="10" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-sm font-heading font-black text-text-primary">{toTitleCase(channel.name)}</span>
                    <span className="bg-red-500/15 text-red-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-red-500/30">Official Channel</span>
                  </div>
                  {channel.subscriber_count > 0 && (
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {formatViewCount(channel.subscriber_count)} Subscribers · Stream films & series directly on YouTube
                    </p>
                  )}
                </div>
              </div>

              <Link
                to={`/channels/${channel.slug || channel.id}`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 transition shadow-sm"
              >
                <Icon icon="ri:youtube-fill" width="14" />
                <span>Visit Channel</span>
                <Icon icon="solar:arrow-right-linear" width="12" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 7. MODALS ── */}
      {activeVideoModal && (
        <ProVideoTheaterModal
          video={activeVideoModal}
          onClose={() => setActiveVideoModal(null)}
        />
      )}

      {/* Fullscreen Photo Lightbox (IMDb-Style, Flexible & Fast) */}
      {activeLightboxIndex !== null && photos[activeLightboxIndex] && (
        <PersonPhotoLightboxModal
          photos={photos}
          initialIndex={activeLightboxIndex}
          onClose={() => setActiveLightboxIndex(null)}
          personName={person?.name}
        />
      )}

      {showEdit && (
        <SuggestEditModal
          target="person"
          targetId={personId}
          targetName={formatPersonName(person.name)}
          current={{
            name: person.name,
            known_for_department: person.known_for_department,
            bio: person.bio,
            date_of_birth: person.date_of_birth,
            birthplace: person.birthplace,
            nationality: person.nationality,
            instagram_url: person.instagram_url,
            twitter_url: person.twitter_url,
            tiktok_url: person.tiktok_url,
            facebook_url: person.facebook_url,
            youtube_handle: person.youtube_handle,
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {passportOpen && (
        <CareerPassportModal
          person={person}
          credits={person.credits || []}
          stageCredits={stageCredits}
          onClose={() => setPassportOpen(false)}
        />
      )}

      <WhatsAppOptInModal
        isOpen={whatsappOptInOpen}
        onClose={() => setWhatsappOptInOpen(false)}
        personName={person?.name}
        personId={personId}
        user={user}
        onOptInSuccess={(savedPhone) => {
          if (savedPhone) {
            localStorage.setItem('muvidb_user_whatsapp_phone', savedPhone)
          }
          if (refreshUserProfile) {
            refreshUserProfile()
          }
        }}
      />

      {showAddMedia && (
        <AddPersonMediaModal
          person={person}
          initialType={addMediaInitialType}
          onClose={() => setShowAddMedia(false)}
          onMediaAdded={(newMedia) => {
            setMedia((prev) => [newMedia, ...prev])
          }}
        />
      )}

      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        person={person}
        representations={representations}
      />

    </div>
  )
}
