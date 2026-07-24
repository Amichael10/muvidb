import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { trackSeoHit } from './_lib/scrape_guard.js';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Escape for safe use in both HTML attributes and text nodes.
const esc = (s: any = '') =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const clean = (s: any) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Profiles worth indexing / listing in the people sitemap. */
const isIndexablePerson = (person: any, creditCount: number) => {
  if (person?.is_verified || person?.is_spotlight) return true;
  if (Number(person?.film_count || 0) > 0) return true;
  if (creditCount > 0) return true;
  const bio = clean(person?.bio);
  if (bio.length >= 40 && person?.photo_url) return true;
  return false;
};

const WATCH_NAMES: Record<string, string> = {
  netflix: 'Netflix', prime_video: 'Prime Video', youtube: 'YouTube',
  showmax: 'Showmax', kava: 'Kava', docuth: 'Docuth', cinema: 'In Cinemas',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, slug } = req.query;
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    // ---- SITEMAP HANDLING ----
    if (type === 'sitemap') {
      trackSeoHit(req, 'sitemap', String(slug || 'index'));
      res.setHeader('Content-Type', 'text/xml');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate');

      const urlset = (entries: string) =>
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;

      if (slug === 'index') {
        const maps = ['static', 'people', 'films', 'watch', 'companies', 'cinemas', 'channels'];
        const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${maps.map(m => `  <sitemap><loc>${baseUrl}/sitemap-${m}.xml</loc></sitemap>`).join('\n')}
</sitemapindex>`;
        return res.status(200).send(sitemapIndex);
      }

      if (slug === 'static') {
        const staticUrls = ['', '/browse', '/people', '/cinemas', '/channels', '/companies', '/showtimes'];
        return res.status(200).send(urlset(
          staticUrls.map(url => `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>daily</changefreq>
    <priority>${url === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')
        ));
      }

      if (slug === 'people') {
        // Only invite Google to profiles with real filmography — thin name-only
        // stubs inflate "Crawled - currently not indexed" / Soft 404 in Search Console.
        const { data } = await supabase
          .from('people')
          .select('id, slug, updated_at')
          .gt('film_count', 0)
          .limit(50000);
        return res.status(200).send(urlset(
          (data || []).map((p: any) => `  <url>
    <loc>${baseUrl}/people/${p.slug || p.id}</loc>
    ${p.updated_at ? `<lastmod>${new Date(p.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')
        ));
      }

      if (slug === 'films') {
        const { data } = await supabase.from('films').select('id, slug, updated_at').eq('is_published', true).limit(50000);
        return res.status(200).send(urlset(
          (data || []).map((f: any) => `  <url>
    <loc>${baseUrl}/films/${f.slug || f.id}</loc>
    ${f.updated_at ? `<lastmod>${new Date(f.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')
        ));
      }

      if (slug === 'companies') {
        const { data } = await supabase.from('companies').select('id, slug, updated_at').limit(50000);
        return res.status(200).send(urlset(
          (data || []).map((c: any) => `  <url>
    <loc>${baseUrl}/companies/${c.slug || c.id}</loc>
    ${c.updated_at ? `<lastmod>${new Date(c.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')
        ));
      }

      if (slug === 'cinemas') {
        const { data } = await supabase.from('cinemas').select('id, created_at').eq('is_active', true).limit(50000);
        return res.status(200).send(urlset(
          (data || []).map((c: any) => `  <url>
    <loc>${baseUrl}/cinemas/${c.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')
        ));
      }

      if (slug === 'channels') {
        const { data } = await supabase.from('channels').select('id, slug').limit(50000);
        return res.status(200).send(urlset(
          (data || []).map((c: any) => `  <url>
    <loc>${baseUrl}/channels/${c.slug || c.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')
        ));
      }

      if (slug === 'watch') {
        return res.status(200).send(urlset(
          Object.keys(WATCH_NAMES).map(p => `  <url>
    <loc>${baseUrl}/watch/${p}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')
        ));
      }

      return res.status(404).send('Sitemap not found');
    }

    // Document SEO is owned by React Router loaders (src/lib/seo.server.ts).
    // vercel.json no longer rewrites /films|/people|... here — catch-all goes to /api/ssr.
    return res.status(404).json({
      error: 'not_found',
      message: 'SEO HTML rendering moved to the SSR app. This endpoint serves sitemaps only.',
    });
  } catch (error: any) {
    console.error('SEO/Sitemap Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}

