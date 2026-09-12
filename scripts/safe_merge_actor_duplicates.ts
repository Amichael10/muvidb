import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { supabase } from './lib/db';

const isDryRun = process.argv.includes('--dry-run');

interface PersonRecord {
  id: string;
  name: string;
  slug?: string;
  film_count?: number;
  popularity_score?: number;
  photo_url?: string;
  bio?: string;
  is_verified?: boolean;
}

interface MergePlan {
  clusterName: string;
  canonical: PersonRecord;
  duplicates: PersonRecord[];
}

// Explicit Nollywood Moniker Mappings
const EXPLICIT_CANONICAL_TARGETS: Record<string, string> = {
  'mr latin': 'Bolaji Amusan',
  'mister latin': 'Bolaji Amusan',
  'baba suwe': 'Babatunde Omidina',
  'kemity': 'Kemi Apesin Ariyo',
  'kemi ariyo': 'Kemi Apesin Ariyo',
  'kemi apesin': 'Kemi Apesin Ariyo',
  'sanyeri': 'Olaniyi Afonja',
  'madam saje': 'Fausat Balogun',
  'babawande': 'Kareem Adepoju',
  'lalude': 'Fatai Odua',
  'apa': 'Sanusi Izihaq',
  'sanusi iziaq': 'Sanusi Izihaq',
  'itele d icon': 'Ibrahim Yekini',
  'broda shaggi': 'Samuel Animashaun Perry',
  'kok': 'Kanayo O. Kanayo',
  'kanayo .o kanayo': 'Kanayo O. Kanayo',
  'okele': 'Tunde Usman',
  'mc lively': 'Michael Sani Amanesi',
  'ronke oshodi oke': 'Ronke Ojo',
  'faithia balogun': 'Faithia Williams',
  'fathia williams': 'Faithia Williams',
  'toyin tomato': 'Sola Sobowale',
  'ogogo': 'Taiwo Hassan',
  'taiwo hassan ogogo': 'Taiwo Hassan',
  'saidi balogun': 'Saheed Balogun',
  'oga bello': 'Adebayo Salami',
  'iya rainbow': 'Idowu Philips',
  'mercy johnson okojie': 'Mercy Johnson',
  'chizzy alichi': 'Chizzy Alichi Mbah',
  'stephanie linus': 'Stephanie Okereke',
  'wumi toriola': 'Wunmi Toriola',
  'antar laniya': 'Antar Laniyan',
  'nse ikpe-etim': 'Nse Ikpe Etim',
  'alexx ekubo': 'Alex Ekubo',
  'ritae dochie': 'Rita Edochie',
  'ritaeedochie': 'Rita Edochie',
  'cynthia clark': 'Cynthia Clarke',
  'bigvai jokotoye,': 'Bigvai Jokotoye',
  'wasila coded tv': 'Wasila Coded',
  'mr aloy': 'Mr. Aloy',
  'akinola babatunde': 'Babatunde Akinola',
  'ikechukwu nonso': 'Nonso Ikechukwu',
  'mide m abiodun': 'Mide Abiodun',
  'balogun taiwo': 'Taiwo Balogun',
  'akintunde yusuf': 'Yusuf Akintunde',
  'emmanuel damilare': 'Damilare Emmanuel',
  'aregbesola fuhad': 'Fuhad Aregbesola',
  'adegboyega tunde': 'Tunde Adegboyega',
  'okunola tomi': 'Tomi Okunola',
  'tomi okunola': 'Tomi Okunola',
  'robinson e okolie': 'Robinson Okolie',
  'abdulazeem m ibrahim': 'Abdulazeem Ibrahim',
  'soliu gbolagade': 'Saliu Gbolagade',
  'saliu ogboluke': 'Saliu Gbolagade',
  'saliu gogboluke': 'Saliu Gbolagade',
  'ibrahim yekini bakare': 'Ibrahim Yekini',
  'iteledicon': 'Ibrahim Yekini',
  'ibraheem yekini': 'Ibrahim Yekini',
  'ibrahim yekini itele': 'Ibrahim Yekini',
  'itele dicon': 'Ibrahim Yekini',
  'yekini quadri': 'Quadri Bakare',
  'quadri yekini': 'Quadri Bakare',
};

