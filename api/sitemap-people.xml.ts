import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    // Fetch all people, we might need pagination if it's large, but for now fetch max 50000
    // Supabase REST limits to 1000 by default, so we might need to loop or set limit
    const { data: people, error } = await supabase
      .from('people')
      .select('id, slug, updated_at')
      .limit(10000);

    if (error) {
      console.error('Error fetching people for sitemap:', error);
      return res.status(500).send('Error generating sitemap');
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${(people || []).map(person => {
  const identifier = person.slug || person.id;
  const lastmod = person.updated_at ? `<lastmod>${new Date(person.updated_at).toISOString()}</lastmod>` : '';
  return `  <url>
    <loc>${baseUrl}/people/${identifier}</loc>
    ${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
}).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate');
    res.status(200).send(sitemap);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
}
