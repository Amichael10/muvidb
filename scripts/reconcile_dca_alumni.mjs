import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const APPLY = process.argv.includes('--apply');

const dataFile = 'scripts/data/dca_alumni.json';
if (!fs.existsSync(dataFile)) {
  console.log(`[reconcile_dca_alumni] ${dataFile} not found. Run fetch_dca_alumni.js first.`);
  process.exit(0);
}
const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

const NON_CREATIVE = ['software engineer', 'accountant', 'banker', 'athletic trainer', 'student'];

function cleanFullName(item) {
  let fn = (item.first_name || '').trim();
  let mn = (item.middle_name || '').trim();
  let ln = (item.last_name || '').trim();

  if (mn && fn.toLowerCase().includes(mn.toLowerCase())) {
    mn = '';
  }
  return `${fn} ${mn ? mn + ' ' : ''}${ln}`.replace(/\s+/g, ' ').trim();
}

function mapDepartment(courseStr, profStr) {
  const combined = `${courseStr || ''} ${profStr || ''}`.toLowerCase();
  if (/act|drama|theatre|performing/.test(combined)) return 'Acting';
  if (/direct/.test(combined)) return 'Directing';
  if (/cinemat|camera|dop|lighting/.test(combined)) return 'Cinematography';
  if (/edit|post[ -]?production/.test(combined)) return 'Editing';
  if (/screenwrit|writ|script/.test(combined)) return 'Writing';
  if (/produc/.test(combined)) return 'Production';
  if (/sound|audio/.test(combined)) return 'Sound';
  if (/art|costume|set[ -]?design|make[ -]?up|styling/.test(combined)) return 'Art Department';
  if (/animat|vfx|3d|visual effect/.test(combined)) return 'Visual Effects';
  return 'Directing';
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log(`=== DEL-YORK ALUMNI RECONCILIATION & ENRICHMENT ===`);
  console.log(`Execution Mode: ${APPLY ? '🚀 LIVE APPLY (Writing to Supabase)' : '🔍 DRY-RUN PREVIEW'}`);

  // Filter qualified creative talents
  const qualified = [];
  const seenIds = new Set();

  for (const it of raw) {
    if (!it.id || seenIds.has(it.id)) continue;
    seenIds.add(it.id);

    const name = cleanFullName(it);
    if (!name || name.length < 3) continue;

    const prof = (it.profession?.title || '').toLowerCase().trim();
    const hasAvatar = !!(it.avatar?.image || it.avatar?.thumb);
    const hasPort = !!(it.portfolios && it.portfolios.length);
    const hasExp = !!(it.experience && it.experience.length);
    const hasCourse = !!(it.course?.title || (it.courses && it.courses.length));

    if (hasAvatar || hasPort || hasExp || hasCourse) {
      if (!hasAvatar && NON_CREATIVE.includes(prof)) continue;
      qualified.push(it);
    }
  }

  console.log(`Total qualified creative candidates: ${qualified.length}`);

  // Fetch all names and short names to batch match against database
  const allNamesToTest = [];
  for (const it of qualified) {
    const fn = cleanFullName(it);
    const sn = `${(it.first_name || '').trim()} ${(it.last_name || '').trim()}`.replace(/\s+/g, ' ').trim();
    if (fn) allNamesToTest.push(fn);
    if (sn && sn !== fn) allNamesToTest.push(sn);
  }

  const uniqueTestNames = [...new Set(allNamesToTest)];
  console.log(`Batch checking ${uniqueTestNames.length} name variants against DB...`);

  const dbPeopleByName = new Map();
  for (let i = 0; i < uniqueTestNames.length; i += 50) {
    const slice = uniqueTestNames.slice(i, i + 50);
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, film_count, bio, known_for_department, instagram_url, twitter_url, showreel_urls')
      .in('name', slice);
    if (error) {
      console.error('Batch query error:', error);
    }
    if (data) {
      for (const p of data) {
        dbPeopleByName.set(p.name.toLowerCase(), p);
      }
    }
  }

  // Also load all aliases
  const { data: aliases, error: aErr } = await supabase.from('person_aliases').select('alias, person_id');
  if (aErr) console.error('Alias query error:', aErr);
  const aliasMap = new Map();
  if (aliases) {
    for (const a of aliases) {
      aliasMap.set(a.alias.toLowerCase(), a.person_id);
    }
  }

  let enrichedCount = 0;
  let createdCount = 0;
  let duplicatePreventedCount = 0;
  const processedNamesInRun = new Set();

  for (const item of qualified) {
    const fullName = cleanFullName(item);
    const shortName = `${(item.first_name || '').trim()} ${(item.last_name || '').trim()}`.replace(/\s+/g, ' ').trim();

    if (processedNamesInRun.has(fullName.toLowerCase())) {
      duplicatePreventedCount++;
      continue;
    }
    processedNamesInRun.add(fullName.toLowerCase());

    const avatarUrl = item.avatar?.image || item.avatar?.thumb || null;
    const profession = item.profession?.title || null;

    // Extract courses
    const courses = [];
    if (item.course?.title) courses.push(item.course.title);
    if (Array.isArray(item.courses)) {
      for (const c of item.courses) {
        if (c?.title && !courses.includes(c.title)) courses.push(c.title);
      }
    }
    if (Array.isArray(item.education)) {
      for (const ed of item.education) {
        if ((ed.name || '').toUpperCase().includes('DEL') && ed.course_of_study) {
          if (!courses.includes(ed.course_of_study)) courses.push(ed.course_of_study);
        }
      }
    }

    // Extract portfolio / social links
    const portfolioLinks = [];
    if (Array.isArray(item.portfolios)) {
      for (const p of item.portfolios) {
        if (p?.link && !portfolioLinks.includes(p.link)) portfolioLinks.push(p.link);
      }
    }
    if (item.linkedin_link) {
      const liUrl = item.linkedin_link.startsWith('http') ? item.linkedin_link : `https://linkedin.com/in/${item.linkedin_link}`;
      if (!portfolioLinks.includes(liUrl)) portfolioLinks.push(liUrl);
    }

    // Check DB Match
    let matchedPerson = dbPeopleByName.get(fullName.toLowerCase()) || (shortName ? dbPeopleByName.get(shortName.toLowerCase()) : null);

    if (!matchedPerson && aliasMap.has(fullName.toLowerCase())) {
      const pId = aliasMap.get(fullName.toLowerCase());
      const { data: p } = await supabase.from('people').select('*').eq('id', pId).single();
      if (p) matchedPerson = p;
    }

    if (matchedPerson) {
      // ENRICH IN-PLACE (ZERO DUPLICATE GUARANTEE)
      enrichedCount++;
      console.log(`[ENRICH IN-PLACE] #${item.id} "${fullName}" -> Existing DB Person "${matchedPerson.name}" (${matchedPerson.slug}, ${matchedPerson.film_count || 0} films)`);

      const updates = {};
      // 1. Fill missing photo
      if (!matchedPerson.photo_url && avatarUrl) {
        updates.photo_url = avatarUrl;
        console.log(`   + Added photo: ${avatarUrl}`);
      }
      // Special case: Adasa Cookey known_for_department
      if (matchedPerson.name === 'Adasa Cookey' && matchedPerson.known_for_department !== 'Directing') {
        updates.known_for_department = 'Directing';
        console.log(`   + Corrected department to Directing`);
      }
      // 2. Fill missing socials
      if (!matchedPerson.instagram_url && item.instagram_link) {
        updates.instagram_url = item.instagram_link.startsWith('http') ? item.instagram_link : `https://instagram.com/${item.instagram_link.replace(/^@/, '')}`;
        console.log(`   + Added Instagram`);
      }
      if (!matchedPerson.twitter_url && item.twitter_link) {
        updates.twitter_url = item.twitter_link.startsWith('http') ? item.twitter_link : `https://x.com/${item.twitter_link.replace(/^@/, '')}`;
        console.log(`   + Added Twitter`);
      }
      // 3. Append showreels
      if (portfolioLinks.length > 0) {
        const currentShowreels = Array.isArray(matchedPerson.showreel_urls) ? matchedPerson.showreel_urls : [];
        const mergedReels = [...new Set([...currentShowreels, ...portfolioLinks])];
        if (mergedReels.length > currentShowreels.length) {
          updates.showreel_urls = mergedReels;
          console.log(`   + Added ${mergedReels.length - currentShowreels.length} showreels`);
        }
      }
      // 4. Bio DCA training note
      const currentBio = matchedPerson.bio || '';
      if (!currentBio.toLowerCase().includes('del-york') && !currentBio.toLowerCase().includes('delyork')) {
        const courseStr = courses.length > 0 ? courses.join(', ') : (profession || 'Filmmaking');
        const dcaNote = `Alumnus of Del-York Creative Academy (${courseStr}).`;
        updates.bio = currentBio ? `${currentBio}\n\n${dcaNote}` : dcaNote;
        console.log(`   + Appended DCA training note to bio`);
      }

      if (APPLY && Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { error: uErr } = await supabase.from('people').update(updates).eq('id', matchedPerson.id);
        if (uErr) console.error(`   Error updating ${matchedPerson.name}:`, uErr.message);
        else console.log(`   ✓ Successfully updated ${matchedPerson.name}`);
      }
    } else {
      // NEW COMMUNITY TALENT
      createdCount++;
      const department = mapDepartment(courses.join(' '), profession);
      console.log(`[NEW TALENT] #${item.id} "${fullName}" (${department})`);

      // Bio construction
      let bioDesc = profession ? `Nigerian ${profession.toLowerCase()}` : `Nigerian ${department.toLowerCase()} practitioner`;
      let dcaDesc = courses.length > 0 ? `alumnus of Del-York Creative Academy (${courses.join(', ')})` : `alumnus of Del-York Creative Academy`;
      let bio = `${bioDesc} and ${dcaDesc}.`;

      if (Array.isArray(item.experience) && item.experience.length > 0) {
        const expSummaries = item.experience
          .slice(0, 2)
          .map(e => e.title ? `${e.title}${e.name ? ` at ${e.name}` : ''}` : e.name)
          .filter(Boolean);
        if (expSummaries.length > 0) {
          bio += ` Professional background includes ${expSummaries.join(', ')}.`;
        }
      }

      const baseSlug = slugify(fullName);
      const randSuffix = Math.floor(100 + Math.random() * 900);
      const slug = `${baseSlug}-${randSuffix}`;

      const newRecord = {
        name: fullName,
        slug,
        nationality: 'Nigerian',
        known_for_department: department,
        photo_url: avatarUrl,
        bio,
        status: 'community',
        source: 'del_york_alumni',
        is_verified: false,
        instagram_url: item.instagram_link ? (item.instagram_link.startsWith('http') ? item.instagram_link : `https://instagram.com/${item.instagram_link.replace(/^@/, '')}`) : null,
        twitter_url: item.twitter_link ? (item.twitter_link.startsWith('http') ? item.twitter_link : `https://x.com/${item.twitter_link.replace(/^@/, '')}`) : null,
        showreel_urls: portfolioLinks,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (APPLY) {
        const { data: ins, error: insErr } = await supabase.from('people').insert(newRecord).select('id, name, slug').single();
        if (insErr) {
          console.error(`   Error creating ${fullName}:`, insErr.message);
        } else {
          console.log(`   + Successfully created: ${ins.id} (${ins.slug})`);
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY OF DCA RECONCILIATION`);
  console.log(`========================================`);
  console.log(`Enriched Established Stars/Practitioners In-Place: ${enrichedCount}`);
  console.log(`New Community Creative Talents: ${createdCount}`);
  console.log(`Duplicate Registrations Prevented: ${duplicatePreventedCount}`);
  console.log(`Privacy Standard: 100% of emails, phone numbers & street addresses omitted`);
}

main().catch(console.error);
