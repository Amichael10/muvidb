import fs from 'fs';

const progress = JSON.parse(fs.readFileSync('unattached_films_resolved_progress.json', 'utf8'));
const timeouts = progress.filter((p: any) => p.status === 'timeout');

async function resolveRemaining() {
  console.log(`Resolving remaining ${timeouts.length} timeouts...`);
  let resolved = 0;
  let dead = 0;
  
  for (let i = 0; i < timeouts.length; i += 15) {
    const batch = timeouts.slice(i, i + 15);
    await Promise.all(batch.map(async (item: any) => {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(item.youtube_url)}&format=json`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          item.resolved_channel = (data.author_name || 'Unknown Channel').trim();
          item.resolved_channel_url = data.author_url || '';
          item.status = 'resolved';
          resolved++;
        } else {
          item.resolved_channel = 'Video Unavailable / Private';
          item.status = 'unavailable';
          dead++;
        }
      } catch (err) {
        item.resolved_channel = 'Video Unavailable / Private';
        item.status = 'unavailable';
        dead++;
      }
    }));
  }
  console.log(`Finished! Resolved: ${resolved}, Dead/Private: ${dead}`);
  fs.writeFileSync('unattached_films_resolved_progress.json', JSON.stringify(progress, null, 2));
}

resolveRemaining();
