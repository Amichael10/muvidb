/**
 * Move production-company-shaped people into companies + film_companies.
 *
 * Detects names like "X Films", "X Productions", "X Studios", etc.
 * Links their credit films as production companies, then deletes the person.
 *
 *   npx tsx scripts/people_to_companies.ts
 *   npx tsx scripts/people_to_companies.ts --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from './lib/db';

const APPLY = process.argv.includes('--apply');
const OUT = path.join('scratch', 'people-dedupe', 'people-to-companies.json');

type Person = {
  id: string;
  name: string;
  source: string | null;
  film_count: number | null;
  photo_url: string | null;
  bio: string | null;
  claimed_by: string | null;
  is_verified: boolean | null;
  is_spotlight: boolean | null;
};

function foldName(value: string) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function makeSlug(text: string) {
  return foldName(text).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 80) || 'company';
}

function cleanCompanyName(name: string) {
  return String(name || '')
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[,\s]+$/g, '')
    .trim();
}

/** Strong company patterns — avoid obvious person/crew false positives. */
function looksLikeCompany(rawName: string): boolean {
  const name = cleanCompanyName(rawName);
  if (!name || name.length < 3) return false;

  // Crew / role junk that mentions studio/production
  if (/^(production assistants?|cast|crew|extras?|camera|gaffer|makeup|continuity)\b/i.test(name)) {
    return false;
  }
  if (/\b(vision mixer|studio engr|casting)\b/i.test(name)) return false;

  // Person name with "(Some Studio)" — keep as person
  const withoutParens = name.replace(/\(.*$/, '').trim();
  if (
    /\([^)]*(studio|production|films|pictures)[^)]*\)\s*$/i.test(name)
    && /^[\p{L}'’.\-]+\s+[\p{L}'’.\-]+/u.test(withoutParens)
  ) {
    return false;
  }
  // "First Last (phone/handle)" style with studio keyword elsewhere — still a person if 2+ name tokens before (
  if (/\(.*studio.*\)/i.test(name) && withoutParens.split(/\s+/).length >= 2) {
    return false;
  }

  // Strong endings / tokens
  if (/\b(productions?|studios?|pictures|entertainment)\b/i.test(name)) return true;
  if (/\bfilms\b/i.test(name) && !/\bfilm\s+(festival|award|critic)/i.test(name)) return true;
  if (/\b(media|movie houses?|film houses?)\b/i.test(name)) return true;

  return false;
}

async function uniqueCompanySlug(base: string) {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.from('companies').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function matchOrCreateCompany(person: Person) {
  const name = cleanCompanyName(person.name);
  const folded = foldName(name);

  // Exact / ilike match first
  const { data: exact } = await supabase
    .from('companies')
    .select('id,name,slug,logo_url')
    .ilike('name', name)
    .limit(5);
  if (exact?.length) {
    const best = exact.find((c) => foldName(c.name) === folded) || exact[0];
    return { companyId: best.id as string, created: false, name: best.name as string };
  }

  // Fuzzy-ish: contains cleaned core
  const core = name.replace(/\b(productions?|studios?|films?|pictures|entertainment|media)\b/gi, '').trim();
  if (core.length >= 4) {
    const { data: fuzzy } = await supabase
      .from('companies')
      .select('id,name,slug')
      .ilike('name', `%${core}%`)
      .limit(10);
    const hit = (fuzzy || []).find((c) => foldName(c.name) === folded);
    if (hit) return { companyId: hit.id as string, created: false, name: hit.name as string };
  }

  if (!APPLY) {
    return { companyId: `dry-${person.id}`, created: true, name };
  }

  const slug = await uniqueCompanySlug(makeSlug(name));
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name,
      slug,
      logo_url: person.photo_url || null,
      description: person.bio || null,
      company_type: 'production',
    })
    .select('id,name')
    .single();
  if (error) throw new Error(`create company "${name}": ${error.message}`);
  return { companyId: data.id as string, created: true, name: data.name as string };
}

