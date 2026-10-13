import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

import { mirrorImageToStorage } from '../api/_lib/image_mirror.js';
import { AWARD_ORGS } from '../src/lib/awards.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';

/**
 * Direct FilmFreeway CDN storage URLs and Wikimedia direct image sources
 */
const FESTIVAL_LOGO_SOURCES: Record<string, string> = {
  // FilmFreeway Hosted Logos
  TINFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/022/521/large/logo.jpg',
  AIFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/024/823/large/logo.jpg',
  EKOIFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/000/641/large/ekoiff_new_2.jpg',
  LIFANIMA: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/047/180/large/logo.jpg',
  ASIFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/038/456/large/logo.jpg',
  BIFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/045/487/large/logo.jpg',
  BCFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/046/087/default/logo.jpg',
  CCFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/055/871/large/logo.jpg',
  ZUFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/043/251/large/logo.jpg',
  AFFIF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/050/214/large/logo.jpg',
  SEPTIMIUS: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/044/092/large/logo.jpg',
  BINFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/078/325/large/logo.jpg',
  AFRIFF: 'https://filmfreeway-production-storage-01-connector.filmfreeway.com/festivals/logos/000/024/931/large/Afriff_logo_330px.jpg',

  // Major Academies & Global Festivals
  AMAA: 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Africa_Movie_Academy_Awards_logo.png',
  AMVCA: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/AfricaMagic_logo.png',
  BON: 'https://upload.wikimedia.org/wikipedia/en/f/f6/Best_of_Nollywood_Awards_logo.jpg',
  TIFF: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Toronto_International_Film_Festival_logo.svg/512px-Toronto_International_Film_Festival_logo.svg.png',
  SUNDANCE: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Sundance_Film_Festival_logo.svg/512px-Sundance_Film_Festival_logo.svg.png',
  VENICE: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/06/Venice_Film_Festival_logo.svg/512px-Venice_Film_Festival_logo.svg.png',
  EMMY: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/International_Emmy_Award_logo.svg/512px-International_Emmy_Award_logo.svg.png',
  FESPACO: 'https://upload.wikimedia.org/wikipedia/fr/5/52/Logo_Fespaco.png',
  DIFF: 'https://upload.wikimedia.org/wikipedia/en/6/63/Durban_International_Film_Festival_logo.png',
  PAFF: 'https://upload.wikimedia.org/wikipedia/en/5/5e/Pan_African_Film_Festival_Logo.jpg',
};

async function run() {
  console.log(`🏆 Mirroring Award Festival Logos from FilmFreeway & Official Archives...`);

  const results: Record<string, string> = {};

  for (const [orgId, sourceUrl] of Object.entries(FESTIVAL_LOGO_SOURCES)) {
    console.log(`📥 [${orgId}] Mirroring from: ${sourceUrl}`);
    try {
      const ext = sourceUrl.includes('.png') ? 'png' : sourceUrl.includes('.svg') ? 'svg' : 'jpg';
      const filename = `award-logo-${orgId.toLowerCase()}.${ext}`;
      const mirroredUrl = await mirrorImageToStorage(sourceUrl, 'posters', filename);

      if (mirroredUrl) {
        const fullUrl = mirroredUrl.startsWith('http')
          ? mirroredUrl
          : `${SUPABASE_URL}${mirroredUrl.startsWith('/') ? '' : '/'}${mirroredUrl}`;
        results[orgId] = fullUrl;
        console.log(`   ✓ Mirrored: ${fullUrl}`);
      } else {
        console.warn(`   ⚠️ Fallback to direct: ${sourceUrl}`);
        results[orgId] = sourceUrl;
      }
    } catch (e: any) {
      console.error(`   ❌ Error for ${orgId}: ${e.message}`);
      results[orgId] = sourceUrl;
    }
  }

  const outPath = path.resolve('scripts/data/award_logos.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\n🎉 Mirroring completed! Total saved: ${Object.keys(results).length}`);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
