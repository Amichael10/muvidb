import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import * as fs from 'fs';
import * as path from 'path';

interface WpPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  tags: number[];
}

async function harvestAndCacheFilmEfiko() {
  console.log("=== HARVESTING AND CACHING FILMEFIKO POSTS ===");

  const dataDir = path.join(process.cwd(), 'scripts', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const cacheFile = path.join(dataDir, 'filmefiko_posts.json');
  let allPosts: WpPost[] = [];
  if (fs.existsSync(cacheFile)) {
    try {
      allPosts = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      console.log(`Loaded ${allPosts.length} existing posts from cache.`);
    } catch {}
  }

  const seenIds = new Set(allPosts.map(p => p.id));
  let page = 1;
  const perPage = 20;
  let consecutiveErrors = 0;

  while (page <= 25 && consecutiveErrors < 4) {
    try {
      console.log(`Fetching page ${page}...`);
      const res = await fetch(`https://filmefiko.com/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        console.warn(`HTTP ${res.status} on page ${page}`);
        if (res.status === 400 || res.status === 404) {
          console.log("Reached end of archive.");
          break;
        }
        consecutiveErrors++;
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }

      const posts: WpPost[] = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) {
        break;
      }

      consecutiveErrors = 0;
      let newCount = 0;
      for (const p of posts) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allPosts.push(p);
          newCount++;
        }
      }

      console.log(`Page ${page}: got ${posts.length} posts (+${newCount} new, total: ${allPosts.length})`);
      
      // Save cache incrementally
      fs.writeFileSync(cacheFile, JSON.stringify(allPosts, null, 2), 'utf-8');

      page++;
      await new Promise(r => setTimeout(r, 800));
    } catch (err: any) {
      console.warn(`Fetch error on page ${page}:`, err.message);
      consecutiveErrors++;
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  console.log(`\n🎉 Total Film Efiko posts cached in ${cacheFile}: ${allPosts.length}`);
}

harvestAndCacheFilmEfiko().catch(console.error);
