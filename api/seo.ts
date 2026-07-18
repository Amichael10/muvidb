import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Escape for safe use in both HTML attributes and text nodes.
const esc = (s: any = '') =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const clean = (s: any) => String(s ?? '').replace(/\s+/g, ' ').trim();

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
        const { data } = await supabase.from('people').select('id, slug, updated_at').limit(50000);
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

    // ---- SEO META + CONTENT INJECTION ----
    let html = '';
    try {
      const indexPath = join(process.cwd(), 'dist', 'index.html');
      html = readFileSync(indexPath, 'utf8');
    } catch (e) {
      console.error('Failed to read dist/index.html:', e);
      return res.status(500).send('Error loading base HTML');
    }

    let title = 'MuviDB | The Ultimate African Film & Entertainment Database';
    let description = 'Discover African films, actors, and entertainment.';
    let image = `${baseUrl}/filmhouse.png`;
    let canonical = `${baseUrl}${req.url}`;
    let body = ''; // crawlable HTML injected into #root
    let robots = 'index, follow';
    let statusCode = 200;
    const jsonLdBlocks: any[] = [];

    const crumbs = (items: { name: string; item: string }[]) => ({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem', position: i + 1, name: it.name, item: it.item,
      })),
    });

    if (type === 'person' && slug) {
      const key = UUID_RE.test(slug as string) ? 'id' : 'slug';
      const { data } = await supabase
        .from('people')
        .select('*, credits(role, character_name, films(title, slug, id, year))')
        .eq(key, slug)
        .maybeSingle();

      if (!data) {
        statusCode = 404; robots = 'noindex, follow';
        title = 'Person not found | MuviDB';
        description = 'This profile could not be found on MuviDB.';
      } else {
        const name = clean(data.name);
        const job = data.known_for_department || 'Actor';
        canonical = `${baseUrl}/people/${data.slug || data.id}`;
        title = `${name} – Nollywood ${job} | MuviDB`;
        description = clean(data.bio).slice(0, 155) ||
          `Discover ${name}'s filmography, credits and videos on MuviDB — the home of Nollywood.`;
        if (data.photo_url) image = data.photo_url;

        const sameAs = [
          data.instagram_url, data.twitter_url, data.facebook_url,
          data.youtube_handle ? `https://youtube.com/${String(data.youtube_handle).replace(/^@?/, '@')}` : null,
        ].filter(Boolean);

        const knownFor = (data.credits || [])
          .map((c: any) => c.films).filter(Boolean).slice(0, 12);

        jsonLdBlocks.push({
          '@context': 'https://schema.org',
          '@type': 'Person',
          name,
          url: canonical,
          image,
          description,
          jobTitle: job,
          ...(data.date_of_birth ? { birthDate: data.date_of_birth } : {}),
          ...(data.birthplace ? { birthPlace: clean(data.birthplace) } : {}),
          ...(data.nationality ? { nationality: clean(data.nationality) } : {}),
          ...(data.gender ? { gender: clean(data.gender) } : {}),
          ...(sameAs.length ? { sameAs } : {}),
        });
        jsonLdBlocks.push(crumbs([
          { name: 'Home', item: `${baseUrl}/` },
          { name: 'People', item: `${baseUrl}/people` },
          { name, item: canonical },
        ]));

        body = `<main>
  <h1>${esc(name)}</h1>
  <p>${esc(job)}${data.nationality ? ` · ${esc(clean(data.nationality))}` : ''}</p>
  ${data.bio ? `<p>${esc(clean(data.bio))}</p>` : ''}
  ${knownFor.length ? `<h2>Known For</h2><ul>${knownFor.map((f: any) =>
    `<li><a href="${baseUrl}/films/${f.slug || f.id}">${esc(clean(f.title))}${f.year ? ` (${f.year})` : ''}</a></li>`).join('')}</ul>` : ''}
</main>`;
      }
    } else if (type === 'film' && slug) {
      const key = UUID_RE.test(slug as string) ? 'id' : 'slug';
      const { data } = await supabase
        .from('films')
        .select('*, film_genres(genres(name)), credits(role, character_name, billing_order, people(name, slug, id))')
        .eq(key, slug)
        .eq('is_published', true)
        .maybeSingle();

      if (!data) {
        statusCode = 404; robots = 'noindex, follow';
        title = 'Film not found | MuviDB';
        description = 'This title could not be found on MuviDB.';
      } else {
        const movieTitle = clean(data.title);
        canonical = `${baseUrl}/films/${data.slug || data.id}`;
        title = `${movieTitle}${data.year ? ` (${data.year})` : ''} – Where to Watch | MuviDB`;
        description = clean(data.synopsis).slice(0, 155) ||
          `Where to watch ${movieTitle} in Nigeria — streaming links, cast and details on MuviDB.`;
        if (data.poster_url || data.backdrop_url) image = data.poster_url || data.backdrop_url;

        const genre = (data.film_genres || []).map((fg: any) => fg.genres?.name).filter(Boolean);

        let streamingLinks: Record<string, string> = {};
        try {
          streamingLinks = typeof data.streaming_links === 'string'
            ? JSON.parse(data.streaming_links) : (data.streaming_links || {});
        } catch (e) { /* ignore */ }
        const watchEntries = Object.entries(streamingLinks).filter(([, v]) => !!v);
        if (data.youtube_watch_url) watchEntries.push(['youtube', data.youtube_watch_url]);

        const cast = (data.credits || [])
          .filter((c: any) => c.people)
          .sort((a: any, b: any) => (a.billing_order ?? 999) - (b.billing_order ?? 999));
        const toPerson = (c: any) => ({
          '@type': 'Person', name: clean(c.people.name),
          url: `${baseUrl}/people/${c.people.slug || c.people.id}`,
        });
        const actors = cast.filter((c: any) => !/direct/i.test(c.role || '')).slice(0, 10).map(toPerson);
        const directors = cast.filter((c: any) => /direct/i.test(c.role || '')).map(toPerson);

        jsonLdBlocks.push({
          '@context': 'https://schema.org',
          '@type': 'Movie',
          name: movieTitle,
          url: canonical,
          image,
          description,
          ...(data.year ? { datePublished: `${data.year}` } : {}),
          ...(genre.length ? { genre } : {}),
          ...(data.language ? { inLanguage: data.language } : {}),
          ...(data.nfvcb_rating ? { contentRating: data.nfvcb_rating } : {}),
          ...(data.runtime_minutes ? { duration: `PT${data.runtime_minutes}M` } : {}),
          ...(actors.length ? { actor: actors } : {}),
          ...(directors.length ? { director: directors } : {}),
          ...(Number(data.tmdb_rating || data.average_rating) > 0 ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(data.tmdb_rating || data.average_rating).toFixed(1),
              bestRating: '10',
              ratingCount: Math.max(1, Number(data.view_count) || 1),
            },
          } : {}),
          ...(watchEntries.length ? {
            potentialAction: watchEntries.map(([, t]) => ({ '@type': 'WatchAction', target: [t] })),
          } : {}),
        });
        jsonLdBlocks.push(crumbs([
          { name: 'Home', item: `${baseUrl}/` },
          { name: 'Movies', item: `${baseUrl}/browse` },
          { name: movieTitle, item: canonical },
        ]));

        body = `<main>
  <h1>${esc(movieTitle)}${data.year ? ` (${data.year})` : ''}</h1>
  ${genre.length ? `<p>${genre.map((g: string) => esc(g)).join(', ')}${data.runtime_minutes ? ` · ${data.runtime_minutes} min` : ''}</p>` : ''}
  ${data.synopsis ? `<p>${esc(clean(data.synopsis))}</p>` : ''}
  ${watchEntries.length ? `<h2>Where to Watch ${esc(movieTitle)}</h2><ul>${watchEntries.map(([k, v]) =>
    `<li><a href="${esc(v)}" rel="nofollow">${esc(WATCH_NAMES[k] || k)}</a></li>`).join('')}</ul>` : ''}
  ${cast.length ? `<h2>Cast &amp; Crew</h2><ul>${cast.slice(0, 12).map((c: any) =>
    `<li><a href="${baseUrl}/people/${c.people.slug || c.people.id}">${esc(clean(c.people.name))}</a>${c.character_name ? ` as ${esc(clean(c.character_name))}` : ''}</li>`).join('')}</ul>` : ''}
</main>`;
      }
    } else if (type === 'watch' && slug) {
      const platformName = WATCH_NAMES[slug as string];
      if (!platformName) {
        statusCode = 404; robots = 'noindex, follow';
        title = 'Platform not found | MuviDB';
        description = 'This platform could not be found on MuviDB.';
      } else {
        canonical = `${baseUrl}/watch/${slug}`;
        title = `Where to Watch Nollywood on ${platformName} | MuviDB`;
        description = `Browse every Nollywood movie available on ${platformName}. Find what to watch tonight on MuviDB — the home of Nollywood.`;
        jsonLdBlocks.push({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          url: canonical,
          description,
          about: `Nollywood films available on ${platformName}`,
        });
        body = `<main>
  <h1>Where to Watch Nollywood on ${esc(platformName)}</h1>
  <p>${esc(description)}</p>
</main>`;
      }
    } else if (type === 'channel' && slug) {
      const key = UUID_RE.test(slug as string) ? 'id' : 'slug';
      const { data } = await supabase.from('channels').select('*').eq(key, slug).maybeSingle();
      if (!data) {
        statusCode = 404; robots = 'noindex, follow';
        title = 'Channel not found | MuviDB';
        description = 'This channel could not be found on MuviDB.';
      } else {
        canonical = `${baseUrl}/channels/${data.slug || data.id}`;
        title = `${clean(data.name)} – Nollywood YouTube Channel | MuviDB`;
        description = clean(data.description).slice(0, 155) || `Watch ${clean(data.name)} on MuviDB.`;
        if (data.thumbnail_url || data.banner_url) image = data.thumbnail_url || data.banner_url;
        jsonLdBlocks.push(crumbs([
          { name: 'Home', item: `${baseUrl}/` },
          { name: 'Channels', item: `${baseUrl}/channels` },
          { name: clean(data.name), item: canonical },
        ]));
        body = `<main><h1>${esc(clean(data.name))}</h1>${data.description ? `<p>${esc(clean(data.description))}</p>` : ''}</main>`;
      }
    } else if (type === 'company' && slug) {
      const key = UUID_RE.test(slug as string) ? 'id' : 'slug';
      const { data } = await supabase.from('companies').select('*').eq(key, slug).maybeSingle();
      if (!data) {
        statusCode = 404; robots = 'noindex, follow';
        title = 'Studio not found | MuviDB';
        description = 'This company could not be found on MuviDB.';
      } else {
        canonical = `${baseUrl}/companies/${data.slug || data.id}`;
        title = `${clean(data.name)} – Nollywood Studio & Filmography | MuviDB`;
        description = clean(data.description).slice(0, 155) ||
          `Films, productions and credits from ${clean(data.name)} on MuviDB — the home of Nollywood.`;
        if (data.logo_url) image = data.logo_url;
        jsonLdBlocks.push({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: clean(data.name),
          url: canonical,
          ...(data.logo_url ? { logo: data.logo_url } : {}),
        });
        jsonLdBlocks.push(crumbs([
          { name: 'Home', item: `${baseUrl}/` },
          { name: 'Companies', item: `${baseUrl}/companies` },
          { name: clean(data.name), item: canonical },
        ]));
        body = `<main><h1>${esc(clean(data.name))}</h1>${data.description ? `<p>${esc(clean(data.description))}</p>` : ''}</main>`;
      }
    } else if (type === 'cinema' && slug) {
      // cinemas are keyed by id (no slug column)
      const { data } = await supabase.from('cinemas').select('*').eq('id', slug).maybeSingle();
      if (!data) {
        statusCode = 404; robots = 'noindex, follow';
        title = 'Cinema not found | MuviDB';
        description = 'This cinema could not be found on MuviDB.';
      } else {
        canonical = `${baseUrl}/cinemas/${data.id}`;
        const loc = [data.city, data.state].filter(Boolean).join(', ');
        title = `${clean(data.name)}${loc ? ` – ${clean(loc)}` : ''} | Showtimes & Tickets | MuviDB`;
        description = clean(data.description).slice(0, 155) ||
          `Showtimes, screens and tickets for ${clean(data.name)}${loc ? ` in ${clean(loc)}` : ''} on MuviDB.`;
        if (data.logo_url) image = data.logo_url;
        jsonLdBlocks.push({
          '@context': 'https://schema.org',
          '@type': 'MovieTheater',
          name: clean(data.name),
          url: canonical,
          ...(data.logo_url ? { image: data.logo_url } : {}),
          ...(data.address || loc ? {
            address: {
              '@type': 'PostalAddress',
              ...(data.address ? { streetAddress: clean(data.address) } : {}),
              ...(data.city ? { addressLocality: clean(data.city) } : {}),
              ...(data.state ? { addressRegion: clean(data.state) } : {}),
              addressCountry: 'NG',
            },
          } : {}),
        });
        jsonLdBlocks.push(crumbs([
          { name: 'Home', item: `${baseUrl}/` },
          { name: 'Cinemas', item: `${baseUrl}/cinemas` },
          { name: clean(data.name), item: canonical },
        ]));
        body = `<main><h1>${esc(clean(data.name))}</h1>${loc ? `<p>${esc(clean(loc))}</p>` : ''}${data.description ? `<p>${esc(clean(data.description))}</p>` : ''}</main>`;
      }
    }

    const metaTags = [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(description)}">`,
      `<meta name="robots" content="${robots}">`,
      `<link rel="canonical" href="${esc(canonical)}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:image" content="${esc(image)}">`,
      `<meta property="og:url" content="${esc(canonical)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      ...jsonLdBlocks.map(b => `<script type="application/ld+json">${JSON.stringify(b)}</script>`),
    ].join('');

    html = html.replace(/<title>.*?<\/title>/gi, '');
    html = html.replace(/<meta name="description".*?>/gi, '');
    html = html.replace(/<meta name="robots".*?>/gi, '');
    html = html.replace(/<link rel="canonical".*?>/gi, '');
    html = html.replace(/<meta property="og:[^"]+".*?>/gi, '');
    html = html.replace(/<meta name="twitter:[^"]+".*?>/gi, '');
    html = html.replace(/<meta property="twitter:[^"]+".*?>/gi, '');
    html = html.replace('<head>', `<head>${metaTags}`);

    // Inject crawlable content into #root (React replaces it on hydration/mount).
    if (body) {
      html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate');
    res.status(statusCode).send(html);
  } catch (err: any) {
    console.error('SEO Error:', err);
    res.status(500).send('Internal Server Error: ' + err.message);
  }
}