function normalizeForAliasKey(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
}

async function fetchAllPeople(): Promise<PersonRecord[]> {
  console.log('📦 Fetching all people from database...');
  const pageSize = 1000;
  const batches = [];
  for (let i = 0; i < 14; i++) {
    batches.push(
      supabase
        .from('people')
        .select('id, name, slug, film_count, popularity_score, photo_url, bio, is_verified')
        .range(i * pageSize, (i + 1) * pageSize - 1)
    );
  }
  const results = await Promise.all(batches);
  const all: PersonRecord[] = [];
  for (const r of results) {
    if (r.data) all.push(...(r.data as PersonRecord[]));
  }
  console.log(`Loaded ${all.length} people records.\n`);
  return all;
}

function buildMergePlans(people: PersonRecord[]): MergePlan[] {
  const plans: MergePlan[] = [];
  const processedIds = new Set<string>();

  const nameToPerson = new Map<string, PersonRecord[]>();
  for (const p of people) {
    const raw = (p.name || '').trim().toLowerCase();
    if (!nameToPerson.has(raw)) nameToPerson.set(raw, []);
    nameToPerson.get(raw)!.push(p);
  }

  // 1. Process Explicit Moniker Mappings
  const explicitClusters = new Map<string, Set<PersonRecord>>();
  for (const [sourceLower, targetName] of Object.entries(EXPLICIT_CANONICAL_TARGETS)) {
    const sourceRecords = nameToPerson.get(sourceLower) || [];
    const targetRecords = nameToPerson.get(targetName.toLowerCase()) || [];

    if (sourceRecords.length > 0 && targetRecords.length > 0) {
      const canonical = targetRecords[0];
      const key = canonical.id;
      if (!explicitClusters.has(key)) explicitClusters.set(key, new Set());
      const set = explicitClusters.get(key)!;
      set.add(canonical);
      for (const r of sourceRecords) set.add(r);
      for (const r of targetRecords) set.add(r);
    }
  }

  for (const [canonicalId, clusterSet] of explicitClusters.entries()) {
    const list = Array.from(clusterSet);
    const canonical = list.find(p => p.id === canonicalId)!;
    const dups = list.filter(p => p.id !== canonicalId && !processedIds.has(p.id));
    if (dups.length > 0) {
      plans.push({
        clusterName: `[Moniker] ${canonical.name}`,
        canonical,
        duplicates: dups,
      });
      processedIds.add(canonical.id);
      dups.forEach(d => processedIds.add(d.id));
    }
  }

  // 2. Process Exact Inverted Name Pairs (e.g. "Bolaji Amusan" vs "Amusan Bolaji")
  const tokenSortMap = new Map<string, PersonRecord[]>();
  for (const p of people) {
    if (processedIds.has(p.id)) continue;
    const tokens = (p.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 1);

    if (tokens.length >= 2 && tokens.length <= 3) {
      const key = [...tokens].sort().join(' ');
      if (!tokenSortMap.has(key)) tokenSortMap.set(key, []);
      tokenSortMap.get(key)!.push(p);
    }
  }

  for (const [key, records] of tokenSortMap.entries()) {
    const unproc = records.filter(p => !processedIds.has(p.id));
    if (unproc.length >= 2) {
      // Pick canonical: highest film_count, then verified, then proper Title Case
      unproc.sort((a, b) => {
        const fDiff = (b.film_count || 0) - (a.film_count || 0);
        if (fDiff !== 0) return fDiff;
        if (b.is_verified && !a.is_verified) return 1;
        if (a.is_verified && !b.is_verified) return -1;
        // Prefer Title Case over ALL CAPS
        const isUpperA = a.name === a.name.toUpperCase();
        const isUpperB = b.name === b.name.toUpperCase();
        if (isUpperA && !isUpperB) return 1;
        if (!isUpperA && isUpperB) return -1;
        return 0;
      });

      const canonical = unproc[0];
      const dups = unproc.slice(1);
      plans.push({
        clusterName: `[Inversion] ${key}`,
        canonical,
        duplicates: dups,
      });
      processedIds.add(canonical.id);
      dups.forEach(d => processedIds.add(d.id));
    }
  }

  // 3. Process Punctuation / Formatting Duplicates (e.g. "Wasila Coded Tv" vs "Wasila Coded")
  const normMap = new Map<string, PersonRecord[]>();
  for (const p of people) {
    if (processedIds.has(p.id)) continue;
    const norm = (p.name || '')
      .toLowerCase()
      .trim()
      .replace(/^((chief|prince|dr\.?|alhaji|alhaja|pastor|evang\.?|rev\.?|mrs?\.?|miss)\s+)+/i, '')
      .replace(/\s+(official|tv|comedy|mfr|mon)$/i, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (norm.length >= 5) {
      if (!normMap.has(norm)) normMap.set(norm, []);
      normMap.get(norm)!.push(p);
    }
  }

  for (const [norm, records] of normMap.entries()) {
    const unproc = records.filter(p => !processedIds.has(p.id));
    if (unproc.length >= 2) {
      unproc.sort((a, b) => (b.film_count || 0) - (a.film_count || 0));
      const canonical = unproc[0];
      const dups = unproc.slice(1);
      plans.push({
        clusterName: `[Punctuation/Prefix] ${norm}`,
        canonical,
        duplicates: dups,
      });
      processedIds.add(canonical.id);
      dups.forEach(d => processedIds.add(d.id));
    }
  }

  return plans;
}

async function executeMerge(plan: MergePlan) {
  const canonical = plan.canonical;

  for (const dup of plan.duplicates) {
    console.log(`  🔄 Merging "${dup.name}" (ID: ${dup.id}, ${dup.film_count || 0} films) -> "${canonical.name}" (ID: ${canonical.id})`);

    // 1. Add alias into person_aliases
    const aliasKey = normalizeForAliasKey(dup.name);
    if (aliasKey && aliasKey !== normalizeForAliasKey(canonical.name)) {
      const { data: existingAlias } = await supabase
        .from('person_aliases')
        .select('id')
        .eq('person_id', canonical.id)
        .eq('alias_key', aliasKey)
        .limit(1);

      if (!existingAlias || existingAlias.length === 0) {
        const { error: insAliasErr } = await supabase.from('person_aliases').insert({
          person_id: canonical.id,
          alias: dup.name.trim(),
          source: 'duplicate_merge',
        });
        if (insAliasErr) {
          console.warn(`    ⚠️ Alias insert warning for "${dup.name}":`, insAliasErr.message);
        } else {
          console.log(`    🏷️ Added alias: "${dup.name}" -> ${canonical.name}`);
        }
      }
    }

    // Extra aliases associated with canonical
    const EXTRA_ALIASES_MAP: Record<string, string[]> = {
      'saliu gbolagade': ['Soliudeen Gbolagade'],
      'ibrahim yekini': [
        'Ibrahim Yekini Bakare',
        'Itele',
        'Itele D Icon',
        'Itele d\'Icon',
        'Iteledicon',
        'Itele Dicon',
        'Ibrahim Yekini Itele',
        'Ibraheem Yekini',
        'Kesari',
      ],
      'quadri bakare': ['Yekini Quadri', 'Quadri Yekini'],
    };
    const extraList = EXTRA_ALIASES_MAP[canonical.name.toLowerCase()] || [];
    for (const extraAlias of extraList) {
      const key = normalizeForAliasKey(extraAlias);
      const { data: existing } = await supabase
        .from('person_aliases')
        .select('id')
        .eq('person_id', canonical.id)
        .eq('alias_key', key)
        .maybeSingle();
      if (!existing) {
        await supabase.from('person_aliases').insert({
          person_id: canonical.id,
          alias: extraAlias,
          source: 'moniker_alias',
        });
        console.log(`    🏷️ Added extra alias: "${extraAlias}" -> ${canonical.name}`);
      }
    }

    // Also re-point any existing person_aliases pointing to dup.id
    const { data: dupAliases } = await supabase
      .from('person_aliases')
      .select('id, alias, alias_key')
      .eq('person_id', dup.id);

    for (const a of dupAliases || []) {
      await supabase
        .from('person_aliases')
        .update({ person_id: canonical.id })
        .eq('id', a.id);
      console.log(`    🏷️ Re-pointed existing alias "${a.alias}" to canonical profile.`);
    }

    // 2. Transfer Credits
    const { data: dupCredits } = await supabase
      .from('credits')
      .select('id, film_id, role, character_name, billing_order')
      .eq('person_id', dup.id);

    if (dupCredits && dupCredits.length > 0) {
      // Find films where canonical is already credited
      const filmIds = dupCredits.map(c => c.film_id);
      const { data: canonicalCredits } = await supabase
        .from('credits')
        .select('film_id')
        .eq('person_id', canonical.id)
        .in('film_id', filmIds);

      const alreadyCreditedFilms = new Set((canonicalCredits || []).map(c => c.film_id));

      for (const credit of dupCredits) {
        if (alreadyCreditedFilms.has(credit.film_id)) {
          // Canonical is already credited on this film; safely remove redundant duplicate credit
          await supabase.from('credits').delete().eq('id', credit.id);
        } else {
          // Re-point credit to canonical person
          await supabase
            .from('credits')
            .update({ person_id: canonical.id })
            .eq('id', credit.id);
          alreadyCreditedFilms.add(credit.film_id);
        }
      }
      console.log(`    🎬 Transferred/reconciled ${dupCredits.length} credit rows.`);
    }

    // 3. Re-point profile_claims if any
    await supabase
      .from('profile_claims')
      .update({ person_id: canonical.id })
      .eq('person_id', dup.id);

    // 4. Enrich canonical metadata if missing
    const updates: Record<string, any> = {};
    if (!canonical.photo_url && dup.photo_url) updates.photo_url = dup.photo_url;
    if (!canonical.bio && dup.bio) updates.bio = dup.bio;
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', canonical.id);
    }

    // 5. Delete duplicate person record
    const { error: delErr } = await supabase.from('people').delete().eq('id', dup.id);
    if (delErr) {
      console.error(`    ❌ Failed to delete duplicate person ${dup.id}:`, delErr.message);
    } else {
      console.log(`    🗑️ Deleted redundant duplicate person profile: "${dup.name}"`);
    }
  }

  // 6. Recalculate accurate film_count on canonical person
  const { count: actualFilmCount } = await supabase
    .from('credits')
    .select('film_id', { count: 'exact', head: true })
    .eq('person_id', canonical.id);

  if (actualFilmCount !== undefined && actualFilmCount !== canonical.film_count) {
    await supabase.from('people').update({ film_count: actualFilmCount }).eq('id', canonical.id);
    console.log(`    📈 Updated canonical film_count: ${canonical.film_count || 0} -> ${actualFilmCount}`);
  }
}

