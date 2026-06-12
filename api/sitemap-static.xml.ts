import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers.host || 'muvidb.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  const staticUrls = [
    '',
    '/browse',
    '/people',
    '/cinemas',
    '/watchlist',
    '/about'
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map(url => `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>daily</changefreq>
    <priority>${url === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate');
  res.status(200).send(sitemap);
}
