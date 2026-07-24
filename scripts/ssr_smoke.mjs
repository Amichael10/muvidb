/**
 * Content-type smoke tests for MuviDB SSR.
 * Never treat HTTP 200 alone as success.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 npm run smoke:ssr
 *   BASE_URL=https://your-preview.vercel.app npm run smoke:ssr
 */
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const SKIP_API = process.env.SKIP_API === '1' || process.env.SKIP_API === 'true';

const failures = [];

function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

async function check(name, path, { expectCt, bodyTest } = {}) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', headers: { Accept: '*/*' } });
  } catch (e) {
    ok(name, false, `fetch error: ${e.message}`);
    return;
  }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  if (expectCt && !ct.includes(expectCt)) {
    ok(name, false, `status=${res.status} ct=${ct} (wanted ${expectCt})`);
    return;
  }
  if (bodyTest && !bodyTest(text, res)) {
    ok(name, false, `status=${res.status} ct=${ct} body check failed (len=${text.length})`);
    return;
  }
  ok(name, true, `status=${res.status} ct=${ct}`);
}

function htmlLooksRendered(html) {
  if (!html.includes('</html>')) return false;
  // Reject empty SPA shells / hydrate-error blanks
  if (/id=["']root["']\s*>\s*<\/div>/i.test(html) && !/<main[\s>]/i.test(html) && html.length < 2500) {
    return false;
  }
  // Must have some real text content beyond boilerplate
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  return /MuviDB|Nollywood|film|Film/i.test(stripped) && stripped.length > 800;
}

async function main() {
  console.log(`SSR smoke against ${BASE}${SKIP_API ? ' (SKIP_API)' : ''}\n`);

  if (!SKIP_API) {
    await check('api/films JSON', '/api/films?limit=1', {
      expectCt: 'json',
      bodyTest: (t) => {
        try {
          JSON.parse(t);
          return true;
        } catch {
          return false;
        }
      },
    });

    await check('sitemap XML', '/sitemap.xml', {
      expectCt: 'xml',
      bodyTest: (t) => t.includes('<urlset') || t.includes('<sitemapindex'),
    });
  } else {
    console.log('SKIP  api/films + sitemap (SKIP_API=1 — use against Vercel preview for full suite)');
  }

  await check('home HTML SSR', '/', {
    expectCt: 'html',
    bodyTest: htmlLooksRendered,
  });

  // Discover a film slug from production API when local /api is not mounted
  try {
    const apiBase = SKIP_API ? 'https://muvidb.com' : BASE;
    const r = await fetch(`${apiBase}/api/films?limit=1`);
    const j = await r.json();
    const film = Array.isArray(j) ? j[0] : j?.data?.[0] || j?.films?.[0];
    const slug = film?.slug;
    if (slug) {
      await check(`film HTML /films/${slug}`, `/films/${slug}`, {
        expectCt: 'html',
        bodyTest: htmlLooksRendered,
      });
    } else {
      console.log('SKIP  film detail (no slug from /api/films)');
    }
  } catch (e) {
    console.log(`SKIP  film detail (${e.message})`);
  }

  console.log('');
  if (failures.length) {
    console.error(`Failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('All smoke checks passed.');
}

main();
