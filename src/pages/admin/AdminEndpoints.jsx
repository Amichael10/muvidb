import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { authHeaders } from '../../lib/apiAuth';

// Complete registry of background sync, scraping, and maintenance endpoints
const ENDPOINTS_CATALOG = [
  // ── 1. CINEMAS & SHOWTIMES ────────────────────────────────────────────────
  {
    id: 'showtimes',
    name: 'Cinema Showtimes Sync',
    category: 'cinemas',
    categoryLabel: 'Cinemas',
    categoryIcon: 'solar:ticket-bold',
    categoryColor: 'amber',
    route: '/api/cron/sync?task=showtimes',
    method: 'POST',
    schedule: 'Every 3 hours (0 */3 * * *)',
    logSource: 'showtimes',
    triggerable: true,
    description:
      'Scrapes and normalizes live cinema listings, movie schedules, and booking links across Genesis Cinemas, Silverbird (Veezi), Viva Cinemas, Ozone, Kada, KAP Cinema, and Blue Pictures.',
    affected: 'cinemas, cinema_showtimes, films (is_in_cinemas)',
  },
  {
    id: 'cinema_cleanup',
    name: 'Cinema Stale Screenings Cleanup',
    category: 'cinemas',
    categoryLabel: 'Cinemas',
    categoryIcon: 'solar:trash-bin-trash-bold',
    categoryColor: 'amber',
    route: '/api/cron/sync?task=cinema_cleanup',
    method: 'POST',
    schedule: 'Daily at 02:00 UTC',
    logSource: 'cinema_cleanup',
    triggerable: true,
    description:
      'Sweeps outdated screening dates, archives ended cinema runs, and safely untoggles is_in_cinemas for titles that have departed theatres.',
    affected: 'cinema_showtimes, films (is_in_cinemas)',
  },

  // ── 2. STAGE & THEATRE PLAYS ──────────────────────────────────────────────
  {
    id: 'theatre_status_sweep',
    name: 'Theatre Plays Status Sweep',
    category: 'theatre',
    categoryLabel: 'Stage & Theatre',
    categoryIcon: 'solar:mask-hamsa-bold',
    categoryColor: 'purple',
    route: '/api/cron/sync?task=theatre_status_sweep',
    method: 'POST',
    schedule: 'Daily at 00:05 UTC',
    logSource: 'theatre_status_sweep',
    triggerable: true,
    description:
      'Evaluates all stage plays in Nigeria against current date. Automatically transitions plays between upcoming, currently_running, and archived based on run_start_date and run_end_date.',
    affected: 'plays (status)',
  },
  {
    id: 'bap_theatre',
    name: 'Terra Kulture & BAP Stage Sync',
    category: 'theatre',
    categoryLabel: 'Stage & Theatre',
    categoryIcon: 'solar:clapperboard-play-bold',
    categoryColor: 'purple',
    route: '/api/cron/sync?task=bap_theatre',
    method: 'POST',
    schedule: 'Weekly / On-demand',
    logSource: 'bap_theatre',
    triggerable: true,
    description:
      'Syncs stage play productions, cast credits, performance runs, and ticketing links for Bolanle Austen-Peters Productions and Terra Kulture stage shows.',
    affected: 'plays, stage_credits, play_venues',
  },
  {
    id: 'utopia_theatre',
    name: 'Utopia Theatre & Crucible Stage Sync',
    category: 'theatre',
    categoryLabel: 'Stage & Theatre',
    categoryIcon: 'solar:masks-bold',
    categoryColor: 'purple',
    route: '/api/cron/sync?task=utopia_theatre',
    method: 'POST',
    schedule: 'Weekly / On-demand',
    logSource: 'utopia_theatre',
    triggerable: true,
    description:
      'Syncs African classical and diaspora stage repertoire from Utopia Theatre (Arts Council England NPO), Sheffield Theatres (Crucible/Studio), and Belgrade Theatre Coventry, including Crown of Blood, The Gods Are Not to Blame, and multi-currency box office estimates.',
    affected: 'plays, stage_credits, companies',
  },
  {
    id: 'theatre_hubs_sync',
    name: 'Theatrical Hubs Periodic Scraper (Tix, Ariiya, Nairabox, MUSON, Anthill)',
    category: 'theatre',
    categoryLabel: 'Stage & Theatre',
    categoryIcon: 'solar:masks-bold',
    categoryColor: 'purple',
    route: '/api/cron/sync?task=theatre_hubs_sync',
    method: 'POST',
    schedule: 'Daily at 05:00 UTC / On-demand',
    logSource: 'theatre_hubs_sync',
    triggerable: true,
    description:
      'Discovers and ingests upcoming, running, and past stage plays and musicals across Tix.africa, Ariiya Tickets, Nairabox, MUSON Centre, and Anthill Studios Immersive Theatre with zero-duplicate actor reconciliation.',
    affected: 'plays, stage_credits, play_images',
  },

  // ── 3. STREAMING PLATFORMS & YOUTUBE ──────────────────────────────────────
  {
    id: 'channel_fetcher',
    name: 'YouTube Studio Channels Ingestion',
    category: 'streaming',
    categoryLabel: 'Streaming & Video',
    categoryIcon: 'solar:videocamera-record-bold',
    categoryColor: 'red',
    route: '/api/automation?action=fetch-channels',
    method: 'POST',
    schedule: 'Every 30 minutes',
    logSource: 'channel_fetcher',
    triggerable: true,
    description:
      'Monitors registered Nollywood studio channels (Yorubahood, Sceneone, FBNolly, Uche Nancy, Ruth Kadiri, etc.) for new feature-length film uploads and official trailers.',
    affected: 'channel_videos, films, video_sync_buffer',
  },
  {
    id: 'views',
    name: 'YouTube Views & Engagement Counts',
    category: 'streaming',
    categoryLabel: 'Streaming & Video',
    categoryIcon: 'solar:eye-bold',
    categoryColor: 'red',
    route: '/api/cron/sync?task=views',
    method: 'POST',
    schedule: 'Hourly',
    logSource: 'views',
    triggerable: true,
    description:
      'Refreshes view counts, likes, and watch statistics in batches from the YouTube Data API to keep platform popularity metrics and trending rankings fresh.',
    affected: 'films (view_count, popularity_score)',
  },
  {
    id: 'tmdb',
    name: 'TMDB African Film Discovery',
    category: 'streaming',
    categoryLabel: 'Streaming & Video',
    categoryIcon: 'solar:film-bold',
    categoryColor: 'blue',
    route: '/api/cron/sync?task=tmdb',
    method: 'POST',
    schedule: 'Daily at 04:00 UTC',
    logSource: 'tmdb',
    triggerable: true,
    description:
      'Queries The Movie Database (TMDB) for newly registered Nigerian and African releases, matching synopses, official backdrops, poster art, and ratings.',
    affected: 'films (synopsis, poster_url, backdrop_url, tmdb_id)',
  },
  {
    id: 'youtube-rss-watch',
    name: 'YouTube RSS Fast Upload Scanner',
    category: 'streaming',
    categoryLabel: 'Streaming & Video',
    categoryIcon: 'solar:bolt-bold',
    categoryColor: 'red',
    route: '/api/automation?action=youtube-rss-watch',
    method: 'POST',
    schedule: 'Every 15 minutes',
    logSource: 'youtube-rss-watch',
    triggerable: true,
    description:
      'High-frequency RSS scanner monitoring priority Nollywood channels for instant upload detection without burning through YouTube API quota limits.',
    affected: 'channel_videos, instant_notifications',
  },
  {
    id: 'youtube-websub-renew',
    name: 'WebSub Push Hub Subscription Renewal',
    category: 'streaming',
    categoryLabel: 'Streaming & Video',
    categoryIcon: 'solar:refresh-circle-bold',
    categoryColor: 'red',
    route: '/api/automation?action=youtube-websub-renew',
    method: 'POST',
    schedule: 'Weekly on Sunday',
    logSource: 'youtube-websub-renew',
    triggerable: true,
    description:
      'Renews Google WebSub / PubSubHubbub push callback subscriptions to maintain real-time webhooks on newly published Nollywood films.',
    affected: 'youtube_websub_subscriptions',
  },

  {
    id: 'refresh_videos',
    name: 'Video Metadata & Stream Re-evaluator',
    category: 'streaming',
    categoryLabel: 'Streaming & Video',
    categoryIcon: 'solar:play-stream-bold',
    categoryColor: 'red',
    route: '/api/cron/sync?task=refresh_videos',
    method: 'POST',
    schedule: 'On-demand',
    logSource: 'refresh_videos',
    triggerable: true,
    description:
      'Re-checks duration, availability, and embed permissions for all existing YouTube video records in the catalogue.',
    affected: 'films (duration_seconds, stream_status)',
  },
  {
    id: 'streaming_fleet',
    name: 'OTT Scrapers (Netflix, Prime, MUBI, Ironflix, Nollistream)',
    category: 'streaming',
    categoryLabel: 'Streaming & Video',
    categoryIcon: 'solar:tv-bold',
    categoryColor: 'indigo',
    route: 'CLI / Worker: npm run sync:all-requested',
    method: 'CLI_WORKER',
    schedule: 'Scheduled via GitHub Actions / Headless Worker',
    logSource: 'streaming_scrapers',
    triggerable: false,
    description:
      'Scrapes streaming platforms (Netflix, Prime Video, MUBI, Ironflix, Nollistream, Docuth, EbonyLife ON, Circuits). Uses Playwright and residential proxies to bypass geolocation restrictions.',
    affected: 'films (streaming_links, release_type)',
  },

  // ── 4. FILM CRITICS & REVIEWS ─────────────────────────────────────────────
  {
    id: 'critics',
    name: 'Written Critics & Reviews Sync',
    category: 'critics',
    categoryLabel: 'Critics & Reviews',
    categoryIcon: 'solar:chat-round-bold',
    categoryColor: 'emerald',
    route: '/api/cron/sync?task=critics',
    method: 'POST',
    schedule: 'Every Sunday at 05:00 UTC',
    logSource: 'critics',
    triggerable: true,
    description:
      'Scrapes written reviews, ratings, and quotes from registered Nigerian film critics (ShockNG, Nollyverse, What Kept Me Up, Film Efiko, Nollywood Reinvented).',
    affected: 'critic_reviews, critic_ratings, films (critic_score)',
  },
  {
    id: 'critic_videos',
    name: 'Critic Video Reviews Discovery',
    category: 'critics',
    categoryLabel: 'Critics & Reviews',
    categoryIcon: 'solar:video-library-bold',
    categoryColor: 'emerald',
    route: '/api/cron/sync?task=critic_videos',
    method: 'POST',
    schedule: 'Daily at 06:00 UTC',
    logSource: 'critic_videos',
    triggerable: true,
    description:
      'Polls YouTube channels of video critics (Film Efiko, Cinema Pointer, etc.) and queues new review videos for transcript extraction and sentiment analysis.',
    affected: 'critic_video_candidates',
  },
  {
    id: 'comments',
    name: 'Audience Comments Sentiment Mining',
    category: 'critics',
    categoryLabel: 'Critics & Reviews',
    categoryIcon: 'solar:dialog-bold',
    categoryColor: 'emerald',
    route: '/api/cron/sync?task=comments',
    method: 'POST',
    schedule: 'Daily at 07:00 UTC',
    logSource: 'comments',
    triggerable: true,
    description:
      'Extracts top audience reactions and discussions from YouTube releases and mines audience sentiment scores and tag summaries using AI.',
    affected: 'comment_reviews, films (liked_percent, audience_score)',
  },
  {
    id: 'comments_remine',
    name: 'Audience Comments Noise Remine',
    category: 'critics',
    categoryLabel: 'Critics & Reviews',
    categoryIcon: 'solar:filter-bold',
    categoryColor: 'emerald',
    route: '/api/cron/sync?task=comments_remine',
    method: 'POST',
    schedule: 'Monthly / On-demand',
    logSource: 'comments_remine',
    triggerable: true,
    description:
      'Purges engagement-bait noise ("first to comment", "watching in 2026") from historical comments and re-scores sentiment oldest-first.',
    affected: 'comment_reviews',
  },

  // ── 5. BOX OFFICE INTELLIGENCE ────────────────────────────────────────────
  {
    id: 'box_office_digest',
    name: 'Film Intelligence Digest Box Office Sync',
    category: 'box_office',
    categoryLabel: 'Box Office',
    categoryIcon: 'solar:dollar-bold',
    categoryColor: 'amber',
    route: '/api/cron/sync?task=box_office_digest',
    method: 'POST',
    schedule: 'Weekly on Monday',
    logSource: 'box_office_digest',
    triggerable: true,
    description:
      'Parses weekly Nigerian theatrical box office data from Film Intelligence Digest (CEAN & Filmhouse). Enriches domestic gross, weekend admissions, screen locations, and opening weekend records.',
    affected: 'films (box_office_domestic, box_office_opening_weekend, box_office_history)',
  },
  {
    id: 'theatre_box_office',
    name: 'Live Theatre Admissions & Box Office',
    category: 'box_office',
    categoryLabel: 'Box Office',
    categoryIcon: 'solar:chart-square-bold',
    categoryColor: 'amber',
    route: '/api/cron/sync?task=theatre_box_office',
    method: 'POST',
    schedule: 'Weekly',
    logSource: 'theatre_box_office',
    triggerable: true,
    description:
      'Tracks ticket revenue, hall capacity, and admissions figures for live stage productions and musicals staged at Terra Kulture and MUSON Centre.',
    affected: 'plays (box_office_gross, admissions)',
  },

  // ── 6. SOCIAL STUDIO & EDITORIAL ──────────────────────────────────────────
  {
    id: 'social_plan',
    name: 'Social Studio Rolling 7-Day Planner',
    category: 'social',
    categoryLabel: 'Social Studio',
    categoryIcon: 'solar:calendar-bold',
    categoryColor: 'cyan',
    route: '/api/cron/sync?task=social_plan',
    method: 'POST',
    schedule: 'Daily at 01:00 UTC',
    logSource: 'social_plan',
    triggerable: true,
    description:
      'Plans the rolling 7-day social publishing calendar across Actor Spotlights (6-slide carousels), Behind The Camera, Now Streaming reels, Weekend Watchlists, and Debate cards.',
    affected: 'social_content_items, social_editorial_calendar',
  },
  {
    id: 'social_preflight',
    name: 'Social Publishing Preflight Gate',
    category: 'social',
    categoryLabel: 'Social Studio',
    categoryIcon: 'solar:shield-check-bold',
    categoryColor: 'cyan',
    route: '/api/cron/sync?task=social_preflight',
    method: 'POST',
    schedule: 'Every 2 hours',
    logSource: 'social_preflight',
    triggerable: true,
    description:
      'Automated quality gate inspecting queued posts: verifies verified 4:5 posters, 6-slide carousel completeness, caption rules, and platform hashtag limits.',
    affected: 'social_content_items (status)',
  },
  {
    id: 'social_publish',
    name: 'Social Studio Automated Publisher',
    category: 'social',
    categoryLabel: 'Social Studio',
    categoryIcon: 'solar:send-square-bold',
    categoryColor: 'cyan',
    route: '/api/cron/sync?task=social_publish',
    method: 'POST',
    schedule: 'Every 15 minutes',
    logSource: 'social_publish',
    triggerable: true,
    description:
      'Dispatches scheduled and approved posts to connected social channels (Instagram, Facebook, X, LinkedIn, Telegram) with concurrency locks.',
    affected: 'social_content_items, published_posts',
  },
  {
    id: 'social_prune_assets',
    name: 'Social Studio Temporary Asset Pruner',
    category: 'social',
    categoryLabel: 'Social Studio',
    categoryIcon: 'solar:trash-bin-minimalistic-bold',
    categoryColor: 'cyan',
    route: '/api/cron/sync?task=social_prune_assets',
    method: 'POST',
    schedule: 'Daily at 03:00 UTC',
    logSource: 'social_prune_assets',
    triggerable: true,
    description:
      'Cleans up rendered temp slides, temporary video clips, and audio stems older than 48 hours to conserve cloud storage quota.',
    affected: 'storage.social-rendered-assets',
  },

  // ── 7. AI & METADATA MAINTENANCE ──────────────────────────────────────────
  {
    id: 'ai_maintenance',
    name: 'Master AI Data Pipeline (Cast & Synopsis)',
    category: 'ai',
    categoryLabel: 'AI & Maintenance',
    categoryIcon: 'solar:cpu-bolt-bold',
    categoryColor: 'rose',
    route: '/api/cron/sync?task=ai_maintenance',
    method: 'POST',
    schedule: 'Daily at 08:00 UTC',
    logSource: 'ai_maintenance',
    triggerable: true,
    description:
      'Sequential pipeline that extracts character and actor names from noisy video titles, normalizes movie titles, and generates missing synopses via Cohere.',
    affected: 'films, credits, people',
  },
  {
    id: 'cohere_synopses',
    name: 'Cohere AI Synopsis Generator',
    category: 'ai',
    categoryLabel: 'AI & Maintenance',
    categoryIcon: 'solar:magic-stick-3-bold',
    categoryColor: 'rose',
    route: '/api/cron/sync?task=cohere_synopses',
    method: 'POST',
    schedule: 'Nightly / On-demand',
    logSource: 'cohere_synopses',
    triggerable: true,
    description:
      'Scans films missing loglines or containing marketing descriptions and generates clean, factual 2-sentence loglines using Cohere Command-R.',
    affected: 'films (synopsis)',
  },
  {
    id: 'actor_enricher',
    name: 'Actor Profile Deep Enrichment',
    category: 'ai',
    categoryLabel: 'AI & Maintenance',
    categoryIcon: 'solar:user-check-bold',
    categoryColor: 'rose',
    route: '/api/automation?action=enrich-actors',
    method: 'POST',
    schedule: 'Nightly',
    logSource: 'actor_enricher',
    triggerable: true,
    description:
      'Enriches actor profiles: discovers verified birth years, Nigerian state of origin, education, awards history, and attaches missing filmography credits.',
    affected: 'people, credits',
  },
  {
    id: 'people_cutouts',
    name: 'Actor Headshot Cutouts Removal',
    category: 'ai',
    categoryLabel: 'AI & Maintenance',
    categoryIcon: 'solar:user-id-bold',
    categoryColor: 'rose',
    route: '/api/cron/sync?task=people_cutouts',
    method: 'POST',
    schedule: 'Every 6 hours (2 per run)',
    logSource: 'people_cutouts',
    triggerable: true,
    description:
      'AI background removal job that isolates high-resolution transparent portraits for Nollywood actors for use in Spotlight & Behind The Camera carousels.',
    affected: 'people (cutout_url)',
  },
  {
    id: 'classify_film_kinds',
    name: 'Film Kind & Format Classifier',
    category: 'ai',
    categoryLabel: 'AI & Maintenance',
    categoryIcon: 'solar:tag-bold',
    categoryColor: 'rose',
    route: '/api/cron/sync?task=classify_film_kinds',
    method: 'POST',
    schedule: 'Weekly',
    logSource: 'classify_film_kinds',
    triggerable: true,
    description:
      'Classifies titles into feature film, short film, web series, comedy skit, or stage recording based on duration, title keywords, and credit structures.',
    affected: 'films (film_kind)',
  },
  {
    id: 'mirror_images',
    name: 'Cloudinary CDN Image Mirror',
    category: 'ai',
    categoryLabel: 'AI & Maintenance',
    categoryIcon: 'solar:gallery-bold',
    categoryColor: 'rose',
    route: '/api/cron/sync?task=mirror_images',
    method: 'POST',
    schedule: 'Nightly',
    logSource: 'mirror_images',
    triggerable: true,
    description:
      'Mirrors external movie posters and backdrops to Cloudinary CDN for instant loading and mobile bandwidth savings.',
    affected: 'films (poster_url, backdrop_url)',
  },
  {
    id: 'deduplicator',
    name: 'Entity Deduplicator & Merging Engine',
    category: 'ai',
    categoryLabel: 'AI & Maintenance',
    categoryIcon: 'solar:radar-2-bold',
    categoryColor: 'rose',
    route: '/api/automation?action=deduplicator',
    method: 'POST',
    schedule: 'On-demand',
    logSource: 'deduplicator',
    triggerable: true,
    description:
      'Fuzzy-matches actor, crew, and film entries to flag duplicates and propose clean, zero-loss mergers without orphaned credits.',
    affected: 'people, films, credits',
  },

  // ── 8. ALERTS & OUTREACH ──────────────────────────────────────────────────
  {
    id: 'whatsapp_alerts',
    name: 'WhatsApp Movie Releases Queue',
    category: 'alerts',
    categoryLabel: 'Alerts & Outreach',
    categoryIcon: 'solar:chat-round-call-bold',
    categoryColor: 'teal',
    route: '/api/cron/sync?task=whatsapp_alerts',
    method: 'POST',
    schedule: 'Every 30 minutes',
    logSource: 'whatsapp_alerts',
    triggerable: true,
    description:
      'Scans for newly released cinema and streaming movies, matches user alert preferences, and drains the WhatsApp outbound notification queue.',
    affected: 'whatsapp_alerts_queue, whatsapp_subscribers',
  },
  {
    id: 'morning_briefing',
    name: 'Daily Morning Outreach Briefing',
    category: 'alerts',
    categoryLabel: 'Alerts & Outreach',
    categoryIcon: 'solar:letter-bold',
    categoryColor: 'teal',
    route: '/api/cron/sync?task=morning_briefing',
    method: 'POST',
    schedule: 'Daily at 08:30 UTC',
    logSource: 'morning_briefing',
    triggerable: true,
    description:
      'Prepares and sends the daily morning executive summary on filmmaker outreach, newly claimed actor profiles, and pipeline health.',
    affected: 'outreach_logs, admin_notifications',
  },

  // ── 9. MASTER PIPELINE ────────────────────────────────────────────────────
  {
    id: 'master',
    name: 'Daily Master Multi-Task Sync',
    category: 'master',
    categoryLabel: 'Master Pipeline',
    categoryIcon: 'solar:play-circle-bold',
    categoryColor: 'indigo',
    route: '/api/cron/sync',
    method: 'POST',
    schedule: 'Daily at 04:00 UTC',
    logSource: 'master',
    triggerable: true,
    description:
      'Master orchestrator executing the full daily cycle in sequence: Showtimes, YouTube videos, TMDB, Stage plays, Critics, AI Maintenance, and Social Planner.',
    affected: 'Entire platform ecosystem',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Endpoints', icon: 'solar:layers-bold' },
  { id: 'cinemas', label: 'Cinemas', icon: 'solar:ticket-bold' },
  { id: 'streaming', label: 'Streaming & Video', icon: 'solar:videocamera-record-bold' },
  { id: 'theatre', label: 'Stage & Theatre', icon: 'solar:mask-hamsa-bold' },
  { id: 'critics', label: 'Critics & Reviews', icon: 'solar:chat-round-bold' },
  { id: 'box_office', label: 'Box Office', icon: 'solar:dollar-bold' },
  { id: 'social', label: 'Social Studio', icon: 'solar:calendar-bold' },
  { id: 'ai', label: 'AI Maintenance', icon: 'solar:cpu-bolt-bold' },
  { id: 'alerts', label: 'Alerts & Outreach', icon: 'solar:chat-round-call-bold' },
  { id: 'master', label: 'Master Sync', icon: 'solar:play-circle-bold' },
];

function formatTimeAgo(isoString) {
  if (!isoString) return 'Never run';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = (sec % 60).toFixed(0);
  return `${min}m ${remSec}s`;
}

export default function AdminEndpoints() {
  const [logsMap, setLogsMap] = useState({});
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [runningTasks, setRunningTasks] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [activeLogModal, setActiveLogModal] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;

      // Group by source keeping the most recent
      const map = {};
      if (data && data.length > 0) {
        for (const log of data) {
          const src = log.source;
          if (src && !map[src]) {
            map[src] = log;
          }
        }
      }
      setLogsMap(map);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('[AdminEndpoints] Failed to load sync logs:', err);
      toast.error('Failed to load recent logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleTrigger = async (endpoint) => {
    if (!endpoint.triggerable) {
      toast.error('This task runs via background worker or GitHub Actions');
      return;
    }

    setRunningTasks((prev) => new Set(prev).add(endpoint.id));
    toast.loading(`Triggering ${endpoint.name}...`, { id: endpoint.id });

    const startTime = Date.now();
    try {
      const res = await fetch(endpoint.route, {
        method: endpoint.method || 'POST',
        headers: await authHeaders(),
      });

      const responseText = await res.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText };
      }

      const elapsed = Date.now() - startTime;

      if (!res.ok) {
        throw new Error(responseData?.error || responseData?.message || `HTTP ${res.status}`);
      }

      toast.success(`${endpoint.name} completed successfully (${(elapsed / 1000).toFixed(1)}s)!`, {
        id: endpoint.id,
      });

      // Show execution details in modal
      setActiveLogModal({
        endpoint,
        status: 'success',
        duration_ms: elapsed,
        data: responseData,
        timestamp: new Date().toISOString(),
      });

      // Refresh logs to capture the recorded entry
      fetchLogs();
    } catch (err) {
      const isFailedFetch = err.message === 'Failed to fetch';
      const errorMessage = isFailedFetch
        ? 'Network or edge proxy timeout. For intensive sync tasks, the operation continues running in the background on the server. Please check the Sync Logs below or refresh in a moment.'
        : err.message;

      toast.error(`Error running ${endpoint.name}: ${isFailedFetch ? 'Proxy timeout (check logs below)' : err.message}`, { id: endpoint.id });
      setActiveLogModal({
        endpoint,
        status: 'error',
        duration_ms: Date.now() - startTime,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        data: isFailedFetch
          ? {
              status: 'edge_proxy_timeout_or_network_disconnect',
              note: 'The browser or edge proxy closed the connection while the background worker continued processing on the server. Look for recorded outcomes in the Sync Logs section.',
              route: endpoint.route,
            }
          : {},
      });
      fetchLogs();
    } finally {
      setRunningTasks((prev) => {
        const next = new Set(prev);
        next.delete(endpoint.id);
        return next;
      });
    }
  };

  const triggerMasterSync = async () => {
    const masterEndpoint = ENDPOINTS_CATALOG.find((e) => e.id === 'master');
    if (masterEndpoint) {
      handleTrigger(masterEndpoint);
    }
  };

  // Filter and search endpoints
  const filteredEndpoints = useMemo(() => {
    return ENDPOINTS_CATALOG.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Status filter
      const log = logsMap[item.logSource];
      if (selectedStatusFilter === 'success' && log?.status !== 'success') return false;
      if (selectedStatusFilter === 'error' && log?.status !== 'error') return false;
      if (selectedStatusFilter === 'never' && log) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesRoute = item.route.toLowerCase().includes(q);
        const matchesCat = item.categoryLabel.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesRoute && !matchesCat) return false;
      }

      return true;
    });
  }, [selectedCategory, selectedStatusFilter, searchQuery, logsMap]);

  // Aggregate stats
  const stats = useMemo(() => {
    let successCount = 0;
    let errorCount = 0;
    let neverCount = 0;

    for (const ep of ENDPOINTS_CATALOG) {
      const log = logsMap[ep.logSource];
      if (!log) neverCount++;
      else if (log.status === 'success') successCount++;
      else if (log.status === 'error') errorCount++;
    }

    return {
      total: ENDPOINTS_CATALOG.length,
      successCount,
      errorCount,
      neverCount,
      runningCount: runningTasks.size,
    };
  }, [logsMap, runningTasks]);

  return (
    <div className="space-y-6 pb-20">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Icon icon="solar:server-square-bold" className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-text-primary md:text-3xl">
                System Endpoints & Data Sync
              </h1>
              <p className="text-xs text-text-muted md:text-sm">
                Control panel for cinema showtimes, streaming platforms, stage plays, critics, box office & maintenance pipelines.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Refresh & Run Master */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-xs font-bold text-text-primary transition-all hover:bg-surface-2 active:scale-95 disabled:opacity-50"
            title="Refresh sync statuses"
          >
            <Icon icon="solar:refresh-bold" className={`text-base ${loadingLogs ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={triggerMasterSync}
            disabled={runningTasks.has('master')}
            className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50"
          >
            <Icon
              icon={runningTasks.has('master') ? 'solar:refresh-circle-bold' : 'solar:play-bold'}
              className={`text-base ${runningTasks.has('master') ? 'animate-spin' : ''}`}
            />
            <span>Run Master Sync</span>
          </button>
        </div>
      </div>

      {/* ── METRICS OVERVIEW CARDS (TOUCH-RESPONSIVE) ────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Endpoints</span>
            <Icon icon="solar:database-bold" className="text-lg text-brand" />
          </div>
          <div className="mt-2 text-2xl font-black text-text-primary">{stats.total}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">Across 8 core systems</div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Healthy / Success</span>
            <Icon icon="solar:check-circle-bold" className="text-lg text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">{stats.successCount}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">Last runs verified</div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Attention / Errors</span>
            <Icon icon="solar:danger-triangle-bold" className="text-lg text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-500">{stats.errorCount}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">Failed or timeout</div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active / Running</span>
            <Icon icon="solar:refresh-circle-bold" className="text-lg text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">{stats.runningCount}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">Currently executing</div>
        </div>
      </div>

      {/* ── SEARCH & CATEGORY FILTER TABS (MOBILE HORIZONTAL SCROLL) ─────────── */}
      <div className="space-y-3">
        {/* Search input */}
        <div className="relative">
          <Icon
            icon="solar:magnifer-linear"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search endpoints, platforms, descriptions (e.g. showtimes, netflix, cohere)..."
            className="h-12 w-full rounded-2xl border border-border bg-surface pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <Icon icon="solar:close-circle-bold" className="text-lg" />
            </button>
          )}
        </div>

        {/* Category Pills — Horizontally scrollable on mobile */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 pt-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count =
              cat.id === 'all'
                ? ENDPOINTS_CATALOG.length
                : ENDPOINTS_CATALOG.filter((e) => e.category === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-brand text-white shadow-sm shadow-brand/20'
                    : 'border border-border bg-surface text-text-muted hover:border-brand/40 hover:text-text-primary'
                }`}
              >
                <Icon icon={cat.icon} className="text-sm" />
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Status:</span>
          {['all', 'success', 'error', 'never'].map((statusKey) => (
            <button
              key={statusKey}
              onClick={() => setSelectedStatusFilter(statusKey)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
                selectedStatusFilter === statusKey
                  ? 'bg-surface-2 text-brand ring-1 ring-brand/30'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {statusKey === 'all'
                ? 'All'
                : statusKey === 'success'
                ? 'Success'
                : statusKey === 'error'
                ? 'Errors'
                : 'Never Run'}
            </button>
          ))}
        </div>
      </div>

      {/* ── ENDPOINT CARDS GRID ──────────────────────────────────────────────── */}
      {filteredEndpoints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
          <Icon icon="solar:ghost-bold" className="mx-auto text-4xl text-text-muted" />
          <h3 className="mt-3 text-base font-bold text-text-primary">No endpoints found</h3>
          <p className="mt-1 text-xs text-text-muted">
            Try adjusting your search query or switching to another category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEndpoints.map((ep) => {
            const isRunning = runningTasks.has(ep.id);
            const log = logsMap[ep.logSource];
            const hasError = log?.status === 'error';
            const isSuccess = log?.status === 'success';

            return (
              <div
                key={ep.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-brand/40 hover:shadow-md"
              >
                <div>
                  {/* Card Header: Category & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-brand">
                        <Icon icon={ep.categoryIcon} className="text-xl" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                          {ep.categoryLabel}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isRunning
                                ? 'animate-ping bg-amber-500'
                                : isSuccess
                                ? 'bg-emerald-500'
                                : hasError
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              isRunning
                                ? 'text-amber-500'
                                : isSuccess
                                ? 'text-emerald-500'
                                : hasError
                                ? 'text-rose-500'
                                : 'text-text-muted'
                            }`}
                          >
                            {isRunning
                              ? 'Running now...'
                              : isSuccess
                              ? 'Healthy / Ready'
                              : hasError
                              ? 'Failed last run'
                              : 'Not run yet'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Badge */}
                    <div className="rounded-lg bg-surface-2 px-2 py-1 text-[10px] font-bold text-text-muted" title={ep.schedule}>
                      <Icon icon="solar:clock-circle-linear" className="mr-1 inline text-xs" />
                      {ep.schedule.includes('Every') || ep.schedule.includes('Daily')
                        ? ep.schedule.split('(')[0].trim()
                        : ep.schedule}
                    </div>
                  </div>

                  {/* Title & Route */}
                  <div className="mt-3.5">
                    <h3 className="text-base font-bold text-text-primary group-hover:text-brand transition-colors">
                      {ep.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5">
                      <code className="rounded bg-surface-2 px-2 py-0.5 text-[11px] font-mono text-text-muted">
                        {ep.route.split(' ')[0]}
                      </code>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mt-2.5 text-xs leading-relaxed text-text-muted line-clamp-3">
                    {ep.description}
                  </p>

                  {/* Error Callout if last run failed */}
                  {hasError && log?.message && (
                    <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs text-rose-500">
                      <div className="flex items-start gap-1.5 font-bold">
                        <Icon icon="solar:danger-triangle-bold" className="mt-0.5 flex-shrink-0 text-sm" />
                        <span className="truncate">{log.message}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer: Last run metadata & Action Button */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <div className="flex items-center gap-1.5" title={log?.created_at ? new Date(log.created_at).toLocaleString() : ''}>
                      <Icon icon="solar:history-bold" />
                      <span>Last run: <strong className="text-text-primary">{formatTimeAgo(log?.created_at)}</strong></span>
                    </div>

                    {log?.duration_ms != null && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                        ⚡ {formatDuration(log.duration_ms)}
                      </span>
                    )}
                  </div>

                  {log?.items_processed != null && log.items_processed > 0 && (
                    <div className="mt-1 text-[10px] text-text-muted">
                      Processed: <strong className="text-text-primary">+{log.items_processed} items</strong>
                      {log.items_updated ? ` (${log.items_updated} updated)` : ''}
                    </div>
                  )}

                  {/* Action Buttons: Run & Logs */}
                  <div className="mt-3.5 flex items-center gap-2">
                    {ep.triggerable ? (
                      <button
                        onClick={() => handleTrigger(ep)}
                        disabled={isRunning}
                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-xs font-bold text-white shadow-sm transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50"
                      >
                        <Icon
                          icon={isRunning ? 'solar:refresh-circle-bold' : 'solar:play-bold'}
                          className={`text-base ${isRunning ? 'animate-spin' : ''}`}
                        />
                        <span>{isRunning ? 'Running...' : 'Run Now'}</span>
                      </button>
                    ) : (
                      <div className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-2 text-xs font-bold text-text-muted">
                        <Icon icon="solar:lock-keyhole-minimalistic-bold" className="text-sm" />
                        <span>Worker Only</span>
                      </div>
                    )}

                    {log && (
                      <button
                        onClick={() =>
                          setActiveLogModal({
                            endpoint: ep,
                            status: log.status,
                            duration_ms: log.duration_ms,
                            data: log.details || { message: log.message },
                            timestamp: log.created_at,
                          })
                        }
                        className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-bold text-text-primary transition-all hover:bg-surface-2 active:scale-95"
                        title="View Execution Log"
                      >
                        <Icon icon="solar:document-text-bold" className="text-base text-text-muted" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── EXECUTION / LOG MODAL DRAWER (MOBILE-FRIENDLY BOTTOM SHEET) ──────── */}
      {activeLogModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div
            className="w-full max-w-2xl rounded-t-3xl border border-border bg-surface p-6 shadow-2xl animate-in slide-in-from-bottom sm:rounded-2xl"
            style={{ maxHeight: '88vh' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    activeLogModal.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  <Icon
                    icon={activeLogModal.status === 'success' ? 'solar:check-circle-bold' : 'solar:danger-triangle-bold'}
                    className="text-2xl"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {activeLogModal.endpoint?.name || 'Execution Result'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>{new Date(activeLogModal.timestamp).toLocaleTimeString()}</span>
                    <span>·</span>
                    <span>Duration: {formatDuration(activeLogModal.duration_ms)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveLogModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-text-muted hover:text-text-primary"
              >
                <Icon icon="solar:close-circle-bold" className="text-xl" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-4 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 'calc(88vh - 160px)' }}>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Endpoint Route</span>
                <div className="mt-1 rounded-xl bg-surface-2 p-2.5 font-mono text-xs text-text-primary">
                  {activeLogModal.endpoint?.route}
                </div>
              </div>

              {activeLogModal.error && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Error Message</span>
                  <div className="mt-1 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500">
                    {activeLogModal.error}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Response Payload</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(activeLogModal.data || {}, null, 2));
                      toast.success('JSON copied to clipboard!');
                    }}
                    className="text-[11px] font-bold text-brand hover:underline"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="no-scrollbar mt-1 overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text-primary">
                  {JSON.stringify(activeLogModal.data || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 border-t border-border pt-4">
              <button
                onClick={() => setActiveLogModal(null)}
                className="h-11 w-full rounded-xl bg-surface-2 text-xs font-bold text-text-primary hover:bg-surface-3 transition-colors"
              >
                Close Output
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
