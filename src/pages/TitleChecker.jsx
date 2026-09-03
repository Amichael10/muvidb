import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import PageHeader from '../components/ui/PageHeader';
import ImageWithFallback from '../components/ui/ImageWithFallback';
import FilmCard from '../components/film/FilmCard';
import { checkTitleAvailability, COUNTRY_LOOKUP } from '../services/titleChecker.js';
import { formatViewCount } from '../utils/youtube.js';
import { toTitleCase } from '../utils/format';

const POPULAR_EXAMPLES = [
  'The Houseboy Husband',
  'A Tribe Called Judah',
  'Jagun Jagun',
  'King of Boys',
  'Ada Omo Daddy',
  'Anikulapo',
];

const SOURCE_TABS = [
  { id: 'all', label: 'All Evidence', icon: 'solar:layers-minimalistic-linear' },
  { id: 'youtube', label: 'YouTube Uploads', icon: 'solar:videocamera-record-linear' },
  { id: 'database', label: 'MuviDB Catalog', icon: 'solar:clapperboard-linear' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Formats' },
  { value: 'FULL_MOVIE', label: 'Full Movies (45m+)', icon: 'solar:film-strip-bold' },
  { value: 'TRAILER', label: 'Official Trailers', icon: 'solar:clapperboard-play-bold' },
  { value: 'CLIP', label: 'Clips & Shorts', icon: 'solar:videocamera-linear' },
];

const COUNTRY_OPTIONS = [
  { value: 'all', label: 'All Countries', flag: '🌍' },
  { value: 'NG', label: 'Nigeria', flag: '🇳🇬' },
  { value: 'GH', label: 'Ghana', flag: '🇬🇭' },
  { value: 'ZA', label: 'South Africa', flag: '🇿🇦' },
  { value: 'KE', label: 'Kenya', flag: '🇰🇪' },
  { value: 'GB', label: 'UK & Diaspora', flag: '🇬🇧' },
  { value: 'US', label: 'United States', flag: '🇺🇸' },
];

const SORT_OPTIONS = [
  { value: 'views_desc', label: 'Most Viewed', icon: 'solar:fire-bold' },
  { value: 'date_desc', label: 'Newest First', icon: 'solar:clock-circle-linear' },
  { value: 'date_asc', label: 'Oldest First', icon: 'solar:history-linear' },
  { value: 'exact_first', label: 'Exact Matches First', icon: 'solar:shield-check-bold' },
];

export default function TitleChecker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Filter States
  const [activeTab, setActiveTab] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [sortBy, setSortBy] = useState('views_desc');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = 'Title Search | MuviDB';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (searchTitle) => {
    const term = (searchTitle !== undefined ? searchTitle : query).trim();
    if (!term) return;

    setIsLoading(true);
    setCopied(false);
    setSearchParams({ q: term });

    try {
      const data = await checkTitleAvailability(term);
      setResult(data);
    } catch (err) {
      console.error('Failed to check title clearance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!result) return;
    const reportText = `🎬 **Nollywood Title Search Report**
Title: "${result.query}"
Verdict: ${result.verdictTitle} (Collision Risk: ${result.riskScore}%)
Total Matches: ${result.totalMatches} (${result.databaseMatches.length} in MuviDB, ${result.youtubeMatches.length} on YouTube)
Existing YouTube Views: ${result.formattedTotalViews}
Top Competing Channel: ${result.topCompetingChannel || 'None'}
Summary: ${result.verdictMessage}
*Generated via MuviDB Title Search on ${new Date().toLocaleDateString()}*`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Filter and sort YouTube items
  const filteredYouTubeMatches = useMemo(() => {
    if (!result?.youtubeMatches) return [];
    let list = [...result.youtubeMatches];

    // Format / Type filter
    if (selectedType !== 'all') {
      list = list.filter(v => v.videoType === selectedType);
    }

    // Country filter
    if (selectedCountry !== 'all') {
      list = list.filter(v => {
        const cCode = v.countryInfo?.code || v.channelCountry || 'NG';
        return cCode.toUpperCase() === selectedCountry.toUpperCase();
      });
    }

    // Year range filter
    if (startYear) {
      const minYr = parseInt(startYear, 10);
      list = list.filter(v => v.releaseYear && v.releaseYear >= minYr);
    }
    if (endYear) {
      const maxYr = parseInt(endYear, 10);
      list = list.filter(v => v.releaseYear && v.releaseYear <= maxYr);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'views_desc') return (b.viewCount || 0) - (a.viewCount || 0);
      if (sortBy === 'date_desc') return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
      if (sortBy === 'date_asc') return new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0);
      if (sortBy === 'exact_first') {
        if (a.isExactMatch === b.isExactMatch) return (b.viewCount || 0) - (a.viewCount || 0);
        return a.isExactMatch ? -1 : 1;
      }
      return 0;
    });

    return list;
  }, [result?.youtubeMatches, selectedType, selectedCountry, startYear, endYear, sortBy]);

  // Filter and sort Database items
  const filteredDatabaseMatches = useMemo(() => {
    if (!result?.databaseMatches) return [];
    let list = [...result.databaseMatches];

    // Country filter
    if (selectedCountry !== 'all') {
      list = list.filter(f => {
        const cCode = f.countryInfo?.code || 'NG';
        return cCode.toUpperCase() === selectedCountry.toUpperCase();
      });
    }

    // Year range filter
    if (startYear) {
      const minYr = parseInt(startYear, 10);
      list = list.filter(f => f.releaseYear && f.releaseYear >= minYr);
    }
    if (endYear) {
      const maxYr = parseInt(endYear, 10);
      list = list.filter(f => f.releaseYear && f.releaseYear <= maxYr);
    }

    return list;
  }, [result?.databaseMatches, selectedCountry, startYear, endYear]);

  const hasActiveFilters = selectedType !== 'all' || selectedCountry !== 'all' || startYear !== '' || endYear !== '';

  const resetFilters = () => {
    setSelectedType('all');
    setSelectedCountry('all');
    setStartYear('');
    setEndYear('');
    setSortBy('views_desc');
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Standard MuviDB Catalogue Page Header */}
      <PageHeader
        icon="solar:magnifer-zoom-in-bold"
        eyebrow="CREATOR & PRODUCER INTELLIGENCE"
        title="Title Search"
        description="Verify if a proposed film title is available, registered in Nollywood cinema history, or active across YouTube channels before you write, produce, or register."
      />

      <main className="mx-auto max-w-7xl border-x border-border px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* Controls Bar: Search Input & Popular Presets */}
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            {/* Search Input Box */}
            <div className="relative flex-1 max-w-2xl">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
                width="18"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter proposed movie title (e.g. Lonely Love, The Houseboy Husband)..."
                className="w-full rounded-xl border border-border bg-surface py-3.5 pl-11 pr-10 text-xs sm:text-sm font-medium text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-all shadow-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResult(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                >
                  <Icon icon="solar:close-circle-bold" width="16" />
                </button>
              )}
            </div>

            {/* Check Button */}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand bg-brand px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-hover transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Icon icon="solar:restart-bold" className="w-4 h-4 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Icon icon="solar:radar-linear" className="w-4 h-4" />
                  <span>Check Title</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Examples */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-text-muted font-medium">Quick examples:</span>
            {POPULAR_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuery(ex);
                  handleSearch(ex);
                }}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-text-secondary hover:border-brand/40 hover:text-text-primary transition-all cursor-pointer"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto mb-4 text-brand">
              <Icon icon="solar:radar-2-bold" className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Scanning Nollywood Database & YouTube Channels...
            </h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Comparing channel countries, full movie uploads, trailer lengths, and audience view counts.
            </p>
          </div>
        )}

        {/* Clearance Verdict Card */}
        {result && !isLoading && (
          <div className="space-y-6">
            <div className={`rounded-2xl border p-6 sm:p-7 transition-all ${
              result.riskLevel === 'CLEAR'
                ? 'border-emerald-500/30 bg-emerald-950/10'
                : result.riskLevel === 'MODERATE'
                ? 'border-amber-500/30 bg-amber-950/10'
                : 'border-rose-500/30 bg-rose-950/10'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                    result.riskLevel === 'CLEAR'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : result.riskLevel === 'MODERATE'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                  }`}>
                    <Icon
                      icon={
                        result.riskLevel === 'CLEAR'
                          ? 'solar:check-circle-bold'
                          : result.riskLevel === 'MODERATE'
                          ? 'solar:danger-triangle-bold'
                          : 'solar:close-circle-bold'
                      }
                      className="w-6 h-6"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="font-heading text-xl sm:text-2xl font-black text-text-primary tracking-tight">
                        {result.verdictTitle}
                      </h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                        result.riskLevel === 'CLEAR'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : result.riskLevel === 'MODERATE'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        Collision Risk: {result.riskScore}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-text-secondary max-w-3xl leading-relaxed">
                      {result.verdictMessage}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-text-primary hover:border-brand/40 transition-all cursor-pointer shadow-sm"
                  >
                    <Icon icon={copied ? 'solar:check-read-linear' : 'solar:copy-linear'} className="w-4 h-4 text-brand" />
                    <span>{copied ? 'Report Copied' : 'Copy Summary'}</span>
                  </button>
                </div>
              </div>

              {/* Stats Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-6 pt-5 border-t border-border">
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-xl font-black tabular-nums tracking-tight text-text-primary">
                    {result.totalMatches}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted mt-0.5">
                    Total Matches
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-xl font-black tabular-nums tracking-tight text-text-primary">
                    {result.databaseMatches.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted mt-0.5">
                    MuviDB Catalog
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-xl font-black tabular-nums tracking-tight text-text-primary">
                    {result.youtubeMatches.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted mt-0.5">
                    YouTube Uploads
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface/80 p-3.5 backdrop-blur-sm">
                  <p className="font-heading text-xl font-black tabular-nums tracking-tight text-brand">
                    {result.formattedTotalViews}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted mt-0.5">
                    Cumulative Views
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Controls Bar (Type, Country, Year Range, Sort) */}
            <div className="rounded-2xl border border-border bg-surface/90 p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Source Tabs */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {SOURCE_TABS.map((tab) => {
                    const active = activeTab === tab.id;
                    const count = tab.id === 'all' 
                      ? filteredYouTubeMatches.length + filteredDatabaseMatches.length 
                      : tab.id === 'youtube' 
                      ? filteredYouTubeMatches.length 
                      : filteredDatabaseMatches.length;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                          active
                            ? 'border-brand bg-brand text-white shadow-md shadow-brand/20'
                            : 'border-border bg-surface-2/60 text-text-muted hover:border-brand/40 hover:text-text-primary'
                        }`}
                      >
                        <Icon icon={tab.icon} width="14" />
                        <span>{tab.label} ({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-brand hover:underline font-bold self-start md:self-center flex items-center gap-1 cursor-pointer"
                  >
                    <Icon icon="solar:restart-linear" width="13" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>

              {/* Advanced Dropdown & Year Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/60">
                
                {/* 1. Format / Length Filter */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                    Video Format / Length
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary focus:border-brand focus:outline-none"
                  >
                    {TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Channel Country Filter */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                    Channel Origin / Country
                  </label>
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary focus:border-brand focus:outline-none"
                  >
                    {COUNTRY_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.flag} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Year Range Filter */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                    Release Year Range
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="From (e.g. 2020)"
                      value={startYear}
                      onChange={(e) => setStartYear(e.target.value)}
                      className="w-1/2 rounded-xl border border-border bg-surface-2 px-2.5 py-2 text-xs font-semibold text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
                    />
                    <span className="text-text-muted text-xs font-bold">-</span>
                    <input
                      type="number"
                      placeholder="To (e.g. 2026)"
                      value={endYear}
                      onChange={(e) => setEndYear(e.target.value)}
                      className="w-1/2 rounded-xl border border-border bg-surface-2 px-2.5 py-2 text-xs font-semibold text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. Sort By */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 block">
                    Sort Order
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary focus:border-brand focus:outline-none"
                  >
                    {SORT_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            {/* Results Display */}
            <div className="space-y-8">
              
              {/* YouTube Video Results */}
              {(activeTab === 'all' || activeTab === 'youtube') && filteredYouTubeMatches.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-base font-bold text-text-primary flex items-center gap-2">
                      <Icon icon="solar:videocamera-record-bold" className="text-red-500" width="18" />
                      Live YouTube Uploads ({filteredYouTubeMatches.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredYouTubeMatches.map((video) => (
                      <div
                        key={video.id}
                        className="group bg-surface rounded-2xl overflow-hidden border border-border hover:border-brand transition-all duration-300 shadow-sm flex flex-col sm:flex-row gap-4 p-4"
                      >
                        {/* Video Thumbnail */}
                        <div className="relative w-full sm:w-48 aspect-video shrink-0 rounded-xl overflow-hidden bg-surface-2 border border-border/50">
                          <ImageWithFallback
                            src={video.thumbnail}
                            alt={video.title}
                            fallbackType="backdrop"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          
                          {/* Duration Badge */}
                          {video.duration && (
                            <span className="absolute bottom-1.5 right-1.5 bg-black/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                              <Icon icon="solar:clock-circle-linear" width="11" />
                              {video.duration}
                            </span>
                          )}

                          {/* Country Flag Badge */}
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/85 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                            <span>{video.countryInfo?.flag || '🇳🇬'}</span>
                            <span>{video.countryInfo?.name || 'Nigeria'}</span>
                          </div>

                          {/* Video Format / Type Badge */}
                          <div className="absolute top-1.5 right-1.5">
                            {video.videoType === 'FULL_MOVIE' ? (
                              <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow">
                                Full Movie
                              </span>
                            ) : video.videoType === 'TRAILER' ? (
                              <span className="bg-purple-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow">
                                Trailer
                              </span>
                            ) : (
                              <span className="bg-slate-700/90 text-slate-200 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shadow">
                                Clip
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Video Information */}
                        <div className="flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            {/* Format & Exact Match Line */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                video.videoType === 'FULL_MOVIE'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : video.videoType === 'TRAILER'
                                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                  : 'bg-surface-2 text-text-muted border border-border'
                              }`}>
                                <Icon 
                                  icon={
                                    video.videoType === 'FULL_MOVIE' 
                                      ? 'solar:film-strip-bold' 
                                      : video.videoType === 'TRAILER' 
                                      ? 'solar:clapperboard-play-bold' 
                                      : 'solar:videocamera-linear'
                                  } 
                                  width="12" 
                                />
                                <span>{video.videoTypeLabel} • {video.duration}</span>
                              </span>

                              {video.isExactMatch && (
                                <span className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-black uppercase px-1.5 py-0.5 rounded">
                                  Exact Title Match
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-heading text-sm font-bold text-text-primary group-hover:text-brand line-clamp-2 transition-colors leading-snug"
                            >
                              {video.title}
                            </a>

                            {/* Channel Meta */}
                            <div className="flex items-center gap-2 text-xs text-text-muted mt-2">
                              {video.channelAvatar ? (
                                <img
                                  src={video.channelAvatar}
                                  alt={video.channelTitle}
                                  className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-surface-2 border border-border flex items-center justify-center shrink-0 text-[10px] font-bold text-text-muted">
                                  <Icon icon="solar:tv-linear" width="11" />
                                </div>
                              )}
                              <span className="font-semibold text-text-secondary truncate">{video.channelTitle}</span>
                            </div>
                          </div>

                          {/* Bottom Stats & Watch Action */}
                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/80 text-xs">
                            <div className="flex items-center gap-2 text-text-muted">
                              <span className="font-bold text-text-primary flex items-center gap-1">
                                <Icon icon="solar:eye-linear" className="w-3.5 h-3.5 text-brand" />
                                {video.formattedViews} views
                              </span>
                              {video.formattedDate && (
                                <>
                                  <span>•</span>
                                  <span>{video.formattedDate}</span>
                                </>
                              )}
                            </div>

                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-brand hover:text-brand-hover inline-flex items-center gap-1 shrink-0"
                            >
                              <span>Watch</span>
                              <Icon icon="solar:arrow-right-up-linear" width="12" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Database Results Catalog */}
              {(activeTab === 'all' || activeTab === 'database') && filteredDatabaseMatches.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-base font-bold text-text-primary flex items-center gap-2">
                      <Icon icon="solar:clapperboard-bold" className="text-brand" width="18" />
                      MuviDB Official Catalog & Cinema Records ({filteredDatabaseMatches.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                    {filteredDatabaseMatches.map((film) => (
                      <div key={film.id} className="relative group">
                        <FilmCard film={film} />
                        {film.isExactMatch && (
                          <div className="absolute top-2 left-2 z-20">
                            <span className="bg-rose-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow">
                              Exact Match
                            </span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 z-20">
                          <span className="bg-black/85 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                            {film.countryInfo?.flag || '🇳🇬'} {film.releaseYear || ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state under active filters */}
              {((activeTab === 'youtube' && filteredYouTubeMatches.length === 0) ||
                (activeTab === 'database' && filteredDatabaseMatches.length === 0) ||
                (activeTab === 'all' && filteredYouTubeMatches.length === 0 && filteredDatabaseMatches.length === 0)) && (
                <div className="rounded-2xl border border-border bg-surface p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-2 border border-border text-text-muted flex items-center justify-center mx-auto mb-3">
                    <Icon icon="solar:magnifer-linear" width="24" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-text-primary">
                    No Matching Results Under Current Filters
                  </h3>
                  <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                    Try clearing your country or year filters to see all available title evidence.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 px-4 py-2 bg-surface-2 border border-border hover:border-brand text-xs font-bold text-text-primary rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Icon icon="solar:restart-linear" width="14" />
                      <span>Clear All Filters</span>
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Footer Advisory Cards matching MuviDB standard */}
        <div className="pt-10 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm font-heading">
              <Icon icon="solar:copyright-linear" className="text-brand" width="18" />
              <span>Title Ownership & Clearance</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Movie titles cannot be copyrighted under general trademark law, but identical titles split audience discovery and confuse streaming algorithms.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm font-heading">
              <Icon icon="solar:ticket-linear" className="text-brand" width="18" />
              <span>NFVCB & Cinema Registry</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              If your movie is heading to Nigerian cinemas, exhibitors and the NFVCB require distinct title verification to prevent consumer confusion.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-bold text-sm font-heading">
              <Icon icon="solar:magic-stick-3-linear" className="text-brand" width="18" />
              <span>Creative Differentiation</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              If an existing movie shares your idea, adding a distinctive subtitle or theme gives you a fresh search footprint while retaining your original vision.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