async function main() {
  console.log(`🚀 Starting Actor Duplication Safe Merge (Mode: ${isDryRun ? 'DRY-RUN PREVIEW' : 'LIVE MERGE'})...\n`);

  const people = await fetchAllPeople();
  const plans = buildMergePlans(people);

  console.log(`================================================================`);
  console.log(`Found ${plans.length} duplicate clusters planned for safe merge:`);
  console.log(`================================================================`);

  let totalDups = 0;
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    totalDups += p.duplicates.length;
    console.log(`[${i + 1}/${plans.length}] ${p.clusterName}`);
    console.log(`  ⭐ Canonical: "${p.canonical.name}" (ID: ${p.canonical.id}, Films: ${p.canonical.film_count || 0})`);
    for (const d of p.duplicates) {
      console.log(`  ❌ Duplicate: "${d.name}" (ID: ${d.id}, Films: ${d.film_count || 0})`);
    }
  }

  console.log(`\nTotal duplicate profiles to merge into canonical records: ${totalDups}\n`);

  if (isDryRun) {
    console.log('✅ DRY-RUN COMPLETE. No changes made to database.');
    return;
  }

  console.log('⏳ Executing Live Safe Merges in Supabase...');
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    console.log(`\nProcessing [${i + 1}/${plans.length}]: ${plan.clusterName}`);
    await executeMerge(plan);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL SAFE MERGES COMPLETED SUCCESSFULLY!');
  console.log(`  • Merged Clusters: ${plans.length}`);
  console.log(`  • Redundant Profiles Merged & Removed: ${totalDups}`);
  console.log('================================================================\n');
}

main().catch(console.error);
