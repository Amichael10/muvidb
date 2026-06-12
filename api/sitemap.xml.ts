import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-people.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-films.xml</loc>
  </sitemap>
</sitemapindex>`;

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate');
  res.status(200).send(sitemapIndex);
}
