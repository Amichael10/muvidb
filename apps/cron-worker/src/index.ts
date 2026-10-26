export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SYNC_ENDPOINT: string;
  CRON_SECRET: string;
}

export default {
  /**
   * Cloudflare Cron Trigger Handler
   * Runs reliably on Cloudflare's global edge without runner delays.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduledEvent(event, env));
  },

  /**
   * HTTP Handler for health checks and authorized manual triggers
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'muvidb-cron-worker',
          timestamp: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/check') {
      const result = await checkAndDispatchPublishJobs(env, false);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/trigger') {
      const auth = request.headers.get('authorization') || '';
      const secret = auth.replace(/^Bearer\s+/i, '').trim();
      if (!secret || secret !== env.CRON_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const task = url.searchParams.get('task') || 'social_publish';
      const result = await dispatchTask(env, task);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function handleScheduledEvent(event: ScheduledEvent, env: Env) {
  const cron = event.cron;
  console.log(`[cron-worker] Triggered cron: "${cron}" at ${new Date().toISOString()}`);

  if (cron === '0 23 * * *') {
    // 00:00 WAT (23:00 UTC) -> Roll 30-day social calendar
    console.log('[cron-worker] Dispatching daily_social_schedule...');
    await dispatchTask(env, 'daily_social_schedule');
    return;
  }

  if (cron === '0 6 * * *') {
    // 07:00 WAT (06:00 UTC) -> Morning briefing
    console.log('[cron-worker] Dispatching morning_briefing...');
    await dispatchTask(env, 'morning_briefing');
    return;
  }

  // Routine check (every 10 minutes): check if any post is due in Supabase
  await checkAndDispatchPublishJobs(env, false);
}

/**
 * Checks Supabase for due publish jobs.
 * If NO jobs are due, it returns immediately without calling Vercel.
 * This saves 95%+ of Vercel Serverless compute!
 */
async function checkAndDispatchPublishJobs(env: Env, force: boolean) {
  const now = new Date().toISOString();

  const queryUrl = `${env.SUPABASE_URL}/rest/v1/social_publish_jobs?select=id,platform_variant_id,scheduled_for&status=eq.queued&scheduled_for=lte.${encodeURIComponent(now)}&limit=10`;

  try {
    const res = await fetch(queryUrl, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[cron-worker] Supabase query failed (${res.status}):`, errText);
      return { ok: false, error: 'supabase_query_failed', status: res.status, details: errText };
    }

    const jobs: any[] = await res.json();
    console.log(`[cron-worker] Found ${jobs.length} due publish jobs.`);

    if (jobs.length === 0 && !force) {
      // Zero work due -> 0 Vercel compute consumed!
      return { ok: true, status: 'idle', due_jobs: 0, checked_at: now };
    }

    // Work is due -> invoke publisher on Vercel
    console.log(`[cron-worker] Dispatching social_publish for ${jobs.length} job(s)...`);
    const dispatchRes = await dispatchTask(env, 'social_publish');
    return {
      ok: true,
      status: 'dispatched',
      due_jobs: jobs.length,
      job_ids: jobs.map((j) => j.id),
      dispatch: dispatchRes,
    };
  } catch (err: any) {
    console.error('[cron-worker] Exception checking publish jobs:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function dispatchTask(env: Env, task: string) {
  const url = `${env.SYNC_ENDPOINT}?task=${encodeURIComponent(task)}`;
  console.log(`[cron-worker] Calling ${url}...`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-cron-secret': env.CRON_SECRET,
      },
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[cron-worker] Task ${task} result (HTTP ${res.status}):`, data);
    return {
      task,
      http_status: res.status,
      data,
    };
  } catch (err: any) {
    console.error(`[cron-worker] Failed to dispatch task ${task}:`, err?.message || err);
    return {
      task,
      error: err?.message || String(err),
    };
  }
}
