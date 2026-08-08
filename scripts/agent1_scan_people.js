import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAgent1Scan() {
  console.log('====================================================');
  console.log('🤖 AGENT 1: SCANNING ENTIRE PEOPLE DATABASE');
  console.log('====================================================');

  let allPeople = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  console.log('Fetching people records from Supabase...');

  while (hasMore) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug, gender, photo_url, date_of_birth, bio, instagram_url, twitter_url, facebook_url, tiktok_url, youtube_handle, tmdb_id, mubi_id, popularity_score')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching people:', error);
      break;
    }

    if (data && data.length > 0) {
      allPeople = allPeople.concat(data);
      console.log(`  Fetched ${allPeople.length} people so far...`);
      page++;
      if (data.length < pageSize) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  console.log(`\nTotal people in DB: ${allPeople.length}`);

  const incompletePeople = [];
  let countMissingGender = 0;
  let countMissingPhoto = 0;
  let countMissingDOB = 0;
  let countMissingSocials = 0;
  let countMissingBio = 0;
  let countMissingAll = 0;

  for (const person of allPeople) {
    const hasGender = Boolean(person.gender && person.gender.trim());
    const hasPhoto = Boolean(person.photo_url && person.photo_url.trim());
    const hasDOB = Boolean(person.date_of_birth && person.date_of_birth.trim());
    const hasSocials = Boolean(
      (person.instagram_url && person.instagram_url.trim()) ||
      (person.twitter_url && person.twitter_url.trim()) ||
      (person.facebook_url && person.facebook_url.trim()) ||
      (person.tiktok_url && person.tiktok_url.trim()) ||
      (person.youtube_handle && person.youtube_handle.trim())
    );
    const hasBio = Boolean(person.bio && person.bio.trim());

    if (!hasGender) countMissingGender++;
    if (!hasPhoto) countMissingPhoto++;
    if (!hasDOB) countMissingDOB++;
    if (!hasSocials) countMissingSocials++;
    if (!hasBio) countMissingBio++;

    const missingFields = [];
    if (!hasGender) missingFields.push('gender');
    if (!hasPhoto) missingFields.push('photo_url');
    if (!hasDOB) missingFields.push('date_of_birth');
    if (!hasSocials) missingFields.push('social_links');
    if (!hasBio) missingFields.push('bio');

    if (missingFields.length === 5) {
      countMissingAll++;
    }

    if (missingFields.length > 0) {
      incompletePeople.push({
        id: person.id,
        name: person.name,
        slug: person.slug,
        missing_count: missingFields.length,
        missing_fields: missingFields.join(', '),
        gender: person.gender || '',
        photo_url: person.photo_url || '',
        date_of_birth: person.date_of_birth || '',
        bio: person.bio ? person.bio.substring(0, 100).replace(/\r?\n|\r/g, ' ') : '',
        instagram_url: person.instagram_url || '',
        twitter_url: person.twitter_url || '',
        facebook_url: person.facebook_url || '',
        tmdb_id: person.tmdb_id || '',
        mubi_id: person.mubi_id || '',
        popularity_score: person.popularity_score || 0
      });
    }
  }

  // Sort by popularity / completion priority
  incompletePeople.sort((a, b) => b.popularity_score - a.popularity_score || b.missing_count - a.missing_count);

  console.log('\n====================================================');
  console.log('📊 AGENT 1 SCAN RESULTS SUMMARY');
  console.log('====================================================');
  console.log(`Total DB Records Scanned    : ${allPeople.length}`);
  console.log(`Total Needing Enrichment   : ${incompletePeople.length} (${Math.round((incompletePeople.length / allPeople.length) * 100)}%)`);
  console.log(`Missing Gender             : ${countMissingGender}`);
  console.log(`Missing Profile Photo      : ${countMissingPhoto}`);
  console.log(`Missing Date of Birth      : ${countMissingDOB}`);
  console.log(`Missing Social Links       : ${countMissingSocials}`);
  console.log(`Missing Bio                : ${countMissingBio}`);
  console.log(`Missing ALL 5 Fields       : ${countMissingAll}`);
  console.log('====================================================\n');

  // Save output JSON & CSV
  const jsonPath = path.join(process.cwd(), 'people_missing_data_scan.json');
  fs.writeFileSync(jsonPath, JSON.stringify(incompletePeople, null, 2), 'utf-8');
  console.log(`Saved JSON scan results to: ${jsonPath}`);

  // Build CSV
  const csvHeaders = ['id', 'name', 'slug', 'missing_count', 'missing_fields', 'gender', 'photo_url', 'date_of_birth', 'instagram_url', 'twitter_url', 'facebook_url', 'popularity_score'];
  const csvRows = [
    csvHeaders.join(','),
    ...incompletePeople.map(p => [
      `"${p.id}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.slug || '').replace(/"/g, '""')}"`,
      p.missing_count,
      `"${p.missing_fields}"`,
      `"${p.gender}"`,
      `"${p.photo_url}"`,
      `"${p.date_of_birth}"`,
      `"${p.instagram_url}"`,
      `"${p.twitter_url}"`,
      `"${p.facebook_url}"`,
      p.popularity_score
    ].join(','))
  ];

  const csvPath = path.join(process.cwd(), 'people_missing_data_scan.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
  console.log(`Saved CSV scan results to : ${csvPath}`);
}

runAgent1Scan().catch(err => {
  console.error('Agent 1 Error:', err);
  process.exit(1);
});
