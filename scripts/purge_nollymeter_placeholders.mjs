import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import https from 'https';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL).trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY).trim();
const supabase = createClient(url, serviceKey);

const backup = JSON.parse(fs.readFileSync('scratch/pre_backfill_posters_backup.json', 'utf8'));
console.log(`Loaded ${backup.length} backfilled films from backup.`);

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 40,
  timeout: 6000
});

function head(imgUrl) {
  return new Promise((resolve) => {
    let resolved = false;
    const req = https.request(imgUrl, {
      method: 'HEAD',
      agent,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, (res) => {
      res.resume();
      if (!resolved) {
        resolved = true;
        resolve({
          status: res.statusCode,
          length: parseInt(res.headers['content-length'] || '0', 10),
          etag: res.headers['etag'] || ''
        });
      }
    });
    req.on('error', (e) => {
      if (!resolved) {
        resolved = true;
        resolve({ status: 0, length: 0, etag: '', error: e.message });
      }
    });
    req.setTimeout(5000, () => {
      req.destroy();
      if (!resolved) {
        resolved = true;
        resolve({ status: 0, length: 0, etag: '', error: 'timeout' });
      }
    });
    req.end();
  });
}

async function main() {
  console.log('Auditing all 2,441 backfilled posters via HEAD requests...');

  const CONCURRENCY = 25;
  const auditResults = [];

  for (let i = 0; i < backup.length; i += CONCURRENCY) {
    const chunk = backup.slice(i, i + CONCURRENCY);
    const headResults = await Promise.all(chunk.map(c => head(c.new_poster_url)));

    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j];
      const h = headResults[j];
      
      const isPlaceholder = (h.length === 32746 || h.etag.includes('7fea'));
      // Anything under 40KB is either the placeholder or a low-res thumbnail
      const isLowResOrBad = h.length > 0 && h.length < 40000;
      const isError = h.status !== 200;

      auditResults.push({
        film_id: c.film_id,
        title: c.title,
        year: c.year,
        previous_poster_url: c.previous_poster_url,
        new_poster_url: c.new_poster_url,
        content_length: h.length,
        etag: h.etag,
        is_placeholder: isPlaceholder,
        is_low_res_or_bad: isLowResOrBad,
        is_error: isError,
        should_revert: isPlaceholder || isLowResOrBad || isError
      });
    }

    if ((i + CONCURRENCY) % 200 === 0 || i + CONCURRENCY >= backup.length) {
      console.log(`Audited ${Math.min(i + CONCURRENCY, backup.length)}/${backup.length}...`);
    }
  }

  const placeholders = auditResults.filter(r => r.is_placeholder);
  const lowRes = auditResults.filter(r => r.is_low_res_or_bad && !r.is_placeholder);
  const errors = auditResults.filter(r => r.is_error);
  const legitimateHd = auditResults.filter(r => !r.should_revert);
  const toRevert = auditResults.filter(r => r.should_revert);

  console.log('\n=============================================');
  console.log(' AUDIT SUMMARY:');
  console.log(` - Total backfilled posters checked: ${auditResults.length}`);
  console.log(` - Verified Legit HD Posters (>= 40KB): ${legitimateHd.length}`);
  console.log(` - "Lorem Ipsum" Placeholder posters found: ${placeholders.length}`);
  console.log(` - Low-res / tiny thumbnails (< 40KB): ${lowRes.length}`);
  console.log(` - Network / 404 errors: ${errors.length}`);
  console.log(` - TOTAL FILMS TO REVERT: ${toRevert.length}`);
  console.log('=============================================\n');

  fs.writeFileSync('scratch/audit_and_revert_plan.json', JSON.stringify({
    legitimate_hd_count: legitimateHd.length,
    to_revert_count: toRevert.length,
    to_revert: toRevert,
    legitimate: legitimateHd
  }, null, 2));

  console.log(`Reverting ${toRevert.length} films back to their previous poster in Supabase...`);
  const BATCH_SIZE = 25;
  let revertSuccess = 0;
  let revertFail = 0;

  for (let i = 0; i < toRevert.length; i += BATCH_SIZE) {
    const chunk = toRevert.slice(i, i + BATCH_SIZE);
    const promises = chunk.map(item =>
      supabase
        .from('films')
        .update({ poster_url: item.previous_poster_url })
        .eq('id', item.film_id)
    );

    const results = await Promise.all(promises);
    for (const res of results) {
      if (!res.error) revertSuccess++;
      else revertFail++;
    }

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= toRevert.length) {
      console.log(`Revert progress: ${Math.min(i + BATCH_SIZE, toRevert.length)}/${toRevert.length} (Success: ${revertSuccess}, Failed: ${revertFail})`);
    }
  }

  console.log('\n🎉 REVERT COMPLETE:');
  console.log(`Successfully reverted: ${revertSuccess} films with placeholder/low-res images.`);
  console.log(`Active Genuine HD Posters remaining from NollyMeter: ${legitimateHd.length}`);
}

main().catch(console.error);
