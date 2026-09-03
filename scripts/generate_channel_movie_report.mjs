import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function generateChannelReport() {
  console.log('Fetching channels...');
  
  // 1. Fetch all channels
  let allChannels = [];
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('channels')
      .select('id, name, channel_handle, category, country, subscriber_count, channel_id, is_featured')
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    allChannels.push(...data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  console.log(`Loaded ${allChannels.length} channels.`);

  // 2. Fetch channel_videos with film_id
  console.log('Fetching channel_videos linking to films...');
  let channelVideoCounts = new Map(); // channel_id -> Set of distinct film_ids
  let channelTotalVideos = new Map(); // channel_id -> total videos

  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('channel_videos')
      .select('channel_id, film_id, video_id')
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    for (const row of data) {
      // count total videos
      channelTotalVideos.set(row.channel_id, (channelTotalVideos.get(row.channel_id) || 0) + 1);
      
      // count movies (film_id is not null)
      if (row.film_id) {
        if (!channelVideoCounts.has(row.channel_id)) {
          channelVideoCounts.set(row.channel_id, new Set());
        }
        channelVideoCounts.get(row.channel_id).add(row.film_id);
      }
    }
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  console.log(`Processed all channel_videos rows.`);

  // 3. Aggregate data per channel
  const channelReport = allChannels.map(c => {
    const movieCount = channelVideoCounts.get(c.id)?.size || 0;
    const totalVideos = channelTotalVideos.get(c.id) || 0;
    return {
      id: c.id,
      name: c.name || 'Unnamed Channel',
      handle: c.channel_handle || '-',
      country: c.country || 'Nigeria',
      category: c.category || '-',
      subscribers: c.subscriber_count || 0,
      movie_count: movieCount,
      total_videos_synced: totalVideos
    };
  });

  // Sort by movie_count descending, then total_videos_synced
  channelReport.sort((a, b) => b.movie_count - a.movie_count || b.total_videos_synced - a.total_videos_synced);

  // Channels with at least 1 movie
  const channelsWithMovies = channelReport.filter(c => c.movie_count > 0);
  const channelsWithZeroMovies = channelReport.filter(c => c.movie_count === 0);

  console.log(`\n======================================================`);
  console.log(`Total Channels in DB:        ${channelReport.length}`);
  console.log(`Channels with Movies:        ${channelsWithMovies.length}`);
  console.log(`Channels with 0 Movies:      ${channelsWithZeroMovies.length}`);
  console.log(`Total Linked Movies in DB:   ${Array.from(channelVideoCounts.values()).reduce((sum, s) => sum + s.size, 0)}`);
  console.log(`======================================================\n`);

  // Write full JSON and CSV for reference
  fs.writeFileSync('scripts/channel_movie_counts.json', JSON.stringify(channelReport, null, 2));

  // Top 50 channels preview in console
  console.log('Top 30 Channels by Movie Count:');
  console.table(channelsWithMovies.slice(0, 30).map((c, idx) => ({
    Rank: idx + 1,
    Name: c.name,
    Handle: c.handle,
    Movies: c.movie_count,
    TotalVideos: c.total_videos_synced,
    Country: c.country
  })));
}

generateChannelReport().catch(console.error);
