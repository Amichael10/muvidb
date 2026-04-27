import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFollow } from '../hooks/useFollow'
import { useAuth } from '../context/AuthContext'
import { formatViewCount } from '../utils/youtube'
import { Skeleton } from '../components/ui/Skeleton'
import { Icon } from '@iconify/react'

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
  const primaryRole = person.known_for_department || 'filmmaker'

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
      className="group block bg-surface rounded-xl overflow-hidden border border-border hover:border-brand transition-all shadow-sm"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        {person.photo_url ? (
          <img
            src={person.photo_url}
            alt={person.name}
            className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <span className="text-4xl font-heading font-bold text-brand/30">
              {initials}
            </span>
          </div>
        )}

        {person.is_verified && (
          <div className="absolute top-2 right-2 bg-brand text-white text-[8px] font-black px-2 py-0.5 rounded border border-brand/20 uppercase tracking-widest shadow-lg">
            VERIFIED
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-transparent opacity-60" />
      </div>

      <div className="p-4">
        <h3 className="text-text-primary font-bold text-sm uppercase tracking-tight group-hover:text-brand transition-colors line-clamp-1">
          {person.name}
        </h3>

        <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">
          {primaryRole}
        </p>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:clapperboard-play-linear" className="text-text-muted" width="14" />
            <span className="text-text-muted text-[9px] font-black uppercase tracking-widest">
              {creditCount} FILMS
            </span>
          </div>
        </div>

        <button
          onClick={handleFollow}
          disabled={followLoading}
          className={`w-full mt-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
            isFollowing
              ? 'bg-surface border border-border text-text-muted hover:border-red-500/50 hover:text-red-500'
              : 'bg-brand text-white hover:shadow-lg hover:shadow-brand/20'
          }`}
        >
          {followLoading
            ? '...'
            : isFollowing
            ? 'FOLLOWING'
            : '+ FOLLOW'
          }
        </button>
      </div>
    </Link>
  )
}

const PersonSkeleton = () => (
    <div className="bg-surface rounded-xl overflow-hidden border border-border">
        <div className="aspect-[4/5] bg-surface-2 animate-shimmer" />
        <div className="p-4 space-y-4">
            <div className="h-4 w-3/4 bg-surface-2 rounded-md animate-shimmer" />
            <div className="h-3 w-1/2 bg-surface-2 rounded-md animate-shimmer opacity-60" />
            <div className="h-3 w-1/3 bg-surface-2 rounded-md animate-shimmer pt-2" />
            <div className="h-10 w-full bg-surface-2 rounded-lg mt-2 animate-shimmer" />
        </div>
    </div>
)

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
        known_for_department,
        credits(id)
      `)

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    if (sortBy === 'popularity') {
      query = query.order('popularity_score', { ascending: false })
    } else if (sortBy === 'name') {
      query = query.order('name', { ascending: true })
    }

    query = query.range(
      pageNum * PAGE_SIZE,
      (pageNum + 1) * PAGE_SIZE - 1
    )

    const { data } = await query

    if (!data || data.length < PAGE_SIZE) {
      setHasMore(false)
    }

    let filtered = data || []
    if (roleFilter !== 'All') {
      const roleKey = roleFilter.toLowerCase()
      filtered = filtered.filter(p =>
        p.known_for_department?.toLowerCase().includes(roleKey)
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
    <div className="min-h-screen bg-bg">
      {/* Page Header */}
      <div className="bg-surface-2/10 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-16 pt-32 border-x border-border relative z-10">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-text-primary mb-4 tracking-tighter uppercase italic">
            The Talent
          </h1>
          <p className="text-text-muted text-sm max-w-xl italic border-l-2 border-brand pl-6">
            The actors, directors, and creatives shaping the future of Nollywood cinema. Explore their journey and filmography.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-x border-border min-h-[600px] pb-20">
        {/* Filters Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border border-b border-border">
          <div className="lg:col-span-1 p-8 space-y-4 bg-surface-2/5">
             <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="SEARCH ARCHIVE..."
                  className="w-full bg-surface border border-border text-text-primary rounded-lg px-6 py-4 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
                />
             </div>
          </div>
          
          <div className="lg:col-span-2 p-8 flex items-center gap-3 overflow-x-auto no-scrollbar">
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  roleFilter === role
                    ? 'bg-brand text-white shadow-lg shadow-brand/20'
                    : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="lg:col-span-1 p-8 bg-surface-2/5">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full bg-surface border border-border text-text-primary rounded-lg px-6 py-3.5 text-[10px] font-black tracking-widest focus:border-brand focus:outline-none transition-all"
            >
              <option value="popularity">MOST POPULAR</option>
              <option value="name">A-Z FILTERS</option>
            </select>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-8 md:p-12">
          {loading && people.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <PersonSkeleton key={i} />)}
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-32 bg-surface-2/10 rounded-xl border-2 border-dashed border-border">
              <Icon icon="solar:user-linear" className="text-4xl mx-auto mb-4 opacity-20 text-brand" />
              <h3 className="text-text-muted font-black uppercase tracking-widest text-xs">No talent discovered in this search</h3>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {people.map(person => (
                  <PersonCard key={person.id} person={person} currentUser={user} />
                ))}
              </div>

              {hasMore && (
                <div className="text-center pt-8 border-t border-border/50">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="bg-surface border border-border text-text-primary px-12 py-4 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] hover:border-brand hover:text-brand transition-all disabled:opacity-50"
                  >
                    {loading ? 'SYNCING...' : 'LOAD MORE TALENT'}
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

export default PeopleList;