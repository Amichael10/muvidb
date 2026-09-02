export interface Env {
  ENGINE_ENV: string;
  PUBLIC_APP_URL: string;
}

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
</style></head><body><main><span class="pill">CONTENT ENGINE · ${env.ENGINE_ENV}</span><h1>MuviDB Content Engine</h1><p>Shared production engine. Every content item is routed to its own destination channel.</p><div class="grid">${destinations.map(d => `<section class="card"><h2>${d.name}</h2><p>${d.description}</p><span class="pill">${d.active ? 'ACTIVE' : 'COMING SOON'}</span></section>`).join('')}</div><section class="status"><strong>Desktop clipper</strong><div id="clipper">Checking local clipper…</div><a class="button" href="${env.PUBLIC_APP_URL}/admin/social">Open MuviDB Social Studio</a></section><p class="muted">The clipper remains a local desktop process because browsers cannot launch PowerShell directly.</p><script>fetch('http://127.0.0.1:4317/health',{mode:'cors'}).then(r=>r.ok?document.querySelector('#clipper').textContent='Running and ready':'').catch(()=>document.querySelector('#clipper').textContent='Not running — start the MuviDB desktop clipper on this computer.')</script></main></body></html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'content-engine', environment: env.ENGINE_ENV });
    if (url.pathname === '/api/destinations') return Response.json({ destinations });
    if (url.pathname === '/') return new Response(html(env), { headers: { 'content-type': 'text/html; charset=UTF-8' } });
    return new Response('Not found', { status: 404 });
  },
};
