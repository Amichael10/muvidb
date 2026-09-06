import { supabase } from '../api/_lib/supabase.js';
import fs from 'fs';
import path from 'path';

async function resolveChannels() {
  console.log('Loading active channels and unattached films...');

  // 1. Fetch active channels
  const { data: channels, error: chErr } = await supabase
    .from('channels')
    .select('id, name, channel_handle, channel_url, channel_id');

  if (chErr) {
    console.error('Error fetching channels:', chErr);
    return;
  }

  const activeChannelNames = new Set((channels || []).map(c => (c.name || '').toLowerCase().trim()));
  const activeHandles = new Set((channels || []).map(c => (c.channel_handle || '').toLowerCase().trim().replace(/^@/, '')));
  console.log(`Loaded ${channels?.length || 0} active channels from DB.`);

  // 2. Load the unattached films
  if (!fs.existsSync('orphaned_films_report.json')) {
    console.error('orphaned_films_report.json not found.');
    return;
  }
  const films = JSON.parse(fs.readFileSync('orphaned_films_report.json', 'utf8'));
  console.log(`Resolving YouTube channels for ${films.length} movies...`);

  // 3. Check if we have partial progress saved
  const progressFile = 'unattached_films_resolved_progress.json';
  let resolvedMap = new Map();
  if (fs.existsSync(progressFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      prev.forEach(item => {
        if (item.id && item.status === 'resolved' || item.status === 'unavailable') {
          resolvedMap.set(item.id, item);
        }
      });
      console.log(`Loaded ${resolvedMap.size} previously resolved valid movies.`);
    } catch {}
  }

  async function fetchOembed(url: string, retries = 2): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const res = await fetch(oembedUrl, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (res.ok) {
          const data = await res.json();
          return {
            channelName: (data.author_name || 'Unknown Channel').trim(),
            channelUrl: data.author_url || '',
            status: 'resolved'
          };
        }
        if (res.status === 404 || res.status === 401 || res.status === 403) {
          return { channelName: 'Video Unavailable / Private', channelUrl: '', status: 'unavailable' };
        }
      } catch (err) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        }
      }
    }
    return { channelName: 'Unresolved / Timeout', channelUrl: '', status: 'timeout' };
  }

  const CONCURRENCY = 25;
  const allResolved: any[] = [];

  for (let i = 0; i < films.length; i += CONCURRENCY) {
    const batch = films.slice(i, i + CONCURRENCY);
    const batchPromises = batch.map(async (film: any) => {
      if (resolvedMap.has(film.id)) {
        return resolvedMap.get(film.id);
      }

      const res = await fetchOembed(film.youtube_url);
      const item = {
        ...film,
        resolved_channel: res.channelName,
        resolved_channel_url: res.channelUrl,
        status: res.status,
      };
      resolvedMap.set(film.id, item);
      return item;
    });

    const batchResults = await Promise.all(batchPromises);
    allResolved.push(...batchResults);

    if (allResolved.length % 250 === 0 || i + CONCURRENCY >= films.length) {
      fs.writeFileSync(progressFile, JSON.stringify(Array.from(resolvedMap.values()), null, 2));
      console.log(`Progress: ${allResolved.length} / ${films.length} movies (Resolved: ${resolvedMap.size})...`);
    }
  }

  // 4. Group by channel
  const channelGroups = new Map();
  for (const item of allResolved) {
    const cName = item.resolved_channel || 'Unknown Channel';
    const lower = cName.toLowerCase().trim();
    const handleMatch = item.resolved_channel_url ? item.resolved_channel_url.replace(/.*\/@/, '').toLowerCase().trim() : '';

    const isActive = activeChannelNames.has(lower) || (handleMatch && activeHandles.has(handleMatch));

    if (!channelGroups.has(cName)) {
      channelGroups.set(cName, {
        channel_name: cName,
        channel_url: item.resolved_channel_url || '',
        count: 0,
        is_active_in_db: isActive,
        sample_films: [],
      });
    }
    const group = channelGroups.get(cName);
    group.count++;
    if (group.sample_films.length < 5) {
      group.sample_films.push({ id: item.id, title: item.title, year: item.year, youtube_url: item.youtube_url });
    }
  }

  const sortedGroups = Array.from(channelGroups.values()).sort((a, b) => b.count - a.count);

  const report = {
    total_scanned: allResolved.length,
    total_unique_channels: sortedGroups.length,
    active_channel_groups_count: sortedGroups.filter(g => g.is_active_in_db).length,
    untracked_deleted_groups_count: sortedGroups.filter(g => !g.is_active_in_db).length,
    groups: sortedGroups,
  };

  fs.writeFileSync('unattached_films_channel_breakdown.json', JSON.stringify(report, null, 2));
  console.log('\n=== COMPLETED! Saved report to unattached_films_channel_breakdown.json ===');
}

resolveChannels();
