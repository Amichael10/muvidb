import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

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

async function fetchAllFilmEfikoArticles() {
  console.log("=== HARVESTING FILMEFIKO POSTS BY PAGINATION ===");
  
  const allPosts: WpPost[] = [];
  let page = 1;
  const perPage = 20;
  let hasMore = true;

  while (hasMore && page <= 30) {
    try {
      console.log(`Fetching page ${page}...`);
      const res = await fetch(`https://filmefiko.com/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 404) {
          console.log(`Reached end of posts at page ${page}`);
          hasMore = false;
          break;
        }
        console.warn(`HTTP ${res.status} on page ${page}, retrying once in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const posts: WpPost[] = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) {
        hasMore = false;
        break;
      }

      allPosts.push(...posts);
      console.log(`Page ${page}: got ${posts.length} posts (Total so far: ${allPosts.length})`);
      
      const totalPages = Number(res.headers.get('x-wp-totalpages') || '0');
      if (totalPages && page >= totalPages) {
        hasMore = false;
        break;
      }

      page++;
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.warn(`Error on page ${page}:`, err.message);
      await new Promise(r => setTimeout(r, 3000));
      page++;
    }
  }

  console.log(`\n🎉 Total Film Efiko articles harvested: ${allPosts.length}`);

  // Inspect reviews & theatre/stage play articles
  const reviews: WpPost[] = [];
  const stagePlayArticles: WpPost[] = [];

  for (const p of allPosts) {
    const title = p.title.rendered.toLowerCase();
    const content = p.content.rendered.toLowerCase();
    const isReview = p.categories.includes(66) || /review|critique|verdict/i.test(title);
    const isStage = /stage play|theatre|theater|muson|terra kulture|broadway|musical|stage adaptation/i.test(title) || /stage play|theatre|theater/i.test(content);

    if (isReview) reviews.push(p);
    if (isStage) stagePlayArticles.push(p);
  }

  console.log(`\n--- REVIEW ARTICLES FOUND: ${reviews.length} ---`);
  for (const r of reviews) {
    console.log(`⭐ [${r.date.slice(0, 10)}] ${r.title.rendered} (${r.link})`);
  }

  console.log(`\n--- STAGE & THEATRE ARTICLES FOUND: ${stagePlayArticles.length} ---`);
  for (const s of stagePlayArticles) {
    console.log(`🎭 [${s.date.slice(0, 10)}] ${s.title.rendered} (${s.link})`);
  }
}

fetchAllFilmEfikoArticles().catch(console.error);
