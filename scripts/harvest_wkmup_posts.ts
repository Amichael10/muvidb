import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OUTPUT_FILE = path.join(process.cwd(), 'scripts', 'data', 'wkmup_posts.json');

function fetchWithRetry(url: string, retries = 3): string | null {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const cmd = `curl.exe -s --max-time 30 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" "${url}"`;
      const output = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf-8' });
      if (output && output.trim().length > 0) {
        return output;
      }
    } catch (e: any) {
      console.warn(`  [Retry ${attempt}/${retries}] Fetch failed for ${url}`);
      execSync('timeout /t 2 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 3 >nul');
    }
  }
  return null;
}

async function main() {
  console.log('🚀 Starting Robust What Kept Me Up posts harvester...');

  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing posts if present
  let allPosts: any[] = [];
  const seenIds = new Set<number>();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      allPosts = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      for (const p of allPosts) seenIds.add(p.id);
      console.log(`Loaded ${allPosts.length} existing posts.`);
    } catch (e) {}
  }

  const categories = [33, 3137];

  for (const cat of categories) {
    console.log(`\n📂 Fetching category ${cat}...`);
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://whatkeptmeup.com/wp-json/wp/v2/posts?categories=${cat}&per_page=50&page=${page}`;
      console.log(`Fetching Cat ${cat} Page ${page}...`);

      const output = fetchWithRetry(url);
      if (!output || output.startsWith('<html') || output.includes('"code":"rest_post_invalid_page_number"')) {
        console.log(`Reached end of category ${cat} at page ${page}`);
        break;
      }

      let posts: any[] = [];
      try {
        posts = JSON.parse(output);
      } catch (err) {
        console.error(`Failed to parse JSON for page ${page}`);
        break;
      }

      if (!Array.isArray(posts) || posts.length === 0) {
        console.log(`No more posts for category ${cat}`);
        break;
      }

      let newCount = 0;
      for (const post of posts) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id);
          allPosts.push({
            id: post.id,
            date: post.date,
            slug: post.slug,
            link: post.link,
            title: post.title?.rendered,
            excerpt: post.excerpt?.rendered,
            content: post.content?.rendered,
            categories: post.categories,
            tags: post.tags
          });
          newCount++;
        }
      }

      console.log(`  -> Cat ${cat} Page ${page}: fetched ${posts.length} posts (${newCount} new). Total accumulated: ${allPosts.length}`);

      if (posts.length < 50) {
        break;
      }

      page++;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`\n💾 Saving ${allPosts.length} posts to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPosts, null, 2), 'utf-8');
  console.log('✅ Complete!');
}

main().catch(console.error);
