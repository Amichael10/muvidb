import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, slug } = req.query;
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    // 1. Get the base HTML shell
    let html = '';
    try {
      // Try to read dist/index.html from the local filesystem (works on Vercel)
      const indexPath = path.join(process.cwd(), 'dist', 'index.html');
      html = fs.readFileSync(indexPath, 'utf8');
    } catch (e) {
      // Fallback: fetch from the deployed URL
      try {
        const resp = await fetch(`${baseUrl}/index.html`);
        html = await resp.text();
      } catch (err) {
        return res.status(500).send('Error loading base HTML');
      }
    }

    // 2. Fetch data based on type
    let title = 'MuviDB | The Ultimate African Film & Entertainment Database';
    let description = 'Discover African films, actors, and entertainment.';
    let image = `${baseUrl}/filmhouse.png`;
    let url = `${baseUrl}${req.url}`;
    let jsonLd = null;

    if (type === 'person' && slug) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slug as string);
      const col = isUuid ? 'id' : 'slug';
      
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq(col, slug)
        .single();

      if (data) {
        title = `${data.name} - Actor | MuviDB`;
        description = data.biography?.substring(0, 150) || `Discover ${data.name}'s filmography and videos on Lumi.`;
        if (data.photo_url) image = data.photo_url;
        url = `${baseUrl}/people/${data.slug || data.id}`;

        jsonLd = {
          "@context": "https://schema.org",
          "@type": "Person",
          "name": data.name,
          "url": url,
          "image": image,
          "description": description,
          "jobTitle": "Actor"
        };
      }
    } else if (type === 'film' && slug) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(slug as string);
      const col = isUuid ? 'id' : 'slug';

      const { data, error } = await supabase
        .from('films')
        .select('*')
        .eq(col, slug)
        .single();

      if (data) {
        title = `${data.title} - MuviDB`;
        description = data.synopsis?.substring(0, 150) || `Watch ${data.title} on Lumi.`;
        if (data.poster_url || data.poster) image = data.poster_url || data.poster;
        url = `${baseUrl}/films/${data.slug || data.id}`;

        jsonLd = {
          "@context": "https://schema.org",
          "@type": "Movie",
          "name": data.title,
          "url": url,
          "image": image,
          "description": description,
          "dateCreated": data.year ? `${data.year}` : undefined
        };
      }
    }

    // 3. Inject SEO tags into HTML
    const metaTags = `
      <title>${title}</title>
      <meta name="description" content="${description}">
      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${description}">
      <meta property="og:image" content="${image}">
      <meta property="og:url" content="${url}">
      <meta name="twitter:card" content="summary_large_image">
      ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
    `;

    // Replace default generic tags or just inject into <head>
    // Remove default generic title if it exists
    html = html.replace(/<title>.*?<\/title>/i, '');
    html = html.replace(/<meta name="description".*?>/i, '');

    // Inject our generated tags right after <head>
    html = html.replace('<head>', `<head>${metaTags}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate');
    res.status(200).send(html);
  } catch (err) {
    console.error('SEO Error:', err);
    res.status(500).send('Internal Server Error');
  }
}
