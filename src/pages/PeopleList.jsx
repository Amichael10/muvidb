import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFollow } from '../hooks/useFollow'
import { useAuth } from '../context/AuthContext'
import { formatViewCount } from '../utils/youtube'

const PersonCard = ({ person, currentUser }) => {
  const navigate = useNavigate()
  const {
    isFollowing,
    followerCount,
    loading: followLoading,
    toggleFollow
  } = useFollow(person.id, currentUser)

  const handleFollow = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser) {
      navigate('/login', {
        state: {
          from: '/people',
          message: 'Sign in to follow filmmakers'
        }
      })
      return
    }
    await toggleFollow()
  }

  const initials = person.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const creditCount = person.credits?.length || 0

  const primaryRole = 'filmmaker'

  const roleLabels = {
    actor: 'Actor',
    director: 'Director',
    writer: 'Writer',
    producer: 'Producer',
    filmmaker: 'Filmmaker'
  }

  return (
    <Link
      to={`/people/${person.id}`}
      className="group block bg-surface rounded-2xl overflow-hidden border border-border hover:border-brand/40 transition-all hover:shadow-lg hover:shadow-brand/5"
    >
      {/* Photo */}
      <div className="relative aspect-square overflow-hidden">
        {person.photo_url ? (
          <img
            src={person.photo_url}
            alt={person.name}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <span className="text-5xl font-bold text-brand">
              {initials}
            </span>
          </div>
        )}

        {/* Verified badge */}
        {person.is_verified && (
          <div className="absolute top-2 right-2 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Verified
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-60" />
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-text-primary font-bold text-base group-hover:text-brand transition-colors line-clamp-1">
          {person.name}
        </h3>

        <p className="text-text-secondary text-xs mt-0.5 capitalize">
          {roleLabels[primaryRole]}
        </p>

        {/* Stats */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <span className="text-text-muted text-xs">
              🎬 {creditCount} films
            </span>
            {person.popularity_score > 0 && (
              <span className="text-text-muted text-xs">
                👁 {formatViewCount(person.popularity_score)}
              </span>
            )}
          </div>
        </div>

        {/* Follow button */}
        <button
          onClick={handleFollow}
          disabled={followLoading}
          className={`w-full mt-3 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
            isFollowing
              ? 'bg-transparent border border-border text-text-secondary hover:border-red-500/50 hover:text-red-500'
              : 'bg-brand text-white hover:brightness-110'
          }`}
        >
          {followLoading
            ? '...'
            : isFollowing
            ? 'Following'
            : '+ Follow'
          }
        </button>
      </div>
    </Link>
  )
}

const PeopleList = () => {
  const { user } = useAuth()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [sortBy, setSortBy] = useState('popularity')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const PAGE_SIZE = 20
  const roles = ['All', 'Actor', 'Director', 'Writer', 'Producer']
  const sortOptions = [
    { value: 'popularity', label: 'Most Popular' },
    { value: 'name', label: 'A-Z' },
    { value: 'credits', label: 'Most Credits' }
  ]

  useEffect(() => {
    setPeople([])
    setPage(0)
    setHasMore(true)
    fetchPeople(0, true)
  }, [search, roleFilter, sortBy])

  const fetchPeople = async (pageNum, reset = false) => {
    setLoading(true)

    let query = supabase
      .from('people')
      .select(`
        id, name, photo_url,
        popularity_score, is_verified,
        youtube_handle, youtube_stats,
        known_for_department,
        credits(role)
      `)

    // Search
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Sort
    if (sortBy === 'popularity') {
      query = query.order('popularity_score', { ascending: false })
    } else if (sortBy === 'name') {
      query = query.order('name', { ascending: true })
    }

    // Pagination
    query = query.range(
      pageNum * PAGE_SIZE,
      (pageNum + 1) * PAGE_SIZE - 1
    )

    const { data } = await query

    if (!data || data.length < PAGE_SIZE) {
      setHasMore(false)
    }

    // Filter by role (checks both credits and primary department)
    let filtered = data || []
    if (roleFilter !== 'All') {
      const roleKey = roleFilter.toLowerCase()
      filtered = filtered.filter(p =>
        p.known_for_department?.toLowerCase().includes(roleKey) ||
        p.credits?.some(c => c.role.toLowerCase() === roleKey)
      )
    }

    if (reset) {
      setPeople(filtered)
    } else {
      setPeople(prev => [...prev, ...filtered])
    }

    setLoading(false)
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPeople(nextPage)
  }

  return (
    <div className="min-h-screen bg-bg pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">
            People
          </h1>
          <p className="text-text-secondary">
            The actors, directors and creatives behind Nollywood
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none placeholder-text-muted"
          />

          {/* Role filter */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  roleFilter === role
                    ? 'bg-brand text-white'
                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-surface border border-border text-text-primary rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none appearance-none"
          >
            <option value="popularity">Most Popular</option>
            <option value="name">A-Z Name</option>
          </select>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {people.map(person => (
            <PersonCard key={person.id} person={person} currentUser={user} />
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && people.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <div
                key={i}
                className="bg-surface rounded-2xl animate-pulse"
              >
                <div className="aspect-square bg-surface-2 rounded-t-2xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-surface-2 rounded w-3/4" />
                  <div className="h-3 bg-surface-2 rounded w-1/2" />
                  <div className="h-8 bg-surface-2 rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && people.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">👤</div>
            <h3 className="text-text-primary text-xl font-bold mb-2">
              No people found
            </h3>
            <p className="text-text-muted">
              Try a different search or filter
            </p>
          </div>
        )}

        {/* People grid */}
        {people.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {people.map(person => (
                <PersonCard
                  key={person.id}
                  person={person}
                  currentUser={user}
                />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="text-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="bg-surface border border-border text-text-primary px-8 py-3 rounded-xl text-sm font-medium hover:border-brand hover:text-brand transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PeopleList