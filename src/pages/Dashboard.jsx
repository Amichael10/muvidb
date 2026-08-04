import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { setWatchlistWatched } from '../hooks/useWatchlist';
import { toast } from 'react-hot-toast';
import FilmCard from '../components/film/FilmCard';
import SkeletonCard from '../components/ui/SkeletonCard';

function canMutateReview(createdAt) {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000;
}

function StarRating({ rating, onChange, editable = false }) {
  const value = Number(rating) || 0;
  const stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div
      className="inline-flex items-center gap-0.5 flex-wrap"
      role={editable ? 'radiogroup' : 'img'}
      aria-label={`Rating ${value} of 10`}
    >
      {stars.map((n) => {
        const filled = n <= value;
        const className = `text-[13px] leading-none transition-colors ${
          filled ? 'text-brand' : 'text-border'
        }${editable ? ' hover:text-brand/70' : ''}`;
        if (!editable) {
          return (
            <span key={n} className={className} aria-hidden="true">
              ★
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className={className}
            aria-label={`${n} of 10`}
          >
            ★
          </button>
        );
      })}
      <span className="ml-2 text-[11px] font-semibold text-text-muted tabular-nums">{value}/10</span>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border/70">
      <div className="space-y-1.5 min-w-0">
        <h2 className="font-heading text-3xl md:text-[2.35rem] font-bold text-text-primary tracking-tight leading-none">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-text-muted leading-relaxed">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, body, cta, to }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-14 h-14 rounded-2xl bg-brand/8 text-brand flex items-center justify-center mb-6">
        <Icon icon={icon} className="text-2xl" />
      </div>
      <h3 className="font-heading font-bold text-xl text-text-primary tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-8 leading-relaxed">{body}</p>
      {cta && to && (
        <Link
          to={to}
          className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-lg text-xs font-bold hover:bg-brand/90 transition-colors"
        >
          {cta}
          <Icon icon="solar:arrow-right-linear" className="text-base" />
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('watchlist');
  const [loading, setLoading] = useState(true);

  const [watchlist, setWatchlist] = useState([]);
  const [watchFilter, setWatchFilter] = useState('all');
  const [following, setFollowing] = useState([]);
  const [followFilms, setFollowFilms] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [expandedReviewId, setExpandedReviewId] = useState(null);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    document.title = 'MuviDB | Dashboard';

    if (user?.role === 'admin' || user?.role === 'admin_limited') {
      navigate('/admin');
      return;
    }

    if (user?.role === 'professional') {
      navigate('/pro-dashboard');
      return;
    }

    if (user?.id) {
      fetchAllData();
    }
  }, [user?.id, user?.role]);

  const fetchFollowStrip = async (personIds) => {
    if (!personIds?.length) {
      setFollowFilms([]);
      return;
    }

    const { data: creditRows, error } = await supabase
      .from('credits')
      .select('film_id, created_at, films(*)')
      .in('person_id', personIds)
      .order('created_at', { ascending: false })
      .limit(48);

    if (error) {
      console.error('Follow strip load failed:', error);
      setFollowFilms([]);
      return;
    }

    const seen = new Set();
    const films = [];
    for (const row of creditRows || []) {
      const film = row.films;
      if (!film?.id || seen.has(film.id)) continue;
      seen.add(film.id);
      films.push(film);
      if (films.length >= 12) break;
    }
    setFollowFilms(films);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [wlRes, followRes, revRes] = await Promise.all([
        supabase
          .from('watchlist')
          .select('film_id, watched, watched_at, added_at, films(*)')
          .eq('user_id', user.id),
        supabase
          .from('follows')
          .select('person_id, followed_at, people(*)')
          .eq('user_id', user.id)
          .order('followed_at', { ascending: false }),
        supabase
          .from('reviews')
          .select('*, films(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (wlRes.data) {
        const rows = wlRes.data
          .filter((item) => item.films)
          .map((item) => ({
            ...item.films,
            watched: !!item.watched,
            watched_at: item.watched_at,
            added_at: item.added_at,
          }))
          .sort((a, b) => {
            if (a.watched !== b.watched) return a.watched ? 1 : -1;
            return new Date(b.added_at || 0) - new Date(a.added_at || 0);
          });
        setWatchlist(rows);
      }

      const people = (followRes.data || []).map((item) => item.people).filter(Boolean);
      setFollowing(people);
      await fetchFollowStrip(people.map((p) => p.id));

      if (revRes.data) {
        setReviews(
          revRes.data.map((r) => ({
            ...r,
            film: r.films,
          }))
        );
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      toast.error('Could not load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const toWatchCount = useMemo(() => watchlist.filter((f) => !f.watched).length, [watchlist]);
  const watchedCount = useMemo(() => watchlist.filter((f) => f.watched).length, [watchlist]);

  const filteredWatchlist = useMemo(() => {
    if (watchFilter === 'to_watch') return watchlist.filter((f) => !f.watched);
    if (watchFilter === 'watched') return watchlist.filter((f) => f.watched);
    return watchlist;
  }, [watchlist, watchFilter]);

  const handleRemoveFromWatchlist = async (film) => {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('film_id', film.id);

    if (!error) {
      setWatchlist((prev) => prev.filter((f) => f.id !== film.id));
      toast.success('Removed from watchlist');
    } else {
      toast.error('Could not remove from watchlist');
    }
  };

  const handleToggleWatched = async (film) => {
    const next = !film.watched;
    setWatchlist((prev) =>
      prev
        .map((f) =>
          f.id === film.id
            ? { ...f, watched: next, watched_at: next ? new Date().toISOString() : null }
            : f
        )
        .sort((a, b) => {
          if (a.watched !== b.watched) return a.watched ? 1 : -1;
          return new Date(b.added_at || 0) - new Date(a.added_at || 0);
        })
    );

    const { error } = await setWatchlistWatched(user.id, film.id, next);
    if (error) {
      setWatchlist((prev) =>
        prev.map((f) =>
          f.id === film.id
            ? { ...f, watched: film.watched, watched_at: film.watched_at }
            : f
        )
      );
      toast.error('Could not update watched status');
      return;
    }
    toast.success(next ? 'Marked as watched' : 'Marked as to watch');
  };

  const handleUnfollow = async (personId) => {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('user_id', user.id)
      .eq('person_id', personId);

    if (!error) {
      const nextPeople = following.filter((p) => p.id !== personId);
      setFollowing(nextPeople);
      await fetchFollowStrip(nextPeople.map((p) => p.id));
      toast.success('Unfollowed');
    } else {
      toast.error('Could not unfollow');
    }
  };

  const startEditReview = (review) => {
    if (!canMutateReview(review.created_at)) {
      toast.error('Reviews can only be edited within 5 minutes of posting');
      return;
    }
    setEditingReviewId(review.id);
    setEditBody(review.body || '');
    setEditRating(Number(review.rating) || 0);
    setExpandedReviewId(review.id);
  };

  const handleSaveReview = async (reviewId) => {
    const review = reviews.find((r) => r.id === reviewId);
    if (!review) return;
    if (!canMutateReview(review.created_at)) {
      toast.error('Reviews can only be edited within 5 minutes of posting');
      setEditingReviewId(null);
      return;
    }

    const rating = Math.min(10, Math.max(1, Number(editRating) || 1));
    const body = (editBody || '').trim();
    if (!body) {
      toast.error('Review text cannot be empty');
      return;
    }

    setSavingReview(true);
    const { error } = await supabase
      .from('reviews')
      .update({ body, rating })
      .eq('id', reviewId)
      .eq('user_id', user.id);

    setSavingReview(false);

    if (error) {
      toast.error(
        error.message?.includes('policy') || error.code === '42501'
          ? 'Reviews can only be edited within 5 minutes of posting'
          : 'Could not save review'
      );
      return;
    }

    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, body, rating } : r))
    );
    setEditingReviewId(null);
    toast.success('Review updated');
  };

  const handleDeleteReview = async (reviewId) => {
    const review = reviews.find((r) => r.id === reviewId);
    if (review && !canMutateReview(review.created_at)) {
      toast.error('Reviews can only be deleted within 5 minutes of posting');
      return;
    }

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', user.id);

    if (!error) {
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      toast.success('Review deleted');
    } else {
      toast.error(
        error.message?.includes('policy') || error.code === '42501'
          ? 'Reviews can only be deleted within 5 minutes of posting'
          : 'Could not delete review'
      );
    }
  };

  const firstName = (user?.name || user?.email || 'there').split(' ')[0];

  const tabs = [
    { id: 'watchlist', label: 'Watchlist', icon: 'solar:bookmark-linear', count: watchlist.length },
    { id: 'following', label: 'Following', icon: 'solar:users-group-rounded-linear', count: following.length },
    { id: 'reviews', label: 'Reviews', icon: 'solar:chat-square-like-linear', count: reviews.length },
    { id: 'settings', label: 'Settings', icon: 'solar:settings-linear' },
  ];

  const filterChips = [
    { id: 'all', label: 'All', count: watchlist.length },
    { id: 'to_watch', label: 'To watch', count: toWatchCount },
    { id: 'watched', label: 'Watched', count: watchedCount },
  ];

  return (
    <div className="min-h-screen bg-bg relative">
      {/* Soft atmosphere — sits under content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/[0.07] via-bg to-bg"
      />

      <div className="relative max-w-7xl mx-auto border-x border-border flex pt-20 min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 lg:w-72 border-r border-border flex-col py-10 shrink-0">
          <div className="px-6 mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted mb-2">Your library</p>
            <p className="font-heading text-xl font-bold text-text-primary tracking-tight truncate">
              Hi, {firstName}
            </p>
          </div>

          <nav className="space-y-1 px-4" aria-label="Dashboard">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-brand text-white shadow-md shadow-brand/15'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-2/60'
                  }`}
                >
                  <Icon icon={tab.icon} className={`text-lg ${active ? 'opacity-100' : 'opacity-70'}`} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`text-[10px] font-bold tabular-nums min-w-[1.25rem] text-center ${
                        active ? 'text-white/80' : 'text-text-muted/80'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto px-6 pt-8">
            <Link
              to="/browse"
              className="flex items-center gap-2 text-xs font-bold text-text-muted hover:text-brand transition-colors"
            >
              <Icon icon="solar:clapperboard-linear" className="text-base" />
              Browse catalogue
            </Link>
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-8 md:px-12 lg:px-14 py-8 md:py-12">
          {/* Mobile tabs */}
          <div className="md:hidden sticky top-16 z-20 -mx-4 px-4 mb-8 py-3 bg-bg/90 backdrop-blur-md border-b border-border/80">
            <div
              className="flex gap-1 overflow-x-auto scrollbar-none"
              role="tablist"
              aria-label="Dashboard sections"
            >
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold transition-all ${
                      active
                        ? 'bg-brand text-white'
                        : 'bg-surface-2/50 text-text-muted border border-border/60'
                    }`}
                  >
                    <Icon icon={tab.icon} className="text-sm" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="space-y-10">
              <div className="space-y-3 animate-pulse">
                <div className="h-3 w-24 bg-surface-2 rounded" />
                <div className="h-9 w-56 bg-surface-2 rounded-lg" />
                <div className="h-4 w-40 bg-surface-2 rounded" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-7">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              {/* WATCHLIST */}
              {activeTab === 'watchlist' && (
                <div className="space-y-8">
                  <SectionHeader
                    title="Watchlist"
                    subtitle={
                      watchlist.length
                        ? `${toWatchCount} to watch · ${watchedCount} watched`
                        : 'Films you want to see'
                    }
                    action={
                      watchlist.length > 0 ? (
                        <div className="flex items-center gap-1 self-start sm:self-auto">
                          {filterChips.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => setWatchFilter(chip.id)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                watchFilter === chip.id
                                  ? 'bg-text-primary text-bg'
                                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2/70'
                              }`}
                            >
                              {chip.label}
                              <span className="ml-1.5 opacity-60 tabular-nums">{chip.count}</span>
                            </button>
                          ))}
                        </div>
                      ) : null
                    }
                  />

                  {watchlist.length > 0 ? (
                    filteredWatchlist.length > 0 ? (
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-7">
                        {filteredWatchlist.map((film) => (
                          <FilmCard
                            key={film.id}
                            film={film}
                            size="md"
                            actionType="remove"
                            onAction={handleRemoveFromWatchlist}
                            showWatchedToggle
                            isWatched={!!film.watched}
                            onToggleWatched={handleToggleWatched}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="py-16 text-center text-sm text-text-muted">No titles in this filter.</p>
                    )
                  ) : (
                    <EmptyState
                      icon="solar:bookmark-linear"
                      title="Your watchlist is empty"
                      body="Save films while browsing — they show up here so you can track what to watch next."
                      cta="Browse movies"
                      to="/browse"
                    />
                  )}
                </div>
              )}

              {/* FOLLOWING */}
              {activeTab === 'following' && (
                <div className="space-y-10">
                  <SectionHeader
                    title="Following"
                    subtitle={
                      following.length
                        ? `${following.length} ${following.length === 1 ? 'person' : 'people'}`
                        : 'Actors and creatives you follow'
                    }
                  />

                  {following.length > 0 ? (
                    <>
                      <section className="space-y-4">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <h3 className="font-heading text-xl font-bold text-text-primary tracking-tight">
                              From people you follow
                            </h3>
                            <p className="text-xs text-text-muted mt-1">Recent credited films</p>
                          </div>
                        </div>

                        {followFilms.length > 0 ? (
                          <div className="relative">
                            <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x scrollbar-thin">
                              {followFilms.map((film) => (
                                <div key={film.id} className="shrink-0 snap-start">
                                  <FilmCard film={film} size="sm" />
                                </div>
                              ))}
                            </div>
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent hidden sm:block"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-text-muted py-8 text-center">
                            No credited films found for the people you follow yet.
                          </p>
                        )}
                      </section>

                      <section className="space-y-3">
                        <h3 className="font-heading text-xl font-bold text-text-primary tracking-tight">People</h3>
                        <ul className="divide-y divide-border/70 border-y border-border/70">
                          {following.map((person) => (
                            <li
                              key={person.id}
                              className="flex items-center gap-4 py-4 group"
                            >
                              <Link
                                to={`/people/${person.slug || person.id}`}
                                className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-surface-2 ring-1 ring-border group-hover:ring-brand/40 transition-all"
                              >
                                {person.photo_url || person.photo ? (
                                  <img
                                    src={person.photo_url || person.photo}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-text-muted text-sm font-bold">
                                    {(person.name || '?').charAt(0)}
                                  </div>
                                )}
                              </Link>
                              <div className="flex-1 min-w-0">
                                <Link
                                  to={`/people/${person.slug || person.id}`}
                                  className="font-semibold text-text-primary hover:text-brand transition-colors tracking-tight truncate block text-[15px]"
                                >
                                  {person.name}
                                </Link>
                                <p className="text-xs text-text-muted mt-0.5 truncate">
                                  {person.known_for_department || person.role || 'Filmmaker'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnfollow(person.id)}
                                className="text-[11px] font-bold text-text-muted hover:text-red-500 transition-colors shrink-0 px-2 py-1"
                              >
                                Unfollow
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </>
                  ) : (
                    <EmptyState
                      icon="solar:users-group-rounded-linear"
                      title="Not following anyone yet"
                      body="Follow actors and creatives on their profile pages. Their credited films will show up here."
                      cta="Explore people"
                      to="/people"
                    />
                  )}
                </div>
              )}

              {/* REVIEWS */}
              {activeTab === 'reviews' && (
                <div className="space-y-8">
                  <SectionHeader
                    title="Reviews"
                    subtitle={
                      reviews.length
                        ? `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`
                        : 'Your ratings and write-ups'
                    }
                  />

                  {reviews.length > 0 ? (
                    <ul className="space-y-0 divide-y divide-border/70">
                      {reviews.map((review) => {
                        if (!review.film) return null;
                        const expanded = expandedReviewId === review.id || editingReviewId === review.id;
                        const mutable = canMutateReview(review.created_at);
                        return (
                          <li key={review.id} className="py-7 first:pt-2">
                            <div className="flex gap-4 sm:gap-5">
                              <Link
                                to={`/films/${review.film.slug || review.film.id}`}
                                className="shrink-0 w-[72px] sm:w-20 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 ring-1 ring-border"
                              >
                                <img
                                  src={review.film.poster_url || review.film.poster}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </Link>
                              <div className="flex-1 min-w-0 space-y-2.5">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="min-w-0">
                                    <Link
                                      to={`/films/${review.film.slug || review.film.id}`}
                                      className="font-heading font-bold text-text-primary hover:text-brand transition-colors text-lg tracking-tight block truncate"
                                    >
                                      {review.film.title}
                                    </Link>
                                    <p className="text-xs text-text-muted mt-0.5">
                                      {[review.film.year, new Date(review.created_at).toLocaleDateString()].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                  {editingReviewId !== review.id && (
                                    <div className="flex items-center gap-3 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => startEditReview(review)}
                                        className={`text-[11px] font-bold transition-colors ${
                                          mutable ? 'text-text-muted hover:text-brand' : 'text-text-muted/35 cursor-not-allowed'
                                        }`}
                                        title={mutable ? 'Edit review' : 'Editable for 5 minutes after posting'}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteReview(review.id)}
                                        className={`text-[11px] font-bold transition-colors ${
                                          mutable ? 'text-text-muted hover:text-red-500' : 'text-text-muted/35'
                                        }`}
                                        title={mutable ? 'Delete review' : 'Deletable for 5 minutes after posting'}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {editingReviewId === review.id ? (
                                  <StarRating rating={editRating} editable onChange={setEditRating} />
                                ) : (
                                  <StarRating rating={review.rating} />
                                )}

                                {editingReviewId === review.id ? (
                                  <div className="space-y-3 pt-1">
                                    <textarea
                                      className="w-full bg-surface border border-border rounded-xl p-4 text-text-primary focus:border-brand focus:outline-none transition-colors text-sm min-h-[120px] leading-relaxed"
                                      rows={4}
                                      value={editBody}
                                      onChange={(e) => setEditBody(e.target.value)}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={savingReview}
                                        onClick={() => handleSaveReview(review.id)}
                                        className="bg-brand text-white px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                                      >
                                        {savingReview ? 'Saving…' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingReviewId(null)}
                                        className="text-text-muted px-5 py-2 rounded-lg text-xs font-bold hover:bg-surface-2/70"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <p
                                      className={`text-text-secondary text-sm leading-relaxed ${
                                        expanded ? '' : 'line-clamp-3'
                                      }`}
                                    >
                                      {review.body}
                                    </p>
                                    {(review.body || '').length > 160 && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedReviewId(expanded ? null : review.id)}
                                        className="mt-2 text-[11px] font-bold text-brand hover:underline"
                                      >
                                        {expanded ? 'Show less' : 'Read more'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EmptyState
                      icon="solar:chat-square-like-linear"
                      title="No reviews yet"
                      body="Rate and review films from their pages — your log will appear here."
                      cta="Browse movies"
                      to="/browse"
                    />
                  )}
                </div>
              )}

              {/* SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-10 max-w-2xl">
                  <SectionHeader title="Settings" subtitle="Profile and account preferences" />

                  <section className="space-y-6">
                    <h3 className="text-sm font-bold text-text-primary">Profile</h3>
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted">
                        <Icon icon="solar:user-linear" className="text-2xl" />
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        JPG, PNG, or WebP. Square photos work best.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-muted">Display name</label>
                        <input
                          type="text"
                          defaultValue={user.name}
                          className="w-full bg-surface border border-border text-text-primary rounded-lg px-4 py-3 text-sm focus:border-brand focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-muted">Email</label>
                        <input
                          type="email"
                          defaultValue={user.email}
                          disabled
                          className="w-full bg-surface-2/50 border border-border text-text-muted rounded-lg px-4 py-3 text-sm cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="bg-brand text-white px-6 py-2.5 rounded-lg text-xs font-bold hover:bg-brand/90 transition-colors"
                    >
                      Save changes
                    </button>
                  </section>

                  <section className="space-y-6 pt-8 border-t border-border/70">
                    <h3 className="text-sm font-bold text-text-primary">Password</h3>
                    <div className="space-y-4 max-w-md">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-muted">Current password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="w-full bg-surface border border-border text-text-primary rounded-lg px-4 py-3 text-sm focus:border-brand focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-muted">New password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="w-full bg-surface border border-border text-text-primary rounded-lg px-4 py-3 text-sm focus:border-brand focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="border border-border text-text-primary px-6 py-2.5 rounded-lg text-xs font-bold hover:border-brand hover:text-brand transition-colors"
                    >
                      Update password
                    </button>
                  </section>

                  <section className="pt-8 border-t border-border/70 space-y-3">
                    <h3 className="text-sm font-bold text-red-500">Delete account</h3>
                    <p className="text-sm text-text-muted leading-relaxed max-w-md">
                      Permanently delete your account and all associated data. This cannot be undone.
                    </p>
                    <button
                      type="button"
                      className="text-red-500 border border-red-500/25 px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-red-500/5 transition-colors"
                    >
                      Delete account
                    </button>
                  </section>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