async function main() {
  console.log(`People → companies  dry=${!APPLY}`);

  const pageSize = 1000;
  let from = 0;
  const people: Person[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from('people')
      .select('id,name,source,film_count,photo_url,bio,claimed_by,is_verified,is_spotlight')
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    people.push(...(data as Person[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const candidates = people.filter(
    (p) => looksLikeCompany(p.name) && !p.claimed_by && !p.is_verified && !p.is_spotlight,
  );
  console.log(`Scanned ${people.length} people → ${candidates.length} company-like`);

  type Plan = {
    personId: string;
    personName: string;
    source: string | null;
    filmCount: number;
    companyId: string;
    companyName: string;
    companyCreated: boolean;
    filmsLinked: number;
    deletedPerson: boolean;
  };

  const plans: Plan[] = [];
  let companiesCreated = 0;
  let companiesMatched = 0;
  let filmsLinked = 0;
  let peopleDeleted = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i++) {
    const person = candidates[i];
    try {
      const company = await matchOrCreateCompany(person);
      if (company.created) companiesCreated++;
      else companiesMatched++;

      // Films this "person" is credited on
      const { data: credits, error: cErr } = await supabase
        .from('credits')
        .select('film_id')
        .eq('person_id', person.id);
      if (cErr) throw cErr;
      const filmIds = [...new Set((credits || []).map((c) => c.film_id).filter(Boolean))];

      let linked = 0;
      if (APPLY && filmIds.length) {
        for (const filmId of filmIds) {
          const { data: existing } = await supabase
            .from('film_companies')
            .select('film_id')
            .eq('film_id', filmId)
            .eq('company_id', company.companyId)
            .eq('role', 'production')
            .maybeSingle();
          if (existing) {
            linked++;
            continue;
          }
          const { error } = await supabase.from('film_companies').insert({
            film_id: filmId,
            company_id: company.companyId,
            role: 'production',
          });
          if (error && !/duplicate|unique/i.test(error.message)) throw error;
          linked++;
        }
      } else {
        linked = filmIds.length;
      }
      filmsLinked += linked;

      let deleted = false;
      if (APPLY) {
        await supabase.from('credits').delete().eq('person_id', person.id);
        await supabase.from('people').update({ mubi_slug: null }).eq('id', person.id);
        const { error: dErr } = await supabase.from('people').delete().eq('id', person.id);
        if (dErr) throw dErr;
        deleted = true;
        peopleDeleted++;
      }

      plans.push({
        personId: person.id,
        personName: person.name,
        source: person.source,
        filmCount: Number(person.film_count || 0),
        companyId: company.companyId,
        companyName: company.name,
        companyCreated: company.created,
        filmsLinked: linked,
        deletedPerson: deleted,
      });

      if ((i + 1) % 25 === 0 || i === candidates.length - 1) {
        console.log(`  ${i + 1}/${candidates.length} (created=${companiesCreated} matched=${companiesMatched})`);
      }
    } catch (e: any) {
      errors++;
      console.warn(`  ❌ ${person.name}: ${e.message}`);
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        dryRun: !APPLY,
        generatedAt: new Date().toISOString(),
        candidates: candidates.length,
        companiesCreated,
        companiesMatched,
        filmsLinked,
        peopleDeleted,
        errors,
        sample: plans.slice(0, 40),
        plans,
      },
      null,
      2,
    ),
  );

  console.log('\n────────────────────────────');
  console.log(`Company-like people: ${candidates.length}`);
  console.log(`Companies created: ${companiesCreated}`);
  console.log(`Companies matched: ${companiesMatched}`);
  console.log(`Film links: ${filmsLinked}`);
  console.log(`People deleted: ${peopleDeleted}`);
  console.log(`Errors: ${errors}`);
  console.log(`Plan: ${OUT}`);
  for (const p of plans.slice(0, 15)) {
    console.log(
      `  ${p.companyCreated ? '+' : '='} ${p.companyName} ← ${p.personName} (${p.filmsLinked} films)`,
    );
  }
  if (!APPLY) console.log('\nDry-run only. Re-run with --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
