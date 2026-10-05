import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ connect: { timeout: 30000 } }));
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanNewlines() {
  console.log('Fetching films with possible newlines or whitespace in URLs...');
  
  // We can fetch films in batches and clean them
  let page = 0;
  const pageSize = 500;
  let fixedCount = 0;

  while (true) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, poster_url, backdrop_url')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching films:', error);
      break;
    }
    if (!films || films.length === 0) break;

    for (const f of films) {
      let needsUpdate = false;
      const updates = {};

      if (f.poster_url && /[\r\n\t]/.test(f.poster_url)) {
        updates.poster_url = f.poster_url.replace(/[\r\n\t]/g, '').trim();
        needsUpdate = true;
      }
      if (f.backdrop_url && /[\r\n\t]/.test(f.backdrop_url)) {
        updates.backdrop_url = f.backdrop_url.replace(/[\r\n\t]/g, '').trim();
        needsUpdate = true;
      }

      if (needsUpdate) {
        await supabase.from('films').update(updates).eq('id', f.id);
        console.log(`✅ Cleaned URL for film: "${f.title}"`);
        fixedCount++;
      }
    }

    if (films.length < pageSize) break;
    page++;
  }

  console.log(`🎉 Finished cleaning newlines! Total fixed: ${fixedCount}`);
}

cleanNewlines();
