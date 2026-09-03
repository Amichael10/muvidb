export interface Env {
  ENGINE_ENV: string;
  PUBLIC_APP_URL: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ENGINE_API_TOKEN?: string;
  PUBLISHER_TOKEN?: string;
  PUBLISHER_BASE_URL?: string;
  PUBLISH_QUEUE: Queue<PublishMessage>;
  MEDIA_BUCKET: R2Bucket;
}

interface PublishMessage { kind: 'publish_due'; requestedAt: string; source: 'cron' | 'manual'; }

const destinations = [
  { id: 'main-muvidb', name: 'Main MuviDB', description: 'General film discovery and video clips', active: true },
  { id: 'where-to-watch', name: 'Where to Watch by MuviDB', description: 'Availability and streaming discovery', active: true },
  { id: 'muvidb-critics', name: 'MuviDB Critics', description: 'Reviews, ratings and critic conversations', active: true },
  { id: 'nollywood-debate', name: 'Nollywood Debate', description: 'Questions and community discussion', active: false },
  { id: 'muvidb-people', name: 'MuviDB People', description: 'Actor and filmmaker spotlights', active: false },
];

const html = (env: Env) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MuviDB Content Engine</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#111;color:#f7f7f7}body{margin:0;min-height:100vh;background:radial-gradient(circle at 80% 0,#3a180c,#111 45%)}main{max-width:1100px;margin:auto;padding:48px 24px}h1{margin:0 0 8px;font-size:32px}p{color:#aaa}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:28px}.card{border:1px solid #444;border-radius:14px;padding:20px;background:#181818}.card h2{font-size:17px;margin:0 0 10px}.pill{display:inline-block;border-radius:999px;padding:5px 10px;background:#2b1a12;color:#ff6a2a;font-size:12px;font-weight:700}.status{margin-top:36px;border:1px solid #245943;background:#10251d;border-radius:14px;padding:18px;color:#a6f2ca}.button{display:inline-block;margin-top:14px;border:1px solid #ff5a1f;color:#ff7b43;border-radius:8px;padding:10px 14px;text-decoration:none;font-weight:700}.muted{font-size:13px;color:#777}
</style></head><body><main><span class="pill">CONTENT ENGINE · ${env.ENGINE_ENV}</span><h1>MuviDB Content Engine</h1><p>Shared production engine. Every content item is routed to its own destination channel.</p><div class="grid">${destinations.map(d => `<section class="card"><h2>${d.name}</h2><p>${d.description}</p><span class="pill">${d.active ? 'ACTIVE' : 'COMING SOON'}</span></section>`).join('')}</div><section class="status"><strong>Desktop clipper</strong><div id="clipper">Checking local clipper…</div><a class="button" href="${env.PUBLIC_APP_URL}/admin/social">Open MuviDB Social Studio</a></section><section class="status"><strong>Publishing operations</strong><div id="operations">Loading channel approvals and activity…</div></section><p class="muted">The clipper remains a local desktop process because browsers cannot launch PowerShell directly.</p><script>fetch('http://127.0.0.1:4317/health',{mode:'cors'}).then(r=>r.ok?document.querySelector('#clipper').textContent='Running and ready':'').catch(()=>document.querySelector('#clipper').textContent='Not running — start the MuviDB desktop clipper on this computer.');fetch('/api/operations/summary').then(r=>r.json()).then(x=>{document.querySelector('#operations').textContent=x.configured?(x.approvals.pending+' pending approvals · '+x.approvals.approved+' approved · '+x.approvals.rejected+' rejected · '+x.activity.last24h+' events in the last 24 hours'):'Operations tables are not configured yet.'}).catch(()=>document.querySelector('#operations').textContent='Operations status unavailable — retry shortly.')</script></main></body></html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 'access-control-allow-origin': env.PUBLIC_APP_URL || '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'authorization,content-type,x-media-key' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'content-engine', environment: env.ENGINE_ENV, supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) }, { headers });
    if (url.pathname === '/api/destinations') {
      const live = await supabaseQuery(env, 'content_destinations?select=id,slug,name,description,editorial_profile,enabled&enabled=eq.true&order=name.asc');
      return Response.json({ destinations: live.ok ? live.data : destinations, source: live.ok ? 'supabase' : 'fallback' }, { headers });
    }
    if (url.pathname === '/api/destination-platforms') {
      const live = await supabaseQuery(env, 'content_destination_platforms?select=id,destination_id,platform,social_connection_id,enabled&enabled=eq.true&order=destination_id.asc,platform.asc');
      return Response.json({ mappings: live.ok ? live.data : [], source: live.ok ? 'supabase' : 'unavailable' }, { headers });
    }
    if (url.pathname === '/api/operations/summary') {
      const [approvals, activity] = await Promise.all([
        supabaseQuery(env, 'content_channel_approvals?select=status&limit=1000'),
        supabaseQuery(env, 'content_engine_activity_logs?select=created_at&created_at=gte.' + encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString()) + '&limit=1000'),
      ]);
      const approvalCounts = { pending: 0, approved: 0, rejected: 0, blocked: 0, published: 0 };
      if (approvals.ok && Array.isArray(approvals.data)) for (const row of approvals.data as Array<{ status: keyof typeof approvalCounts }>) if (row.status in approvalCounts) approvalCounts[row.status]++;
      return Response.json({ configured: approvals.ok && activity.ok, approvals: approvalCounts, activity: { last24h: activity.ok && Array.isArray(activity.data) ? activity.data.length : 0 } }, { headers });
    }
    if (url.pathname === '/api/content') {
      if (!isAuthorized(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
      const params = new URLSearchParams({ select: 'id,title,status,source,scheduled_at,destination_id,created_at', order: 'created_at.desc', limit: String(Math.min(Number(url.searchParams.get('limit') || 50), 100)) });
      const destination = url.searchParams.get('destination');
      const status = url.searchParams.get('status');
      if (destination) params.set('destination_id', `eq.${destination}`);
      if (status) params.set('status', `eq.${status}`);
      const live = await supabaseQuery(env, `social_content_items?${params}`);
      if (!live.ok) return Response.json({ error: live.error, items: [] }, { status: 503, headers });
      return Response.json({ items: live.data }, { headers });
    }
    if (url.pathname === '/api/operations') {
      if (!isAuthorized(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
      const itemId = url.searchParams.get('contentItemId');
      const filter = itemId ? `&content_item_id=eq.${encodeURIComponent(itemId)}` : '';
      const [approvals, activity] = await Promise.all([
        supabaseQuery(env, `content_channel_approvals?select=*&order=updated_at.desc&limit=100${filter}`),
        supabaseQuery(env, `content_engine_activity_logs?select=*&order=created_at.desc&limit=100${filter}`),
      ]);
      if (!approvals.ok || !activity.ok) return Response.json({ error: 'Operations data is unavailable' }, { status: 503, headers });
      return Response.json({ approvals: approvals.data, activity: activity.data }, { headers });
    }
    if (url.pathname === '/api/media' && request.method === 'POST') {
      if (!isAuthorized(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
      const key = (request.headers.get('x-media-key') || '').replace(/^\/+/, '');
      if (!key || key.length > 512) return Response.json({ error: 'x-media-key is required' }, { status: 400, headers });
      const body = await request.arrayBuffer();
      if (!body.byteLength || body.byteLength > 500 * 1024 * 1024) return Response.json({ error: 'Media must be between 1 byte and 500 MB' }, { status: 400, headers });
      await env.MEDIA_BUCKET.put(key, body, { httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' } });
      await logActivity(env, 'media_uploaded', 'success', `Uploaded ${key}`, { key, bytes: body.byteLength });
      return Response.json({ ok: true, key, bytes: body.byteLength }, { headers });
    }
    if (url.pathname === '/') return new Response(html(env), { headers: { 'content-type': 'text/html; charset=UTF-8' } });
    return new Response('Not found', { status: 404 });
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(env.PUBLISH_QUEUE.send({ kind: 'publish_due', requestedAt: new Date().toISOString(), source: 'cron' }));
  },
  async queue(batch: MessageBatch<PublishMessage>, env: Env) {
    for (const message of batch.messages) {
      try {
        if (message.body.kind !== 'publish_due') { message.ack(); continue; }
        const base = (env.PUBLISHER_BASE_URL || 'https://muvidb.com').replace(/\/$/, '');
        const response = await fetch(`${base}/api/social?task=publish_due&limit=10`, {
          headers: { 'x-cron-secret': env.PUBLISHER_TOKEN || '' },
        });
        const result = await response.text();
        await logActivity(env, 'publisher_run', response.ok ? 'success' : 'error', result.slice(0, 2000), { source: message.body.source, status: response.status });
        if (!response.ok) throw new Error(`Publisher returned ${response.status}`);
        message.ack();
      } catch (error) {
        await logActivity(env, 'publisher_run', 'error', error instanceof Error ? error.message : 'Publisher failed', { source: message.body.source });
        message.retry({ delaySeconds: Math.min(3600, 60 * Math.max(1, message.attempts)) });
      }
    }
  },
};

function isAuthorized(request: Request, env: Env) {
  const expected = env.ENGINE_API_TOKEN;
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`);
}

async function supabaseQuery(env: Env, path: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: 'Supabase secrets are not configured' };
  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    const data = await response.json();
    return response.ok ? { ok: true, data } : { ok: false, error: typeof data?.message === 'string' ? data.message : `Supabase returned ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Supabase request failed' };
  }
}

async function logActivity(env: Env, eventType: string, status: string, message: string, metadata: Record<string, unknown>) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/content_engine_activity_logs`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ event_type: eventType, status, message, metadata }),
  });
}
