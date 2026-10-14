import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface AwardSite {
  id: string;
  name: string;
  url: string;
  checkPaths: string[];
}

const AWARD_SITES: AwardSite[] = [
  {
    id: 'REFFA',
    name: 'Regal Film Festival and Awards',
    url: 'https://reffaawards.com',
    checkPaths: ['/', '/2026-nominees/', '/2025-winners/', '/selections/']
  },
  {
    id: 'AMAA',
    name: 'Africa Movie Academy Awards',
    url: 'https://ama-awards.com',
    checkPaths: ['/', '/news/', '/winners/']
  },
  {
    id: 'TINFF',
    name: 'Toronto International Nollywood Film Festival',
    url: 'https://www.tinff.net',
    checkPaths: ['/', '/nominees', '/winners']
  },
  {
    id: 'AFRIFF',
    name: 'Africa International Film Festival',
    url: 'https://afriff.com',
    checkPaths: ['/', '/news/']
  },
  {
    id: 'BON',
    name: 'Best of Nollywood Awards',
    url: 'https://bonawards.com',
    checkPaths: ['/']
  }
];

const STATE_FILE = path.resolve(process.cwd(), 'scratch', 'award_websites_monitor_state.json');

function cleanHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function checkAwardWebsites() {
  console.log(`\n================================================================`);
  console.log(`🕵️ [${new Date().toISOString()}] Checking Award Websites for Updates...`);
  console.log(`================================================================\n`);

  let state: Record<string, { hash: string; lastChecked: string; title?: string }> = {};
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {}
  }

  const updates: Array<{ site: string; url: string; note: string; snippet: string }> = [];

  for (const site of AWARD_SITES) {
    for (const p of site.checkPaths) {
      const targetUrl = `${site.url}${p}`;
      const stateKey = `${site.id}:${p}`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LumiAwardBot/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        clearTimeout(timeout);

        if (!res.ok) {
          console.log(`  ⚠️ [${site.id}] ${targetUrl} responded with status ${res.status}`);
          continue;
        }

        const rawHtml = await res.text();
        const text = cleanHtml(rawHtml);
        const currentHash = hashContent(text);

        const prev = state[stateKey];
        if (!prev) {
          console.log(`  🌱 [${site.id}] Initialized baseline snapshot for ${targetUrl} (${text.length} chars)`);
          state[stateKey] = {
            hash: currentHash,
            lastChecked: new Date().toISOString(),
            title: text.slice(0, 100)
          };
        } else if (prev.hash !== currentHash) {
          console.log(`  🚨 [${site.id}] NEW UPDATE DETECTED at ${targetUrl}!`);
          updates.push({
            site: site.name,
            url: targetUrl,
            note: 'Page content hash changed',
            snippet: text.slice(0, 250)
          });
          state[stateKey] = {
            hash: currentHash,
            lastChecked: new Date().toISOString(),
            title: text.slice(0, 100)
          };
        } else {
          console.log(`  ✓ [${site.id}] No changes at ${targetUrl}`);
          state[stateKey].lastChecked = new Date().toISOString();
        }
      } catch (err: any) {
        console.log(`  ❌ [${site.id}] Error fetching ${targetUrl}: ${err.message}`);
      }
    }
  }

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  console.log(`\n--- Monitor Summary ---`);
  if (updates.length > 0) {
    console.log(`🎉 Found ${updates.length} website update(s)!`);
    console.table(updates);
  } else {
    console.log(`✅ All monitored award portals checked. No new updates.`);
  }

  return updates;
}

// If run directly via command line
if (process.argv[1]?.includes('cron_monitor_award_websites')) {
  checkAwardWebsites().catch(console.error);
}
