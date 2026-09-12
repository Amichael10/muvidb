import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { supabase } from './lib/db';

// Known Nollywood Monikers / Aliases mapping to search in DB
const KNOWN_MONIKER_CLUSTERS: Array<{ label: string; aliases: string[] }> = [
  { label: 'Mr Latin / Bolaji Amusan', aliases: ['Mr Latin', 'Mister Latin', 'Bolaji Amusan', 'Amusan Bolaji'] },
  { label: 'Baba Suwe / Babatunde Omidina', aliases: ['Baba Suwe', 'Babatunde Omidina', 'Babatunde Omidina Baba Suwe', 'Babatunde Omidina (Baba Suwe)'] },
  { label: 'Kemity / Kemi Ariyo / Kemi Apesin', aliases: ['Kemity', 'Kemi Ariyo', 'Kemi Apesin', 'Kemi Apesin Ariyo', 'Kemi Ariyo Kemity'] },
  { label: 'Sanyeri / Olaniyi Afonja', aliases: ['Sanyeri', 'Olaniyi Afonja', 'Olaniyi Mikail Afonja', 'Afonja Olaniyi'] },
  { label: 'Ijebu / Olatayo Amokade', aliases: ['Ijebu', 'Olatayo Amokade', 'Amokade Olatayo'] },
  { label: 'Aki / Chinedu Ikedieze', aliases: ['Aki', 'Chinedu Ikedieze'] },
  { label: 'Pawpaw / Osita Iheme', aliases: ['Pawpaw', 'Paw Paw', 'Osita Iheme'] },
  { label: 'Mr Ibu / John Okafor', aliases: ['Mr Ibu', 'Mr. Ibu', 'John Okafor'] },
  { label: 'Madam Saje / Fausat Balogun', aliases: ['Madam Saje', 'Fausat Balogun', 'Fausat Balogun (Madam Saje)'] },
  { label: 'Babawande / Kareem Adepoju', aliases: ['Babawande', 'Baba Wande', 'Kareem Adepoju'] },
  { label: 'Lalude / Fatai Odua', aliases: ['Lalude', 'Fatai Odua'] },
  { label: 'Digboluja / Ganiyu Kehinde', aliases: ['Digboluja', 'Ganiyu Kehinde'] },
  { label: 'Dejo Tunfulu / Kunle Mac-Tokunbo', aliases: ['Dejo', 'Dejo Tunfulu', 'Kunle Mac-Tokunbo', 'Kunle Mak-Tokunbo'] },
  { label: 'Saka / Afeez Oyetoro', aliases: ['Saka', 'Afeez Oyetoro', 'Hafiz Oyetoro'] },
  { label: 'Apa / Sanusi Izihaq', aliases: ['Apa', 'Sanusi Izihaq', 'Izihaq Sanusi', 'Sanusi Iziaq'] },
  { label: 'Itele / Ibrahim Yekini', aliases: ['Itele', 'Itele d Icon', 'Ibrahim Yekini', 'Itele D\'Icon'] },
  { label: 'Broda Shaggi / Samuel Perry', aliases: ['Broda Shaggi', 'Samuel Animashaun Perry', 'Samuel Perry'] },
  { label: 'Taaooma / Maryam Apaokagi', aliases: ['Taaooma', 'Maryam Apaokagi'] },
  { label: 'Alapinni / Ganiu Nafiu', aliases: ['Alapinni', 'Alapinni Osa', 'Ganiu Nafiu'] },
  { label: 'KOK / Kanayo O. Kanayo', aliases: ['KOK', 'Kanayo O. Kanayo', 'Kanayo O Kanayo', 'Anayo Modestus Onyekwere'] },
  { label: 'Okele / Tunde Usman', aliases: ['Okele', 'Tunde Usman'] },
  { label: 'Jenifa / Funke Akindele', aliases: ['Jenifa', 'Funke Akindele', 'Funke Akindele Bello'] },
  { label: 'Agbako / Charles Olumo', aliases: ['Agbako', 'Charles Olumo'] },
  { label: 'Peteru / Tobi Owomoyela', aliases: ['Peteru', 'Tobi Owomoyela'] },
  { label: 'Bovi / Bovi Ugboma', aliases: ['Bovi', 'Bovi Ugboma'] },
  { label: 'Basketmouth / Bright Okpocha', aliases: ['Basketmouth', 'Basket Mouth', 'Bright Okpocha'] },
  { label: 'AY / Ayo Makun', aliases: ['AY', 'A.Y', 'A.Y.', 'Ayo Makun'] },
  { label: 'Okey Bakassi / Okechukwu Onyegbule', aliases: ['Okey Bakassi', 'Okechukwu Anthony Onyegbule'] },
  { label: 'Ali Baba / Atunyota Akpobome', aliases: ['Ali Baba', 'Atunyota Alleluya Akpobome'] },
  { label: 'Akpororo / Jephthah Bowoto', aliases: ['Akpororo', 'Jephthah Bowoto'] },
  { label: 'MC Lively / Michael Sani Amanesi', aliases: ['MC Lively', 'Michael Sani Amanesi'] },
  { label: 'Sabinus / Emmanuel Ejekwu', aliases: ['Sabinus', 'Investor Sabinus', 'Emmanuel Chukwuemeka Ejekwu'] },
  { label: 'Brain Jotter / Chukwuebuka Amuzie', aliases: ['Brain Jotter', 'Chukwuebuka Emmanuel Amuzie'] },
  { label: 'Nasboi / Lawal Michael Bolaji', aliases: ['Nasboi', 'Lawal Michael Nasiru Bolaji'] },
  { label: 'KieKie / Bukunmi Adeaga-Ilori', aliases: ['KieKie', 'Kiekie', 'Bukunmi Adeaga-Ilori', 'Bukunmi Adeaga'] },
  { label: 'Officer Woos / Ojubanire Jubril', aliases: ['Officer Woos', 'Ojubanire Jubril'] },
  { label: 'Real Warri Pikin / Anita Asuoha', aliases: ['Real Warri Pikin', 'Anita Asuoha'] },
  { label: 'Woli Agba / Ayo Ajewole', aliases: ['Woli Agba', 'Ayo Ajewole'] },
  { label: 'Woli Arole / Toyin Bayegun', aliases: ['Woli Arole', 'Arole', 'Oluwatoyin Bayegun'] },
  { label: 'Bimbo Success / Bimbo Success-Ogunnowo', aliases: ['Bimbo Success', 'Bimbo Success-Ogunnowo', 'Bimbo Ogunnowo'] },
  { label: 'Toyin Abraham / Toyin Aimakhu', aliases: ['Toyin Abraham', 'Toyin Aimakhu'] },
  { label: 'Mercy Aigbe / Mercy Aigbe Gentry / Adeoti', aliases: ['Mercy Aigbe', 'Mercy Aigbe Gentry', 'Mercy Aigbe Adeoti'] },
  { label: 'Bimbo Oshin / Bimbo Oshin Ibironke', aliases: ['Bimbo Oshin', 'Bimbo Oshin Ibironke'] },
  { label: 'Liz Da Silva / Elizabeth Da Silva', aliases: ['Liz Da Silva', 'Elizabeth Omowunmi Tekovi Da Silva', 'Elizabeth Da Silva'] },
  { label: 'Ronke Oshodi Oke / Ronke Ojo', aliases: ['Ronke Oshodi Oke', 'Ronke Ojo', 'Ronke Oshodi-Oke'] },
  { label: 'Foluke Daramola / Salako', aliases: ['Foluke Daramola', 'Foluke Daramola-Salako', 'Foluke Daramola Salako'] },
  { label: 'Iyabo Ojo / Alice Iyabo Ojo', aliases: ['Iyabo Ojo', 'Alice Iyabo Ojo'] },
  { label: 'Faithia Balogun / Faithia Williams', aliases: ['Faithia Balogun', 'Faithia Williams'] },
  { label: 'Sola Sobowale / Toyin Tomato', aliases: ['Sola Sobowale', 'Toyin Tomato'] },
  { label: 'Jide Kosoko / Prince Jide Kosoko', aliases: ['Jide Kosoko', 'Prince Jide Kosoko'] },
  { label: 'Nkem Owoh / Osuofia', aliases: ['Nkem Owoh', 'Osuofia'] },
  { label: 'Sam Loco / Sam Loco Efe', aliases: ['Sam Loco', 'Sam Loco Efe'] },
  { label: 'Zack Orji / Zachee Ama Orji', aliases: ['Zack Orji', 'Zachee Ama Orji'] },
  { label: 'Mama G / Patience Ozokwor', aliases: ['Mama G', 'Patience Ozokwor'] },
  { label: 'Ogogo / Taiwo Hassan', aliases: ['Ogogo', 'Taiwo Hassan', 'Taiwo Hassan Ogogo'] },
  { label: 'Yinka Quadri / Alhaji Yinka Quadri', aliases: ['Yinka Quadri', 'Alhaji Yinka Quadri'] },
  { label: 'Saidi Balogun / Saheed Balogun', aliases: ['Saidi Balogun', 'Saheed Balogun'] },
  { label: 'Sir K-Kamoru / Kamoru Ismaila', aliases: ['Sir K-Kamoru', 'Sir K', 'Kamoru Ismaila'] },
  { label: 'Lere Paimo / Eda Onile Ola', aliases: ['Lere Paimo', 'Eda Onile Ola'] },
  { label: 'Oga Bello / Adebayo Salami', aliases: ['Oga Bello', 'Adebayo Salami'] },
  { label: 'Femi Adebayo / Jelili', aliases: ['Femi Adebayo', 'Jelili'] },
  { label: 'Aluwe / Sunday Omobolanle', aliases: ['Aluwe', 'Sunday Omobolanle', 'Papi Luwe'] },
  { label: 'Fadeyi Oloro / Ojo Arowosafe', aliases: ['Fadeyi Oloro', 'Fadeyi', 'Ojo Arowosafe'] },
  { label: 'Abija / Tajudeen Akanmu', aliases: ['Abija', 'Abija Wara bi Ekun', 'Tajudeen Akanmu'] },
  { label: 'Dagunro / Fasasi Olabankewin', aliases: ['Dagunro', 'Fasasi Olabankewin'] },
  { label: 'Iya Rainbow / Idowu Philips', aliases: ['Iya Rainbow', 'Mama Rainbow', 'Idowu Philips'] },
  { label: 'Iya Awero / Lanre Hassan', aliases: ['Iya Awero', 'Lanre Hassan'] },
  { label: 'Mo Bimpe / Bimpe Oyebade', aliases: ['Mo Bimpe', 'Bimpe Oyebade', 'Bimpe Oyebade Adedimeji'] },
  { label: 'Biola Adebayo / Biola Eyin Oka', aliases: ['Biola Adebayo', 'Biola Eyin Oka'] },
  { label: 'Ronke Odusanya / Flakky Ididowo', aliases: ['Ronke Odusanya', 'Flakky Ididowo'] },
  { label: 'Sotayo Gaga / Tayo Sobola', aliases: ['Sotayo Gaga', 'Tayo Sobola'] },
  { label: 'Regina Daniels / Regina Daniels Nwoko', aliases: ['Regina Daniels', 'Regina Daniels Nwoko'] },
  { label: 'Mercy Johnson / Mercy Johnson Okojie', aliases: ['Mercy Johnson', 'Mercy Johnson Okojie'] },
  { label: 'ChaCha Eke / ChaCha Eke Faani', aliases: ['ChaCha Eke', 'Chacha Eke Faani', 'Chacha Eke'] },
  { label: 'Chizzy Alichi / Chizzy Alichi Mbah', aliases: ['Chizzy Alichi', 'Chizzy Alichi Mbah', 'Chizzy Alichi-Mbah'] },
  { label: 'Rita Dominic / Rita Dominic Anosike', aliases: ['Rita Dominic', 'Rita Dominic Anosike'] },
  { label: 'Omotola Jalade / Ekeinde', aliases: ['Omotola Jalade', 'Omotola Jalade Ekeinde', 'Omotola Jalade-Ekeinde'] },
  { label: 'Stephanie Okereke / Linus', aliases: ['Stephanie Okereke', 'Stephanie Linus', 'Stephanie Okereke Linus'] },
  { label: 'Bolanle Ninalowo / Nino B', aliases: ['Bolanle Ninalowo', 'Nino B'] },
  { label: 'RMD / Richard Mofe-Damijo', aliases: ['RMD', 'Richard Mofe Damijo', 'Richard Mofe-Damijo'] },
  { label: 'Segun Arinze / Black Arrow', aliases: ['Segun Arinze', 'Black Arrow'] },
  { label: 'Gentle Jack / Vuga', aliases: ['Gentle Jack', 'Vuga'] },
  { label: 'Jim Iyke / James Ikechukwu Esomugha', aliases: ['Jim Iyke', 'James Ikechukwu Esomugha'] },
  { label: 'Junior Pope / Junior Pope Odonwodo', aliases: ['Junior Pope', 'Junior Pope Odonwodo'] },
  { label: 'Sylvester Madu / Shina Rambo', aliases: ['Sylvester Madu', 'Shina Rambo'] },
  { label: 'Ebubedike / Pete Edochie', aliases: ['Pete Edochie', 'Chief Pete Edochie', 'Ebubedike'] },
  { label: 'Osuofia / Nkem Owoh', aliases: ['Nkem Owoh', 'Osuofia'] },
];

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^((chief|prince|dr\.?|alhaji|alhaja|pastor|evang\.?|rev\.?|mrs?\.?|miss)\s+)+/i, '')
    .replace(/\s+(official|tv|comedy|mfr|mon)$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(name: string): string[] {
  return normalizeName(name).split(' ').filter(w => w.length > 1);
}

function tokenSortKey(name: string): string {
  return tokenize(name).sort().join(' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

async function fetchAllPeople() {
  console.log('Fetching all people from database...');
  const pageSize = 1000;
  const batches = [];
  for (let i = 0; i < 14; i++) {
    batches.push(
      supabase
        .from('people')
        .select('id, name, slug, film_count, popularity_score, photo_url, is_verified')
        .range(i * pageSize, (i + 1) * pageSize - 1)
    );
  }
  const results = await Promise.all(batches);
  const all: any[] = [];
  for (const r of results) {
    if (r.data) all.push(...r.data);
  }
  return all;
}

async function main() {
  const people = await fetchAllPeople();
  console.log(`Loaded ${people.length} total people records.\n`);

  // Index people by lowercase name
  const nameMap = new Map<string, any[]>();
  const normMap = new Map<string, any[]>();
  const tokenSortMap = new Map<string, any[]>();

  for (const p of people) {
    const raw = (p.name || '').trim().toLowerCase();
    if (!nameMap.has(raw)) nameMap.set(raw, []);
    nameMap.get(raw)!.push(p);

    const norm = normalizeName(p.name || '');
    if (norm) {
      if (!normMap.has(norm)) normMap.set(norm, []);
      normMap.get(norm)!.push(p);

      const tKey = tokenSortKey(p.name || '');
      if (tKey) {
        if (!tokenSortMap.has(tKey)) tokenSortMap.set(tKey, []);
        tokenSortMap.get(tKey)!.push(p);
      }
    }
  }

  // 1. Moniker / Stage-Name Duplicates in DB
  console.log('================================================================');
  console.log('1. KNOWN NOLLYWOOD MONIKER / STAGE NAME DUPLICATES PRESENT IN DB');
  console.log('================================================================');
  const monikerDuplicates: Array<{ cluster: string; foundRecords: any[] }> = [];

  for (const cluster of KNOWN_MONIKER_CLUSTERS) {
    const found: any[] = [];
    for (const alias of cluster.aliases) {
      const lower = alias.trim().toLowerCase();
      // Look for exact match or normalized match
      const matches = nameMap.get(lower) || [];
      for (const m of matches) {
        if (!found.some(x => x.id === m.id)) {
          found.push(m);
        }
      }
    }

    if (found.length >= 2) {
      monikerDuplicates.push({
        cluster: cluster.label,
        foundRecords: found,
      });
      console.log(`🎯 [${cluster.label}] -> Found ${found.length} separate profiles in DB:`);
      for (const f of found) {
        console.log(`   • "${f.name}" (ID: ${f.id}, Films: ${f.film_count || 0}, Verified: ${f.is_verified})`);
      }
    }
  }
  console.log(`\nTotal Moniker/Alias Clusters with Multiple Profiles in DB: ${monikerDuplicates.length}\n`);

  // 2. Name Inversions (e.g. "Amusan Bolaji" vs "Bolaji Amusan")
  console.log('================================================================');
  console.log('2. INVERTED / PERMUTED NAMES (TOKEN SORT DUPLICATES)');
  console.log('================================================================');
  const invertedDuplicates: Array<{ key: string; records: any[] }> = [];
  for (const [key, records] of tokenSortMap.entries()) {
    if (records.length >= 2) {
      // Ensure they don't have identical raw normalized names (those are case/punct duplicates)
      const distinctNorms = new Set(records.map(r => normalizeName(r.name)));
      if (distinctNorms.size >= 2 && key.includes(' ')) {
        invertedDuplicates.push({ key, records });
      }
    }
  }
  console.log(`Found ${invertedDuplicates.length} inverted/swapped name duplicate groups.`);
  for (const g of invertedDuplicates.slice(0, 15)) {
    console.log(`   • Key: "${g.key}" -> [${g.records.map(r => `"${r.name}" (${r.film_count || 0} films)`).join(', ')}]`);
  }
  if (invertedDuplicates.length > 15) {
    console.log(`   ... and ${invertedDuplicates.length - 15} more.`);
  }

  // 3. Title/Prefix/Punctuation duplicates (e.g. "Prince Jide Kosoko" vs "Jide Kosoko")
  console.log('\n================================================================');
  console.log('3. TITLE / PREFIX / PUNCTUATION DUPLICATES');
  console.log('================================================================');
  const prefixDuplicates: Array<{ norm: string; records: any[] }> = [];
  for (const [norm, records] of normMap.entries()) {
    if (records.length >= 2) {
      const distinctRaw = new Set(records.map(r => r.name.trim()));
      if (distinctRaw.size >= 2) {
        prefixDuplicates.push({ norm, records });
      }
    }
  }
  console.log(`Found ${prefixDuplicates.length} prefix/punctuation duplicate groups.`);
  for (const g of prefixDuplicates.slice(0, 15)) {
    console.log(`   • Normalized: "${g.norm}" -> [${g.records.map(r => `"${r.name}" (${r.film_count || 0} films)`).join(', ')}]`);
  }
  if (prefixDuplicates.length > 15) {
    console.log(`   ... and ${prefixDuplicates.length - 15} more.`);
  }

  // 4. Substring / Maiden / Compound Name Overlaps
  // (e.g. "Kemi Ariyo" in "Kemi Ariyo Kemity", "Chizzy Alichi" in "Chizzy Alichi Mbah", "Mercy Aigbe" in "Mercy Aigbe Gentry")
  console.log('\n================================================================');
  console.log('4. COMPOUND / MAIDEN / EXTENDED NAME OVERLAPS');
  console.log('================================================================');
  const compoundDuplicates: Array<{ base: any; extended: any }> = [];
  // Sort by film_count descending
  const popularPeople = people
    .filter(p => (p.film_count && p.film_count >= 1) || p.is_verified)
    .sort((a, b) => (b.film_count || 0) - (a.film_count || 0));

  for (let i = 0; i < Math.min(popularPeople.length, 1500); i++) {
    const p1 = popularPeople[i];
    const n1 = normalizeName(p1.name);
    if (n1.length < 6 || !n1.includes(' ')) continue;

    for (let j = 0; j < popularPeople.length; j++) {
      if (i === j) continue;
      const p2 = popularPeople[j];
      const n2 = normalizeName(p2.name);
      if (n2.length < 6) continue;

      if (n2.startsWith(n1 + ' ') || n2.endsWith(' ' + n1)) {
        // e.g. "Mercy Aigbe" and "Mercy Aigbe Gentry"
        compoundDuplicates.push({ base: p1, extended: p2 });
      }
    }
  }
  console.log(`Found ${compoundDuplicates.length} compound/extended name pairs.`);
  for (const pair of compoundDuplicates.slice(0, 20)) {
    console.log(`   • Base: "${pair.base.name}" (${pair.base.film_count || 0} films) <-> Extended: "${pair.extended.name}" (${pair.extended.film_count || 0} films)`);
  }
  if (compoundDuplicates.length > 20) {
    console.log(`   ... and ${compoundDuplicates.length - 20} more.`);
  }

  // 5. Fuzzy Levenshtein close matches (typos like Frederick vs Fredrick)
  console.log('\n================================================================');
  console.log('5. CLOSE TYPOS / LEVENSHTEIN FUZZY DUPLICATES');
  console.log('================================================================');
  const fuzzyDuplicates: Array<{ p1: any; p2: any; distance: number }> = [];
  const popularActors = popularPeople.slice(0, 1000);
  for (let i = 0; i < popularActors.length; i++) {
    const a = popularActors[i];
    const nA = normalizeName(a.name);
    if (nA.length < 7) continue;

    for (let j = i + 1; j < popularActors.length; j++) {
      const b = popularActors[j];
      const nB = normalizeName(b.name);
      if (nB.length < 7) continue;

      // Same first letter, length difference <= 2, distance <= 2
      if (nA[0] === nB[0] && Math.abs(nA.length - nB.length) <= 2) {
        const dist = levenshtein(nA, nB);
        if (dist >= 1 && dist <= 2) {
          fuzzyDuplicates.push({ p1: a, p2: b, distance: dist });
        }
      }
    }
  }
  console.log(`Found ${fuzzyDuplicates.length} close typo duplicate pairs among active actors.`);
  for (const f of fuzzyDuplicates.slice(0, 15)) {
    console.log(`   • "${f.p1.name}" (${f.p1.film_count || 0} films) <-> "${f.p2.name}" (${f.p2.film_count || 0} films) [Levenshtein: ${f.distance}]`);
  }

  // Grand summary stats
  const totalUniqueDuplicateProfiles = new Set<string>();
  monikerDuplicates.forEach(d => d.foundRecords.forEach(r => totalUniqueDuplicateProfiles.add(r.id)));
  invertedDuplicates.forEach(d => d.records.forEach(r => totalUniqueDuplicateProfiles.add(r.id)));
  prefixDuplicates.forEach(d => d.records.forEach(r => totalUniqueDuplicateProfiles.add(r.id)));
  compoundDuplicates.forEach(d => { totalUniqueDuplicateProfiles.add(d.base.id); totalUniqueDuplicateProfiles.add(d.extended.id); });
  fuzzyDuplicates.forEach(d => { totalUniqueDuplicateProfiles.add(d.p1.id); totalUniqueDuplicateProfiles.add(d.p2.id); });

  console.log('\n================================================================');
  console.log('📊 OVERALL DUPLICATION AUDIT SUMMARY');
  console.log('================================================================');
  console.log(`• Total People Scanned: ${people.length}`);
  console.log(`• Known Nollywood Moniker/Stage Name Clusters with Duplicates: ${monikerDuplicates.length}`);
  console.log(`• Inverted Name Pairs ("Lastname Firstname" vs "Firstname Lastname"): ${invertedDuplicates.length}`);
  console.log(`• Prefix/Punctuation/Title Duplicates ("Prince X" vs "X", "Dr." vs "Dr"): ${prefixDuplicates.length}`);
  console.log(`• Compound / Maiden / Extended Name Pairs (e.g. "Kemi Ariyo" vs "Kemi Apesin Ariyo"): ${compoundDuplicates.length}`);
  console.log(`• Close Typo / Spelling Pairs (Levenshtein 1-2): ${fuzzyDuplicates.length}`);
  console.log(`• Total Unique Actor/Person Profiles Affected by Duplication: ${totalUniqueDuplicateProfiles.size}`);
  console.log('================================================================\n');

  // Save full audit report to scratch
  fs.writeFileSync('scratch/actors_duplicate_audit_report.json', JSON.stringify({
    total_people_scanned: people.length,
    total_profiles_affected: totalUniqueDuplicateProfiles.size,
    moniker_clusters_found: monikerDuplicates,
    inverted_duplicates_count: invertedDuplicates.length,
    prefix_duplicates_count: prefixDuplicates.length,
    compound_duplicates_count: compoundDuplicates.length,
    fuzzy_duplicates_count: fuzzyDuplicates.length,
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log('Detailed JSON audit written to scratch/actors_duplicate_audit_report.json');
}

main().catch(console.error);
