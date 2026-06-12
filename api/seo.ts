import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, slug } = req.query;
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    // ---- SITEMAP HANDLING ----
    if (type === 'sitemap') {
      res.setHeader('Content-Type', 'text/xml');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate');

      if (slug === 'index') {
        const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap-static.xml</loc></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-people.xml</loc></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-films.xml</loc></sitemap>
</sitemapindex>`;
        return res.status(200).send(sitemapIndex);
      } 
      
      if (slug === 'static') {
        const staticUrls = ['', '/browse', '/people', '/cinemas', '/watchlist', '/about'];
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map(url => `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>daily</changefreq>
    <priority>${url === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;
        return res.status(200).send(sitemap);
      }

      if (slug === 'people') {
        const { data: people } = await supabase.from('people').select('id, slug, updated_at').limit(10000);
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${(people || []).map(p => `  <url>
    <loc>${baseUrl}/people/${p.slug || p.id}</loc>
    ${p.updated_at ? `<lastmod>${new Date(p.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;
        return res.status(200).send(sitemap);
      }

      if (slug === 'films') {
        const { data: films } = await supabase.from('films').select('id, slug, updated_at').limit(10000);
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${(films || []).map(f => `  <url>
    <loc>${baseUrl}/films/${f.slug || f.id}</loc>
    ${f.updated_at ? `<lastmod>${new Date(f.updated_at).toISOString()}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;
        return res.status(200).send(sitemap);
      }

      return res.status(404).send('Sitemap not found');
    }

    // ---- SEO META INJECTION HANDLING ----
    let html = '';
    try {
      const indexPath = path.join(process.cwd(), 'dist', 'index.html');
      html = fs.readFileSync(indexPath, 'utf8');
    } catch (e) {
      console.error('Failed to read dist/index.html:', e);
      return res.status(500).send('Error loading base HTML');
    }

    let title = 'MuviDB | The Ultimate African Film & Entertainment Database';
    let description = 'Discover African films, actors, and entertainment.';
    let image = `${baseUrl}/filmhouse.png`;
    let url = `${baseUrl}${req.url}`;
    let jsonLd = null;

    if (type === 'person' && slug) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slug as string);
      const { data } = await supabase.from('people').select('*').eq(isUuid ? 'id' : 'slug', slug).single();

      if (data) {
        title = `MuviDB | ${data.name}`;
        description = data.biography?.substring(0, 150) || `Discover ${data.name}'s filmography and videos on MuviDB.`;
        if (data.photo_url) image = data.photo_url;
        url = `${baseUrl}/people/${data.slug || data.id}`;
        jsonLd = { "@context": "https://schema.org", "@type": "Person", "name": data.name, "url": url, "image": image, "description": description, "jobTitle": "Actor" };
      }
    } else if (type === 'film' && slug) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slug as string);
      const { data } = await supabase.from('films').select('*').eq(isUuid ? 'id' : 'slug', slug).single();

      if (data) {
        title = `MuviDB | ${data.title}`;
        description = data.synopsis?.substring(0, 150) || `Watch ${data.title} on MuviDB.`;
        if (data.poster_url || data.poster) image = data.poster_url || data.poster;
        url = `${baseUrl}/films/${data.slug || data.id}`;
        jsonLd = { "@context": "https://schema.org", "@type": "Movie", "name": data.title, "url": url, "image": image, "description": description, "dateCreated": data.year ? `${data.year}` : undefined };
      }
    } else if (type === 'channel' && slug) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slug as string);
      const { data } = await supabase.from('channels').select('*').eq(isUuid ? 'id' : 'slug', slug).single();

      if (data) {
        title = `MuviDB | ${data.name}`;
        description = data.description?.substring(0, 150) || `Watch ${data.name} on MuviDB.`;
        if (data.thumbnail_url || data.banner_url || data.avatar_url) image = data.thumbnail_url || data.banner_url || data.avatar_url;
        url = `${baseUrl}/channels/${data.slug || data.id}`;
      }
    }

    const metaTags = `<title>${title}</title><meta name="description" content="${description}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary_large_image">${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}`;

    html = html.replace(/<title>.*?<\/title>/i, '').replace(/<meta name="description".*?>/i, '');
    html = html.replace('<head>', `<head>${metaTags}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate');
    res.status(200).send(html);
  } catch (err) {
    console.error('SEO Error:', err);
    res.status(500).send('Internal Server Error');
  }
}
