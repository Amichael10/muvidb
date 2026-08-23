import { useState, useEffect, useRef, useMemo } from 'react'
import { SuggestPersonModal } from '../components/contribute/ContributeModals'
import { Link, useNavigate, useLoaderData, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFollow } from '../hooks/useFollow'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import { Icon } from '@iconify/react'
import { formatPersonName, toTitleCase } from '../utils/format'
import {
  PEOPLE_ROLE_FILTERS,
  PEOPLE_FILTER_TO_ROLE,
  canonicalizeRole,
  formatDepartment,
} from '../lib/creditRoles'
import { searchPeopleByName } from '../lib/peopleSearch'
import ImageWithFallback from '../components/ui/ImageWithFallback'

// Quick-access primary roles
const PRIMARY_ROLE_FILTERS = [
  'All',
  'Actor',
  'Director',
  'Writer',
  'Producer',
  'Cinematographer',
  'Editor',
]

// Secondary roles available in "More Roles" dropdown
const SECONDARY_ROLE_FILTERS = PEOPLE_ROLE_FILTERS.filter(
  (r) => !PRIMARY_ROLE_FILTERS.includes(r)
)

const EXPERIENCE_OPTIONS = [
  { value: 'all', label: 'All Experience Levels' },
  { value: '20+', label: '20+ Films (Legends & Prolific)' },
  { value: '10-19', label: '10–19 Films (Industry Veterans)' },
  { value: '5-9', label: '5–9 Films (Established)' },
  { value: '1-4', label: '1–4 Films (Emerging Talent)' },
]

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Most Popular', icon: 'solar:fire-bold' },
  { value: 'films_desc', label: 'Most Film Credits', icon: 'solar:clapperboard-play-bold' },
  { value: 'name_asc', label: 'Name (A → Z)', icon: 'solar:sort-by-alphabet-linear' },
  { value: 'name_desc', label: 'Name (Z → A)', icon: 'solar:sort-by-alphabet-linear' },
  { value: 'recent', label: 'Recently Added', icon: 'solar:clock-circle-linear' },
]

