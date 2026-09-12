import * as cheerio from 'cheerio';

async function exploreFilmEfiko() {
  console.log("=== EXPLORING FILMEFIKO.COM ===");
  
  // 1. Check WordPress REST API
  try {
    const wpRes = await fetch('https://filmefiko.com/wp-json/wp/v2/posts?per_page=10&_embed');
    if (wpRes.ok) {
      const posts = await wpRes.json();
      console.log(`✅ WP REST API is OPEN! Fetched ${posts.length} posts.`);
      for (const p of posts) {
        console.log(`- [${p.date}] ${p.title.rendered} (${p.link})`);
      }

      // Check categories
      const catRes = await fetch('https://filmefiko.com/wp-json/wp/v2/categories?per_page=100');
      if (catRes.ok) {
        const cats = await catRes.json();
        console.log(`\nCategories found (${cats.length}):`);
        for (const c of cats) {
          console.log(`  ID: ${c.id} | Slug: ${c.slug} | Name: ${c.name} | Count: ${c.count}`);
        }
      }
      return;
    } else {
      console.log(`WP REST API returned status ${wpRes.status}`);
    }
  } catch (err) {
    console.log("WP API fetch error:", err);
  }

  // 2. Fallback to RSS or HTML
  try {
    const rssRes = await fetch('https://filmefiko.com/feed/');
    if (rssRes.ok) {
      const xml = await rssRes.text();
      console.log("RSS Feed fetched, length:", xml.length);
    }
  } catch (err) {
    console.log("RSS fetch error:", err);
  }
}

exploreFilmEfiko().catch(console.error);
