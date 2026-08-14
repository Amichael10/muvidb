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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, slug } = req.query;
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    if (type === 'sitemap') {
      trackSeoHit(req, 'sitemap', String(slug || 'index'));
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400');

      const urlset = (entries: string, withImages = false) => {
        const imageNs = withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
        return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>\n${entries}\n</urlset>`;
      };

      // 1. SITEMAP INDEX (/sitemap.xml)
      if (slug === 'index') {
        const maps = [
          'static',
          'films',
          'people',
          'watch',
          'companies',
          'cinemas',
          'channels',
          'critics',
          'plays',
          'careers',
          'awards',
          'tvshows',
        ];
        const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${maps.map((m) => `  <sitemap>\n    <loc>${baseUrl}/sitemap-${m}.xml</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n  </sitemap>`).join('\n')}
</sitemapindex>`;
        return res.status(200).send(sitemapIndex);
      }

      // 2. STATIC PAGES (/sitemap-static.xml) — Every page & feature on MubiDB
      if (slug === 'static') {
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

      // 3. FILMS SITEMAP (/sitemap-films.xml) — Includes Google Images extension
      if (slug === 'films') {
        const { data } = await supabase
          .from('films')
          .select('id, title, slug, poster_url, updated_at, created_at')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(50000);

        const filmUrls = (data || []).map((f: any) => {
          const loc = `${baseUrl}/films/${f.slug || f.id}`;
          const lastmod = f.updated_at || f.created_at ? new Date(f.updated_at || f.created_at).toISOString() : new Date().toISOString();
          const imageTag = isValidImageUrl(f.poster_url)
            ? `\n    <image:image>\n      <image:loc>${escapeXml(String(f.poster_url).trim())}</image:loc>\n      <image:title>${escapeXml(f.title)} Poster</image:title>\n    </image:image>`
            : '';
          return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>${imageTag}\n  </url>`;
        });

        return res.status(200).send(urlset(filmUrls.join('\n'), true));
      }

      // 4. PEOPLE / ACTORS SITEMAP (/sitemap-people.xml) — Unfiltered, all actors
      if (slug === 'people') {
        const { data } = await supabase
          .from('people')
          .select('id, name, slug, photo_url, updated_at, created_at')
          .order('film_count', { ascending: false, nullsFirst: false })
          .limit(50000);

        const personUrls = (data || []).map((p: any) => {
          const loc = `${baseUrl}/people/${p.slug || p.id}`;
          const lastmod = p.updated_at || p.created_at ? new Date(p.updated_at || p.created_at).toISOString() : new Date().toISOString();
          const imageTag = isValidImageUrl(p.photo_url)
            ? `\n    <image:image>\n      <image:loc>${escapeXml(String(p.photo_url).trim())}</image:loc>\n      <image:title>${escapeXml(p.name)} Photo</image:title>\n    </image:image>`
            : '';
          return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>${imageTag}\n  </url>`;
        });

        return res.status(200).send(urlset(personUrls.join('\n'), true));
      }

      // 5. COMPANIES SITEMAP (/sitemap-companies.xml)
      if (slug === 'companies') {
        const { data } = await supabase
          .from('companies')
          .select('id, name, slug, updated_at')
          .limit(50000);

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
      if (slug === 'cinemas') {
        const { data } = await supabase
          .from('cinemas')
          .select('id, name, slug, updated_at')
          .limit(50000);

        return res.status(200).send(
          urlset(
            (data || [])
              .map(
                (c: any) => `  <url>
    <loc>${baseUrl}/cinemas/${c.slug || c.id}</loc>
    ${c.updated_at ? `<lastmod>${new Date(c.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 7. CHANNELS SITEMAP (/sitemap-channels.xml)
      if (slug === 'channels') {
        const { data } = await supabase
          .from('channels')
          .select('id, name, slug, updated_at')
          .limit(50000);

        return res.status(200).send(
          urlset(
            (data || [])
              .map(
                (c: any) => `  <url>
    <loc>${baseUrl}/channels/${c.slug || c.id}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
              )
              .join('\n')
          )
        );
      }

      // 8. CRITICS SITEMAP (/sitemap-critics.xml)
      if (slug === 'critics') {
        const { data } = await supabase
          .from('critics')
          .select('id, name, slug, updated_at')
          .limit(50000);

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
      if (slug === 'plays') {
        const { data } = await supabase
          .from('plays')
          .select('id, title, slug, updated_at')
          .limit(50000);

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
      if (slug === 'careers') {
        let items: any[] = [];
        try {
          const { data } = await supabase.from('job_postings').select('id, slug, published_at, updated_at').limit(50000);
          items = data || [];
        } catch {
          items = [];
        }
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
      if (slug === 'watch') {
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
      if (slug === 'awards') {
        // Static awards hub + any DB-stored award ceremony pages
        const awardPages = [
          { url: '/awards', priority: '0.8', changefreq: 'weekly' },
          { url: '/awards/amvca', priority: '0.8', changefreq: 'weekly' },
          { url: '/awards/amaa', priority: '0.8', changefreq: 'weekly' },
          { url: '/awards/tinff', priority: '0.7', changefreq: 'monthly' },
          { url: '/awards/golden-stars', priority: '0.7', changefreq: 'monthly' },
          { url: '/awards/yomafa', priority: '0.7', changefreq: 'monthly' },
        ];
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
      if (slug === 'tvshows') {
        const { data } = await supabase
          .from('films')
          .select('id, title, slug, poster_url, updated_at, created_at')
          .eq('type', 'series')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(20000);

        const tvUrls = (data || []).map((f: any) => {
          const loc = `${baseUrl}/films/${f.slug || f.id}`;
          const lastmod = f.updated_at || f.created_at ? new Date(f.updated_at || f.created_at).toISOString() : new Date().toISOString();
          const imageTag = f.poster_url
            ? `\n    <image:image>\n      <image:loc>${escapeXml(f.poster_url)}</image:loc>\n      <image:title>${escapeXml(f.title)} Poster</image:title>\n    </image:image>`
            : '';
          return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>${imageTag}\n  </url>`;
        });

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
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
