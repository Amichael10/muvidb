import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { trackSeoHit } from './_lib/scrape_guard.js';

const WATCH_NAMES: Record<string, string> = {
  netflix: 'Netflix',
  prime_video: 'Prime Video',
  youtube: 'YouTube',
  showmax: 'Showmax',
  kava: 'Kava',
  docuth: 'Docuth',
  cinema: 'In Cinemas',
};

function escapeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isValidImageUrl(url: unknown): boolean {
  if (!url) return false;
  const str = String(url).trim();
  if (!str || str === 'null' || str === 'undefined' || str === 'none') return false;
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function withRetry<T>(fn: () => Promise<{ data: T | null; error: any }>, retries = 3, delayMs = 300): Promise<T> {
  let lastError: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (!res.error && res.data !== null && res.data !== undefined) {
        return res.data;
      }
      lastError = res.error || new Error('Query returned empty/null data');
    } catch (err) {
      lastError = err;
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError || new Error('Database query failed after retries');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, slug } = req.query;
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    if (type === 'sitemap') {
      const target = String(slug || 'index').replace(/\.xml$/, '').toLowerCase();
      trackSeoHit(req, 'sitemap', target);

      const urlset = (entries: string, withImages = false) => {
        const imageNs = withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
        return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>\n${entries}\n</urlset>`;
      };

      const setSuccessHeaders = () => {
        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      };

      // Helper for batched pagination (bypasses PostgREST 1000-row cap per request)
      const fetchPagedFilms = async (fromOffset: number, count: number) => {
        const BATCH_SIZE = 1000;
        const numBatches = Math.ceil(count / BATCH_SIZE);
        const promises = [];
        for (let i = 0; i < numBatches; i++) {
          const start = fromOffset + i * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE - 1, fromOffset + count - 1);
          promises.push(
            withRetry(async () => {
              return await supabase
                .from('films')
                .select('id, title, slug, poster_url, updated_at, created_at')
                .eq('is_published', true)
                .order('updated_at', { ascending: false, nullsFirst: false })
                .range(start, end);
            })
          );
        }
        const results = await Promise.all(promises);
        return results.flat();
      };

      const fetchPagedPeople = async (fromOffset: number, count: number) => {
        const BATCH_SIZE = 1000;
        const numBatches = Math.ceil(count / BATCH_SIZE);
        const promises = [];
        for (let i = 0; i < numBatches; i++) {
          const start = fromOffset + i * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE - 1, fromOffset + count - 1);
          promises.push(
            withRetry(async () => {
              return await supabase
                .from('people')
                .select('id, name, slug, photo_url, updated_at, created_at')
                .gt('film_count', 0)
                .order('film_count', { ascending: false, nullsFirst: false })
                .range(start, end);
            })
          );
        }
        const results = await Promise.all(promises);
        return results.flat();
      };

      // 1. SITEMAP INDEX (/sitemap.xml)
      if (target === 'index') {
        const filmChunks = 8; // 8 chunks of 5000 = up to 40,000 films
        const peopleChunks = 7; // 7 chunks of 5000 = up to 35,000 indexable people

        const maps: string[] = ['static'];
        for (let i = 1; i <= filmChunks; i++) maps.push(`films-${i}`);
        for (let i = 1; i <= peopleChunks; i++) maps.push(`people-${i}`);
        maps.push(
          'watch',
          'companies',
          'cinemas',
          'channels',
          'critics',
          'plays',
          'careers',
          'awards',
          'tvshows'
        );

        const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${maps.map((m) => `  <sitemap>\n    <loc>${baseUrl}/sitemap-${m}.xml</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n  </sitemap>`).join('\n')}
</sitemapindex>`;
        setSuccessHeaders();
        return res.status(200).send(sitemapIndex);
      }

      // 2. STATIC PAGES (/sitemap-static.xml) — Every page & feature on MubiDB
      if (target === 'static') {
        const staticPages: { url: string; priority: string; changefreq: string }[] = [
          // Core discovery pages
          { url: '', priority: '1.0', changefreq: 'daily' },
          { url: '/browse', priority: '0.9', changefreq: 'daily' },
          { url: '/search', priority: '0.9', changefreq: 'daily' },
          { url: '/tv-shows', priority: '0.8', changefreq: 'daily' },
          // People & cast
          { url: '/people', priority: '0.9', changefreq: 'daily' },
          { url: '/critics', priority: '0.8', changefreq: 'daily' },
          // Venues & showtimes
          { url: '/cinemas', priority: '0.8', changefreq: 'daily' },
          { url: '/showtimes', priority: '0.8', changefreq: 'daily' },
          // Industry
          { url: '/channels', priority: '0.8', changefreq: 'daily' },
          { url: '/companies', priority: '0.8', changefreq: 'daily' },
          // Entertainment features
          { url: '/plays', priority: '0.8', changefreq: 'daily' },
          { url: '/awards', priority: '0.8', changefreq: 'weekly' },
          // Streaming
          { url: '/watch', priority: '0.8', changefreq: 'daily' },
          { url: '/watch/netflix', priority: '0.7', changefreq: 'daily' },
          { url: '/watch/prime_video', priority: '0.7', changefreq: 'daily' },
          { url: '/watch/showmax', priority: '0.7', changefreq: 'daily' },
          { url: '/watch/youtube', priority: '0.7', changefreq: 'daily' },
          { url: '/watch/kava', priority: '0.7', changefreq: 'daily' },
          { url: '/watch/docuth', priority: '0.7', changefreq: 'daily' },
          { url: '/watch/cinema', priority: '0.7', changefreq: 'daily' },
          // Submissions & user actions
          { url: '/submit', priority: '0.7', changefreq: 'weekly' },
          { url: '/submit/film', priority: '0.6', changefreq: 'weekly' },
          { url: '/submit/person', priority: '0.6', changefreq: 'weekly' },
          { url: '/submit/company', priority: '0.6', changefreq: 'weekly' },
          { url: '/classification', priority: '0.7', changefreq: 'monthly' },
          // Careers
          { url: '/careers', priority: '0.7', changefreq: 'weekly' },
          // Info pages
          { url: '/about', priority: '0.6', changefreq: 'monthly' },
          { url: '/contact', priority: '0.6', changefreq: 'monthly' },
          { url: '/waitlist', priority: '0.5', changefreq: 'monthly' },
          { url: '/terms', priority: '0.3', changefreq: 'monthly' },
          { url: '/privacy', priority: '0.3', changefreq: 'monthly' },
        ];
        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            staticPages
              .map(
                (page) => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 3. FILMS SITEMAP (/sitemap-films.xml or /sitemap-films-1.xml .. films-8.xml)
      if (target === 'films' || target.startsWith('films-')) {
        const page = target === 'films' ? 1 : Math.max(1, parseInt(target.replace('films-', ''), 10) || 1);
        const CHUNK_SIZE = 5000;
        const fromOffset = (page - 1) * CHUNK_SIZE;
        const data = await fetchPagedFilms(fromOffset, CHUNK_SIZE);

        const filmUrls = (data || []).map((f: any) => {
          const loc = `${baseUrl}/films/${f.slug || f.id}`;
          const lastmod = f.updated_at || f.created_at ? new Date(f.updated_at || f.created_at).toISOString() : new Date().toISOString();
          const imageTag = isValidImageUrl(f.poster_url)
            ? `\n    <image:image>\n      <image:loc>${escapeXml(String(f.poster_url).trim())}</image:loc>\n      <image:title>${escapeXml(f.title)} Poster</image:title>\n    </image:image>`
            : '';
          return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>${imageTag}\n  </url>`;
        });

        setSuccessHeaders();
        return res.status(200).send(urlset(filmUrls.join('\n'), true));
      }

      // 4. PEOPLE / ACTORS SITEMAP (/sitemap-people.xml or /sitemap-people-1.xml .. people-7.xml)
      if (target === 'people' || target.startsWith('people-')) {
        const page = target === 'people' ? 1 : Math.max(1, parseInt(target.replace('people-', ''), 10) || 1);
        const CHUNK_SIZE = 5000;
        const fromOffset = (page - 1) * CHUNK_SIZE;
        const data = await fetchPagedPeople(fromOffset, CHUNK_SIZE);

        const personUrls = (data || []).map((p: any) => {
          const loc = `${baseUrl}/people/${p.slug || p.id}`;
          const lastmod = p.updated_at || p.created_at ? new Date(p.updated_at || p.created_at).toISOString() : new Date().toISOString();
          const imageTag = isValidImageUrl(p.photo_url)
            ? `\n    <image:image>\n      <image:loc>${escapeXml(String(p.photo_url).trim())}</image:loc>\n      <image:title>${escapeXml(p.name)} Photo</image:title>\n    </image:image>`
            : '';
          return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>${imageTag}\n  </url>`;
        });

        setSuccessHeaders();
        return res.status(200).send(urlset(personUrls.join('\n'), true));
      }

      // 5. COMPANIES SITEMAP (/sitemap-companies.xml)
      if (target === 'companies') {
        const data = await withRetry(async () => {
          return await supabase
            .from('companies')
            .select('id, name, slug, updated_at')
            .limit(50000);
        });

        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            (data || [])
              .map(
                (c: any) => `  <url>
    <loc>${baseUrl}/companies/${c.slug || c.id}</loc>
    ${c.updated_at ? `<lastmod>${new Date(c.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 6. CINEMAS SITEMAP (/sitemap-cinemas.xml)
      if (target === 'cinemas') {
        const data = await withRetry(async () => {
          return await supabase
            .from('cinemas')
            .select('id, name, created_at, showtimes_last_fetched_at')
            .eq('is_active', true)
            .limit(50000);
        });

        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            (data || [])
              .map(
                (c: any) => `  <url>
    <loc>${baseUrl}/cinemas/${c.id}</loc>
    ${c.showtimes_last_fetched_at || c.created_at ? `<lastmod>${new Date(c.showtimes_last_fetched_at || c.created_at).toISOString()}</lastmod>` : ''}
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 7. CHANNELS SITEMAP (/sitemap-channels.xml)
      if (target === 'channels') {
        const data = await withRetry(async () => {
          return await supabase
            .from('channels')
            .select('id, name, slug, created_at, videos_last_fetched_at')
            .limit(50000);
        });

        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            (data || [])
              .map(
                (c: any) => `  <url>
    <loc>${baseUrl}/channels/${c.slug || c.id}</loc>
    ${c.videos_last_fetched_at || c.created_at ? `<lastmod>${new Date(c.videos_last_fetched_at || c.created_at).toISOString()}</lastmod>` : ''}
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 8. CRITICS SITEMAP (/sitemap-critics.xml)
      if (target === 'critics') {
        const data = await withRetry(async () => {
          return await supabase
            .from('critics')
            .select('id, name, slug, updated_at')
            .limit(50000);
        });

        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            (data || [])
              .map(
                (c: any) => `  <url>
    <loc>${baseUrl}/critics/${c.slug || c.id}</loc>
    ${c.updated_at ? `<lastmod>${new Date(c.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 9. THEATRE PLAYS SITEMAP (/sitemap-plays.xml)
      if (target === 'plays') {
        const data = await withRetry(async () => {
          return await supabase
            .from('plays')
            .select('id, title, slug, updated_at')
            .limit(50000);
        });

        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            (data || [])
              .map(
                (p: any) => `  <url>
    <loc>${baseUrl}/plays/${p.slug || p.id}</loc>
    ${p.updated_at ? `<lastmod>${new Date(p.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 10. CAREERS SITEMAP (/sitemap-careers.xml)
      if (target === 'careers') {
        let items: any[] = [];
        try {
          const data = await withRetry(async () => {
            return await supabase.from('job_postings').select('id, slug, published_at, updated_at').limit(50000);
          });
          items = data || [];
        } catch {
          items = [];
        }
        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            items
              .map(
                (j: any) => `  <url>
    <loc>${baseUrl}/careers/${j.slug || j.id}</loc>
    ${j.updated_at || j.published_at ? `<lastmod>${new Date(j.updated_at || j.published_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 11. WATCH PLATFORMS SITEMAP (/sitemap-watch.xml)
      if (target === 'watch') {
        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            Object.keys(WATCH_NAMES)
              .map(
                (p) => `  <url>
    <loc>${baseUrl}/watch/${p}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 12. AWARDS SITEMAP (/sitemap-awards.xml) — awards hub + individual award programme pages
      if (target === 'awards') {
        const awardPages = [
          { url: '/awards', priority: '0.8', changefreq: 'weekly' },
          { url: '/awards/amvca', priority: '0.8', changefreq: 'weekly' },
          { url: '/awards/amaa', priority: '0.8', changefreq: 'weekly' },
          { url: '/awards/tinff', priority: '0.7', changefreq: 'monthly' },
          { url: '/awards/golden-stars', priority: '0.7', changefreq: 'monthly' },
          { url: '/awards/afriff', priority: '0.7', changefreq: 'monthly' },
        ];
        setSuccessHeaders();
        return res.status(200).send(
          urlset(
            awardPages
              .map(
                (p) => `  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 13. TV SHOWS SITEMAP (/sitemap-tvshows.xml)
      if (target === 'tvshows') {
        const data = await withRetry(async () => {
          return await supabase
            .from('films')
            .select('id, title, slug, poster_url, updated_at, created_at')
            .eq('content_type', 'series')
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(20000);
        });

        const tvUrls = (data || []).map((f: any) => {
          const loc = `${baseUrl}/films/${f.slug || f.id}`;
          const lastmod = f.updated_at || f.created_at ? new Date(f.updated_at || f.created_at).toISOString() : new Date().toISOString();
          const imageTag = isValidImageUrl(f.poster_url)
            ? `\n    <image:image>\n      <image:loc>${escapeXml(String(f.poster_url).trim())}</image:loc>\n      <image:title>${escapeXml(f.title)} Poster</image:title>\n    </image:image>`
            : '';
          return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>${imageTag}\n  </url>`;
        });

        setSuccessHeaders();
        return res.status(200).send(urlset(tvUrls.join('\n'), true));
      }

      return res.status(404).send('Sitemap not found');
    }

    return res.status(404).json({
      error: 'not_found',
      message: 'Sitemaps only.',
    });
  } catch (error: any) {
    console.error('SEO/Sitemap Error:', error);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-cache, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-cache, no-store');
    return res.status(500).send(`<!-- Sitemap generation error: ${escapeXml(error?.message || 'Database error')} -->`);
  }
}