const GENDER_OPTIONS = [
  { value: 'all', label: 'All Genders' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

const NATIONALITY_OPTIONS = [
  { value: 'all', label: 'All Nationalities' },
  { value: 'Nigerian', label: 'Nigerian' },
  { value: 'Ghanaian', label: 'Ghanaian' },
  { value: 'South African', label: 'South African' },
  { value: 'Kenyan', label: 'Kenyan' },
  { value: 'Other', label: 'International / Diaspora' },
]

// Grid View Card
const PersonCard = ({ person, currentUser }) => {
  const navigate = useNavigate()
  const {
    isFollowing,
    loading: followLoading,
    toggleFollow,
  } = useFollow(person.id, currentUser)

  const handleFollow = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser) {
      navigate('/login', {
        state: {
          from: '/people',
          message: 'Sign in to follow filmmakers',
        },
      })
      return
    }
    await toggleFollow()
  }

  const creditCount = person.film_count ?? (person.credits?.length || 0)
  const primaryRole = formatDepartment(person.known_for_department) || 'Filmmaker'

  return (
    <Link
      to={`/people/${person.slug || person.id}`}
      className="group flex flex-col bg-surface rounded-2xl overflow-hidden border border-border/80 hover:border-brand/60 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-brand/5"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
        <ImageWithFallback
          src={person.photo_url}
          alt={person.name}
          fallbackType="avatar"
          name={person.name}
          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out"
          width={400}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
          loading="lazy"
        />

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
          {person.is_verified ? (
            <span className="inline-flex items-center gap-1 bg-brand text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-md backdrop-blur-sm">
              <Icon icon="solar:verified-check-bold" width="12" />
              VERIFIED
            </span>
          ) : <span />}

          {person.is_spotlight && (
            <span className="inline-flex items-center gap-1 bg-amber-500/90 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-md backdrop-blur-sm">
              <Icon icon="solar:star-bold" width="11" />
              SPOTLIGHT
            </span>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/20 to-transparent opacity-70 group-hover:opacity-40 transition-opacity" />
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-text-primary font-bold text-sm tracking-tight group-hover:text-brand transition-colors line-clamp-1">
            {formatPersonName(person.name)}
          </h3>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="inline-block bg-surface-2 text-text-muted text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
              {toTitleCase(primaryRole)}
            </span>
            {person.nationality && person.nationality !== 'Unknown' && (
              <span className="text-[10px] text-text-muted font-medium opacity-75">
                • {person.nationality}
              </span>
            )}
          </div>
        </div>

        <div className="pt-4 mt-3 border-t border-border/50">
          <div className="flex items-center justify-between mb-3 text-text-muted text-[10px] font-bold">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:clapperboard-play-linear" className="text-brand" width="13" />
              <span>{creditCount} {creditCount === 1 ? 'Film' : 'Films'}</span>
            </div>
            {person.popularity_score > 0 && (
              <div className="flex items-center gap-1 opacity-70">
                <Icon icon="solar:fire-linear" width="12" />
                <span>{Math.round(person.popularity_score)}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleFollow}
            disabled={followLoading}
            className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5 ${
              isFollowing
                ? 'bg-surface-2 border border-border text-text-muted hover:border-red-500/50 hover:text-red-500'
                : 'bg-brand/10 hover:bg-brand text-brand hover:text-white border border-brand/20 hover:border-brand shadow-sm'
            }`}
          >
            {followLoading ? (
              '...'
            ) : isFollowing ? (
              <>
                <Icon icon="solar:check-circle-bold" width="13" />
                FOLLOWING
              </>
            ) : (
              <>
                <Icon icon="solar:user-plus-bold" width="13" />
                + FOLLOW
              </>
            )}
          </button>
        </div>
      </div>
    </Link>
  )
}

// List View Row
const PersonRow = ({ person, currentUser }) => {
  const navigate = useNavigate()
  const {
    isFollowing,
    loading: followLoading,
    toggleFollow,
  } = useFollow(person.id, currentUser)

  const handleFollow = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser) {
      navigate('/login', {
        state: {
          from: '/people',
          message: 'Sign in to follow filmmakers',
        },
      })
      return
    }
    await toggleFollow()
  }

  const creditCount = person.film_count ?? (person.credits?.length || 0)
  const primaryRole = formatDepartment(person.known_for_department) || 'Filmmaker'

  return (
    <Link
      to={`/people/${person.slug || person.id}`}
      className="group flex items-center justify-between gap-4 p-3.5 sm:p-4 bg-surface rounded-xl border border-border/80 hover:border-brand/60 hover:bg-surface-2/40 transition-all duration-200 shadow-sm"
    >
      <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
        <div className="relative w-12 h-14 sm:w-14 sm:h-16 rounded-lg overflow-hidden bg-surface-2 flex-shrink-0 border border-border">
          <ImageWithFallback
            src={person.photo_url}
            alt={person.name}
            fallbackType="avatar"
            name={person.name}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform"
            width={120}
            sizes="64px"
            loading="lazy"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-text-primary font-bold text-sm sm:text-base group-hover:text-brand transition-colors truncate">
              {formatPersonName(person.name)}
            </h3>
            {person.is_verified && (
              <span title="Verified Talent" className="text-brand flex-shrink-0">
                <Icon icon="solar:verified-check-bold" width="16" />
              </span>
            )}
            {person.is_spotlight && (
              <span title="Spotlight Feature" className="text-amber-500 flex-shrink-0">
                <Icon icon="solar:star-bold" width="14" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
            <span className="inline-block bg-surface-2 text-text-muted text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              {toTitleCase(primaryRole)}
            </span>
            {person.nationality && person.nationality !== 'Unknown' && (
              <span className="text-[11px] text-text-muted font-medium opacity-75">
                {person.nationality}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
        <div className="hidden sm:flex flex-col items-end text-right">
          <div className="flex items-center gap-1.5 text-text-primary font-bold text-xs">
            <Icon icon="solar:clapperboard-play-linear" className="text-brand" width="14" />
            <span>{creditCount}</span>
            <span className="text-text-muted font-normal text-[11px]">{creditCount === 1 ? 'film' : 'films'}</span>
          </div>
          {person.popularity_score > 0 && (
            <span className="text-[10px] text-text-muted mt-0.5 opacity-70">
              Pop score: {Math.round(person.popularity_score)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleFollow}
          disabled={followLoading}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1.5 ${
            isFollowing
              ? 'bg-surface-2 border border-border text-text-muted hover:border-red-500/50 hover:text-red-500'
              : 'bg-brand text-white hover:shadow-lg hover:shadow-brand/20'
          }`}
        >
          {followLoading ? (
            '...'
          ) : isFollowing ? (
            <>
              <Icon icon="solar:check-circle-bold" width="12" />
              <span className="hidden sm:inline">FOLLOWING</span>
            </>
          ) : (
            <>
              <Icon icon="solar:user-plus-bold" width="12" />
              <span>FOLLOW</span>
            </>
          )}
        </button>
      </div>
    </Link>
  )
}

const PersonSkeleton = () => (
  <div className="bg-surface rounded-2xl overflow-hidden border border-border/80">
    <div className="aspect-[4/5] bg-surface-2 animate-shimmer" />
    <div className="p-4 space-y-3">
      <div className="h-4 w-3/4 bg-surface-2 rounded animate-shimmer" />
      <div className="h-3 w-1/2 bg-surface-2 rounded animate-shimmer opacity-60" />
      <div className="h-3 w-1/3 bg-surface-2 rounded animate-shimmer pt-2" />
      <div className="h-9 w-full bg-surface-2 rounded-lg mt-3 animate-shimmer" />
    </div>
  </div>
)

const PersonRowSkeleton = () => (
  <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-14 h-16 rounded-lg bg-surface-2" />
      <div className="space-y-2">
        <div className="h-4 w-36 bg-surface-2 rounded" />
        <div className="h-3 w-20 bg-surface-2 rounded opacity-60" />
      </div>
    </div>
    <div className="w-24 h-8 bg-surface-2 rounded-lg" />
  </div>
)

const PeopleList = () => {
  const { user } = useAuth()
  const loaderData = useLoaderData()
  const [searchParams, setSearchParams] = useSearchParams()
  const seeded = !!loaderData?.seeded && (loaderData.people?.length ?? 0) > 0
  const [showSuggest, setShowSuggest] = useState(false)
  const [people, setPeople] = useState(loaderData?.people ?? [])
  const [loading, setLoading] = useState(!seeded)

  // URL state synchronization
  const initialSearch = searchParams.get('q') || ''
  const initialRole = searchParams.get('role') || 'All'
  const initialSort = searchParams.get('sort') || 'popularity'
  const initialExperience = searchParams.get('experience') || 'all'
  const initialVerified = searchParams.get('verified') === 'true'
  const initialSpotlight = searchParams.get('spotlight') === 'true'
  const initialPhotoOnly = searchParams.get('photo') === 'true'
  const initialGender = searchParams.get('gender') || 'all'
  const initialNationality = searchParams.get('nationality') || 'all'
  const initialView = searchParams.get('view') || 'grid'

  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState(initialRole)
  const [sortBy, setSortBy] = useState(initialSort)
  const [experience, setExperience] = useState(initialExperience)
  const [verifiedOnly, setVerifiedOnly] = useState(initialVerified)
  const [spotlightOnly, setSpotlightOnly] = useState(initialSpotlight)
  const [photoOnly, setPhotoOnly] = useState(initialPhotoOnly)
  const [gender, setGender] = useState(initialGender)
  const [nationality, setNationality] = useState(initialNationality)
  const [viewMode, setViewMode] = useState(initialView) // 'grid' | 'list'

  // UI state
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [isMoreRolesOpen, setIsMoreRolesOpen] = useState(false)
  const moreRolesRef = useRef(null)

  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 24

  const skipInitialFetch = useRef(
    seeded &&
      initialRole === 'All' &&
      !initialSearch &&
      initialExperience === 'all' &&
      !initialVerified &&
      !initialSpotlight &&
      !initialPhotoOnly &&
      initialGender === 'all' &&
      initialNationality === 'all' &&
      initialSort === 'popularity'
  )

  // Close "More Roles" dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreRolesRef.current && !moreRolesRef.current.contains(e.target)) {
        setIsMoreRolesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [search])

  // Sync state changes to URL search params
  const updateUrlParams = (updates) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === 'all' || v === 'All' || v === false) {
        next.delete(k)
      } else {
        next.set(k, String(v))
      }
    })
    setSearchParams(next, { replace: true })
  }

  const handleRoleSelect = (role) => {
    setRoleFilter(role)
    setIsMoreRolesOpen(false)
    updateUrlParams({ role: role === 'All' ? null : role })
  }

  const handleSortChange = (newSort) => {
    setSortBy(newSort)
    updateUrlParams({ sort: newSort === 'popularity' ? null : newSort })
  }

  const handleExperienceChange = (newExp) => {
    setExperience(newExp)
    updateUrlParams({ experience: newExp === 'all' ? null : newExp })
  }

  const handleVerifiedToggle = () => {
    const next = !verifiedOnly
    setVerifiedOnly(next)
    updateUrlParams({ verified: next ? 'true' : null })
  }

  const handleSpotlightToggle = () => {
    const next = !spotlightOnly
    setSpotlightOnly(next)
    updateUrlParams({ spotlight: next ? 'true' : null })
  }

  const handlePhotoOnlyToggle = () => {
    const next = !photoOnly
    setPhotoOnly(next)
    updateUrlParams({ photo: next ? 'true' : null })
  }

  const handleGenderChange = (newGender) => {
    setGender(newGender)
    updateUrlParams({ gender: newGender === 'all' ? null : newGender })
  }

  const handleNationalityChange = (newNat) => {
    setNationality(newNat)
    updateUrlParams({ nationality: newNat === 'all' ? null : newNat })
  }

  const handleViewToggle = (mode) => {
    setViewMode(mode)
    updateUrlParams({ view: mode === 'grid' ? null : mode })
  }

  const handleResetAll = () => {
    setSearch('')
    setDebouncedSearch('')
    setRoleFilter('All')
    setSortBy('popularity')
    setExperience('all')
    setVerifiedOnly(false)
    setSpotlightOnly(false)
    setPhotoOnly(false)
    setGender('all')
    setNationality('all')
    setSearchParams({}, { replace: true })
  }

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (roleFilter !== 'All') count++
    if (experience !== 'all') count++
    if (verifiedOnly) count++
    if (spotlightOnly) count++
    if (photoOnly) count++
    if (gender !== 'all') count++
    if (nationality !== 'all') count++
    if (sortBy !== 'popularity') count++
    return count
  }, [roleFilter, experience, verifiedOnly, spotlightOnly, photoOnly, gender, nationality, sortBy])

  // Trigger refetch when filters change
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    setPeople([])
    setPage(0)
    setHasMore(true)
    fetchPeople(0, true)
  }, [
    debouncedSearch,
    roleFilter,
    sortBy,
    experience,
    verifiedOnly,
    spotlightOnly,
    photoOnly,
    gender,
    nationality,
  ])

  const fetchPeople = async (pageNum, reset = false) => {
    setLoading(true)

    const roleValue = roleFilter !== 'All' ? canonicalizeRole(roleFilter) : null
    const roleLabel = roleFilter !== 'All' ? (formatDepartment(roleValue) || roleFilter) : null
    const fetchSize = PAGE_SIZE

    try {
      if (debouncedSearch.trim()) {
        const rows = await searchPeopleByName(debouncedSearch, {
          limit: 100,
          select: `
            id, slug, name, photo_url,
            popularity_score, is_verified, is_spotlight,
            known_for_department, film_count, gender, nationality,
            created_at, updated_at,
            credits(id, role)
          `,
        })

        let filtered = rows

        // Role filter
        if (roleValue) {
          filtered = filtered.filter((p) => {
            const dept = canonicalizeRole(p.known_for_department)
            if (dept === roleValue) return true
            return (p.credits || []).some((c) => canonicalizeRole(c.role) === roleValue)
          })
        }

        // Experience filter
        if (experience !== 'all') {
          filtered = filtered.filter((p) => {
            const count = p.film_count ?? (p.credits?.length || 0)
            if (experience === '20+') return count >= 20
            if (experience === '10-19') return count >= 10 && count <= 19
            if (experience === '5-9') return count >= 5 && count <= 9
            if (experience === '1-4') return count >= 1 && count <= 4
            return true
          })
        }

        // Verified filter
        if (verifiedOnly) {
          filtered = filtered.filter((p) => p.is_verified)
        }

        // Spotlight filter
        if (spotlightOnly) {
          filtered = filtered.filter((p) => p.is_spotlight)
        }

        // Photo only filter
        if (photoOnly) {
          filtered = filtered.filter((p) => Boolean(p.photo_url))
        }

        // Gender filter
        if (gender !== 'all') {
          filtered = filtered.filter((p) => (p.gender || '').toLowerCase() === gender.toLowerCase())
        }

        // Nationality filter
        if (nationality !== 'all') {
          if (nationality === 'Other') {
            filtered = filtered.filter((p) => !['Nigerian', 'Ghanaian', 'South African', 'Kenyan'].includes(p.nationality))
          } else {
            filtered = filtered.filter((p) => (p.nationality || '').toLowerCase() === nationality.toLowerCase())
          }
        }

        // Sorting
        if (sortBy === 'name_asc') {
          filtered = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        } else if (sortBy === 'name_desc') {
          filtered = [...filtered].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
        } else if (sortBy === 'films_desc') {
          filtered = [...filtered].sort(
            (a, b) => (b.film_count ?? (b.credits?.length || 0)) - (a.film_count ?? (a.credits?.length || 0))
          )
        } else if (sortBy === 'recent') {
          filtered = [...filtered].sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          )
        } else {
          // popularity
          filtered = [...filtered].sort(
            (a, b) => Number(b.popularity_score || 0) - Number(a.popularity_score || 0)
          )
        }

        const slice = filtered.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE)
        setHasMore((pageNum + 1) * PAGE_SIZE < filtered.length)
        setPeople(reset ? slice : (prev) => [...prev, ...slice])
        return
      }

      // Role Filter Dual-Source Query (Department + Credits Join)
      if (roleValue) {
        const deptQuery = supabase
          .from('people')
          .select(`
            id, slug, name, photo_url,
            popularity_score, is_verified, is_spotlight,
            known_for_department, film_count, gender, nationality,
            created_at, updated_at,
            credits(id, role)
          `)
          .or(`known_for_department.ilike.%${roleLabel}%,known_for_department.ilike.%${roleValue}%`)

        const credsQuery = supabase
          .from('credits')
          .select(`
            person_id, role,
            people(
              id, slug, name, photo_url,
              popularity_score, is_verified, is_spotlight,
              known_for_department, film_count, gender, nationality,
              created_at, updated_at,
              credits(id, role)
            )
          `)
          .ilike('role', `%${roleValue}%`)
          .limit(150)

        const [deptRes, credsRes] = await Promise.all([
          deptQuery.limit(100),
          credsQuery
        ])

        const map = new Map()
        ;(deptRes.data || []).forEach((p) => {
          if (p) map.set(p.id, p)
        })
        ;(credsRes.data || []).forEach((c) => {
          if (c?.people && !map.has(c.people.id)) {
            map.set(c.people.id, c.people)
          }
        })

        let merged = Array.from(map.values())

        // Double check canonical department/credit match
        merged = merged.filter((p) => {
          const dept = canonicalizeRole(p.known_for_department)
          if (dept === roleValue) return true
          return (p.credits || []).some((c) => canonicalizeRole(c.role) === roleValue)
        })

        if (verifiedOnly) merged = merged.filter((p) => p.is_verified)
        if (spotlightOnly) merged = merged.filter((p) => p.is_spotlight)
        if (photoOnly) merged = merged.filter((p) => Boolean(p.photo_url))
        if (gender !== 'all') merged = merged.filter((p) => (p.gender || '').toLowerCase() === gender.toLowerCase())
        if (nationality !== 'all') {
          if (nationality === 'Other') {
            merged = merged.filter((p) => !['Nigerian', 'Ghanaian', 'South African', 'Kenyan'].includes(p.nationality))
          } else {
            merged = merged.filter((p) => (p.nationality || '').toLowerCase() === nationality.toLowerCase())
          }
        }
        if (experience !== 'all') {
          merged = merged.filter((p) => {
            const count = p.film_count ?? (p.credits?.length || 0)
            if (experience === '20+') return count >= 20
            if (experience === '10-19') return count >= 10 && count <= 19
            if (experience === '5-9') return count >= 5 && count <= 9
            if (experience === '1-4') return count >= 1 && count <= 4
            return true
          })
        }

        // Sorting
        if (sortBy === 'name_asc') {
          merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        } else if (sortBy === 'name_desc') {
          merged.sort((a, b) => (b.name || '').localeCompare(a.name || ''))
        } else if (sortBy === 'films_desc') {
          merged.sort((a, b) => (b.film_count ?? (b.credits?.length || 0)) - (a.film_count ?? (a.credits?.length || 0)))
        } else if (sortBy === 'recent') {
          merged.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        } else {
          merged.sort((a, b) => Number(b.popularity_score || 0) - Number(a.popularity_score || 0))
        }

        const slice = merged.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE)
        setHasMore((pageNum + 1) * PAGE_SIZE < merged.length)
        setPeople(reset ? slice : (prev) => [...prev, ...slice])
        return
      }

      // Default Browse Mode (All Roles)
      let query = supabase.from('people').select(`
        id, slug, name, photo_url,
        popularity_score, is_verified, is_spotlight,
        known_for_department, film_count, gender, nationality,
        created_at, updated_at,
        credits(id, role)
      `)

      if (verifiedOnly) {
        query = query.eq('is_verified', true)
      }

      if (spotlightOnly) {
        query = query.eq('is_spotlight', true)
      }

      if (photoOnly) {
        query = query.not('photo_url', 'is', null)
      }

      if (gender !== 'all') {
        query = query.ilike('gender', gender)
      }

      if (nationality !== 'all') {
        if (nationality === 'Other') {
          query = query.not('nationality', 'in', '("Nigerian","Ghanaian","South African","Kenyan")')
        } else {
          query = query.eq('nationality', nationality)
        }
      }

      // Experience ranges
      if (experience === '20+') {
        query = query.gte('film_count', 20)
      } else if (experience === '10-19') {
        query = query.gte('film_count', 10).lte('film_count', 19)
      } else if (experience === '5-9') {
        query = query.gte('film_count', 5).lte('film_count', 9)
      } else if (experience === '1-4') {
        query = query.gte('film_count', 1).lte('film_count', 4)
      }

      // Sorting
      if (sortBy === 'films_desc') {
        query = query.order('film_count', { ascending: false, nullsFirst: false })
      } else if (sortBy === 'name_asc') {
        query = query.order('name', { ascending: true })
      } else if (sortBy === 'name_desc') {
        query = query.order('name', { ascending: false })
      } else if (sortBy === 'recent') {
        query = query.order('created_at', { ascending: false })
      } else {
        // Default: popularity
        query = query.order('popularity_score', { ascending: false, nullsFirst: false })
      }

      query = query.range(pageNum * fetchSize, (pageNum + 1) * fetchSize - 1)

      const { data, error } = await query
      if (error) throw error

      const list = data || []
      if (!data || data.length < fetchSize) {
        setHasMore(false)
      }

      setPeople(reset ? list : (prev) => [...prev, ...list])
    } catch (err) {
      console.error('fetchPeople failed:', err)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPeople(nextPage)
  }

  const isMoreRoleActive = SECONDARY_ROLE_FILTERS.includes(roleFilter)

  return (
    <div className="min-h-screen bg-bg">
      <PageHeader
        icon="solar:users-group-rounded-bold"
        eyebrow="Directory"
        title="People"
        description="The actors, directors, writers, and visionaries shaping the future of Nollywood cinema. Explore their full filmography and creative journeys."
      >
        <button
          type="button"
          onClick={() => setShowSuggest(true)}
          className="mt-2 inline-flex items-center gap-2 bg-brand text-white font-bold px-6 py-3 rounded-xl text-xs tracking-wide hover:opacity-90 transition-all shadow-lg shadow-brand/20"
        >
          <Icon icon="solar:user-plus-linear" width="16" />
          Suggest a missing person
        </button>
      </PageHeader>
      {showSuggest && <SuggestPersonModal onClose={() => setShowSuggest(false)} />}

      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px] pb-24">
        {/* Tier 1: Main Search & Filter Toolbar */}
        <div className="bg-surface/80 backdrop-blur-md border-b border-border sticky top-16 z-20 transition-all">
          <div className="p-4 sm:p-6 space-y-4">
            {/* Top Toolbar Row */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Icon
                  icon="solar:magnifer-linear"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-60 text-lg pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search filmmakers, actors, directors..."
                  className="w-full bg-surface-2 border border-border text-text-primary rounded-xl pl-11 pr-10 py-3 text-xs font-semibold placeholder:text-text-muted/60 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-all shadow-inner"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 rounded-full hover:bg-surface transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold" width="16" />
                  </button>
                )}
              </div>

              {/* Action Controls: Sort, Filter Toggle, View Switcher */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
                {/* Advanced Filters Button */}
                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    isFilterPanelOpen || activeFiltersCount > 0
                      ? 'bg-brand/10 border-brand text-brand'
                      : 'bg-surface-2 border-border text-text-primary hover:border-text-muted/40'
                  }`}
                >
                  <Icon icon="solar:filter-bold-duotone" width="16" />
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="bg-brand text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                      {activeFiltersCount}
                    </span>
                  )}
                  <Icon
                    icon="solar:alt-arrow-down-linear"
                    className={`transition-transform duration-200 ${isFilterPanelOpen ? 'rotate-180' : ''}`}
                    width="14"
                  />
                </button>

                {/* Sort Dropdown */}
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="w-full sm:w-44 bg-surface-2 border border-border text-text-primary rounded-xl px-3.5 py-2.5 text-xs font-bold appearance-none cursor-pointer focus:border-brand focus:outline-none pr-8 transition-all"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="solar:sort-vertical-linear"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-sm"
                  />
                </div>

                {/* View Switcher */}
                <div className="flex items-center bg-surface-2 p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => handleViewToggle('grid')}
                    title="Grid View"
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-surface text-brand shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:widget-2-bold" width="16" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewToggle('list')}
                    title="List View"
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-surface text-brand shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:list-bold" width="16" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Role Pills Bar */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pb-0.5">
              {PRIMARY_ROLE_FILTERS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 ${
                    roleFilter === role
                      ? 'bg-brand text-white shadow-md shadow-brand/20 ring-2 ring-brand/40'
                      : 'bg-surface-2 border border-border text-text-muted hover:text-text-primary hover:border-text-muted/30'
                  }`}
                >
                  {role}
                </button>
              ))}

              {/* More Roles Dropdown Menu */}
              <div className="relative flex-shrink-0" ref={moreRolesRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreRolesOpen(!isMoreRolesOpen)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isMoreRoleActive
                      ? 'bg-brand text-white shadow-md shadow-brand/20'
                      : 'bg-surface-2 border border-border text-text-muted hover:text-text-primary hover:border-text-muted/30'
                  }`}
                >
                  <span>{isMoreRoleActive ? roleFilter : 'More Roles'}</span>
                  <Icon
                    icon="solar:alt-arrow-down-linear"
                    className={`transition-transform duration-200 ${isMoreRolesOpen ? 'rotate-180' : ''}`}
                    width="14"
                  />
                </button>

                {isMoreRolesOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-surface border border-border rounded-2xl shadow-2xl z-50 p-2 max-h-80 overflow-y-auto space-y-1 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1.5 text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-border/50">
                      Technical & Creative Roles
                    </div>
                    {SECONDARY_ROLE_FILTERS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleSelect(role)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                          roleFilter === role
                            ? 'bg-brand/10 text-brand font-bold'
                            : 'text-text-primary hover:bg-surface-2'
                        }`}
                      >
                        <span>{role}</span>
                        {roleFilter === role && <Icon icon="solar:check-circle-bold" width="14" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tier 2: Expandable Filter Drawer / Panel */}
          {isFilterPanelOpen && (
            <div className="p-6 bg-surface-2/40 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-3">
              {/* Experience / Filmography Depth */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Icon icon="solar:clapperboard-bold" className="text-brand" width="14" />
                  Filmography Depth
                </label>
                <select
                  value={experience}
                  onChange={(e) => handleExperienceChange(e.target.value)}
                  className="w-full bg-surface border border-border text-text-primary rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:border-brand focus:outline-none"
                >
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender Filter */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Icon icon="solar:user-bold" className="text-brand" width="14" />
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => handleGenderChange(e.target.value)}
                  className="w-full bg-surface border border-border text-text-primary rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:border-brand focus:outline-none"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nationality / Region */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Icon icon="solar:global-bold" className="text-brand" width="14" />
                  Nationality / Region
                </label>
                <select
                  value={nationality}
                  onChange={(e) => handleNationalityChange(e.target.value)}
                  className="w-full bg-surface border border-border text-text-primary rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:border-brand focus:outline-none"
                >
                  {NATIONALITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Profile Attributes Toggles */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Icon icon="solar:shield-check-bold" className="text-brand" width="14" />
                  Attributes & Badges
                </label>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <button
                    type="button"
                    onClick={handleVerifiedToggle}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      verifiedOnly
                        ? 'bg-brand text-white border-brand shadow-sm'
                        : 'bg-surface border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:verified-check-bold" width="14" />
                    <span>Verified Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSpotlightToggle}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      spotlightOnly
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-surface border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:star-bold" width="14" />
                    <span>Spotlight</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePhotoOnlyToggle}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      photoOnly
                        ? 'bg-brand/20 border-brand text-brand'
                        : 'bg-surface border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Icon icon="solar:camera-bold" width="14" />
                    <span>With Headshot</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tier 3: Active Filters & Results Summary */}
          <div className="px-4 sm:px-6 py-3 bg-surface border-t border-border/60 flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-text-muted text-[11px] uppercase tracking-wider">
                {loading ? 'Finding talent...' : `Showing ${people.length} filmmakers & talent`}
              </span>

              {/* Active Filter Chips */}
              {roleFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-brand/10 border border-brand/30 text-brand text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Role: {roleFilter}
                  <button type="button" onClick={() => handleRoleSelect('All')} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}

              {search && (
                <span className="inline-flex items-center gap-1 bg-surface-2 border border-border text-text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Query: "{search}"
                  <button type="button" onClick={() => setSearch('')} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}

              {experience !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-surface-2 border border-border text-text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Experience: {experience}
                  <button type="button" onClick={() => handleExperienceChange('all')} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}

              {verifiedOnly && (
                <span className="inline-flex items-center gap-1 bg-brand/10 border border-brand/30 text-brand text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Verified Only
                  <button type="button" onClick={handleVerifiedToggle} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}

              {spotlightOnly && (
                <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Spotlight
                  <button type="button" onClick={handleSpotlightToggle} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}

              {photoOnly && (
                <span className="inline-flex items-center gap-1 bg-surface-2 border border-border text-text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  With Photo
                  <button type="button" onClick={handlePhotoOnlyToggle} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}

              {gender !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-surface-2 border border-border text-text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Gender: {gender}
                  <button type="button" onClick={() => handleGenderChange('all')} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}

              {nationality !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-surface-2 border border-border text-text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Nationality: {nationality}
                  <button type="button" onClick={() => handleNationalityChange('all')} className="hover:text-red-500">
                    <Icon icon="solar:close-circle-bold" width="13" />
                  </button>
                </span>
              )}
            </div>

            {/* Clear All Button */}
            {(activeFiltersCount > 0 || search) && (
              <button
                type="button"
                onClick={handleResetAll}
                className="text-[11px] font-black text-brand hover:underline uppercase tracking-wider flex items-center gap-1 flex-shrink-0"
              >
                <Icon icon="solar:restart-bold" width="12" />
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* Content Section (Grid vs List View) */}
        <div className="p-4 sm:p-6 lg:p-10">
          {loading && people.length === 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                  <PersonSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <PersonRowSkeleton key={i} />
                ))}
              </div>
            )
          ) : people.length === 0 ? (
            <div className="text-center py-24 bg-surface-2/10 rounded-2xl border-2 border-dashed border-border max-w-lg mx-auto p-8">
              <div className="w-16 h-16 rounded-full bg-brand/10 text-brand mx-auto flex items-center justify-center mb-4">
                <Icon icon="solar:user-linear" className="text-3xl" />
              </div>
              <h3 className="text-text-primary font-bold text-base mb-1">No filmmakers found</h3>
              <p className="text-text-muted text-xs mb-6">
                We couldn't find any talent matching your current filter criteria.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="bg-brand text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:shadow-lg hover:shadow-brand/20 transition-all"
                >
                  Clear All Filters
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuggest(true)}
                  className="bg-surface border border-border text-text-primary font-bold px-5 py-2.5 rounded-xl text-xs hover:border-brand transition-all"
                >
                  Suggest Talent
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6">
                  {people.map((person) => (
                    <PersonCard key={person.id} person={person} currentUser={user} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {people.map((person) => (
                    <PersonRow key={person.id} person={person} currentUser={user} />
                  ))}
                </div>
              )}

              {/* Load More Pagination */}
              {hasMore && (
                <div className="text-center pt-8 border-t border-border/50">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    className="bg-surface border border-border text-text-primary px-10 py-3.5 rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:border-brand hover:text-brand transition-all disabled:opacity-50 shadow-sm"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Icon icon="solar:refresh-circle-linear" className="animate-spin text-base" />
                        Loading Talent...
                      </span>
                    ) : (
                      'Load More Talent'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PeopleList
