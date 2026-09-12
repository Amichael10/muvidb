import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OUTPUT_FILE = path.join(process.cwd(), 'scripts', 'data', 'wkmup_posts.json');

function fetchWithRetry(url: string, retries = 3): string | null {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const cmd = `curl.exe -s --max-time 35 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" "${url}"`;
      const output = execSync(cmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf-8' });
      if (output && output.trim().length > 0 && !output.startsWith('<html')) {
        return output;
      }
    } catch (e: any) {
      console.warn(`  [Retry ${attempt}/${retries}] Fetch failed for ${url}`);
      execSync('timeout /t 3 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 4 >nul');
    }
  }
  return null;
}

async function main() {
  console.log('🚀 Fetching remaining What Kept Me Up posts (Page 7+)...');

  let allPosts: any[] = [];
  const seenIds = new Set<number>();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      allPosts = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      for (const p of allPosts) seenIds.add(p.id);
      console.log(`Loaded ${allPosts.length} existing cached posts.`);
    } catch (e) {}
  }

  // Category 33 starting from page 7
  for (let page = 7; page <= 15; page++) {
    const url = `https://whatkeptmeup.com/wp-json/wp/v2/posts?categories=33&per_page=50&page=${page}`;
    console.log(`Fetching Cat 33 Page ${page}...`);

    const output = fetchWithRetry(url);
    if (!output || output.includes('"code":"rest_post_invalid_page_number"')) {
      console.log(`Reached end of category 33 at page ${page}`);
      break;
    }

    try {
      const posts = JSON.parse(output);
      if (!Array.isArray(posts) || posts.length === 0) {
        console.log(`No more posts for category 33 at page ${page}`);
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
      console.log(`  -> Cat 33 Page ${page}: fetched ${posts.length} posts (${newCount} new). Total: ${allPosts.length}`);
    } catch (e: any) {
      console.error(`Failed parsing page ${page}:`, e.message);
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // Category 3137 (Stage Plays)
  console.log('\n📂 Fetching Category 3137 (Stage Plays)...');
  const stageOutput = fetchWithRetry('https://whatkeptmeup.com/wp-json/wp/v2/posts?categories=3137&per_page=50&page=1');
  if (stageOutput && !stageOutput.includes('"code":"rest_post_invalid_page_number"')) {
    try {
      const stagePosts = JSON.parse(stageOutput);
      if (Array.isArray(stagePosts)) {
        for (const post of stagePosts) {
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
          }
        }
      }
    } catch (e) {}
  }

  console.log(`\n💾 Saving updated ${allPosts.length} posts to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPosts, null, 2), 'utf-8');
  console.log('✅ Harvesting complete!');
}

main().catch(console.error);
