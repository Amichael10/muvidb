import { supabase } from './lib/db';

async function main() {
  const { data: people } = await supabase.from('people').select('awards').not('awards', 'eq', '[]');
  const { data: films } = await supabase.from('films').select('awards').not('awards', 'eq', '[]');

  const orgCategories = new Map<string, Set<string>>();

  const add = (org: string, cat: string) => {
    if (!org || !cat) return;
    const cleanOrg = org.trim().toUpperCase();
    const cleanCat = cat.trim();
    if (!cleanCat) return;
    if (!orgCategories.has(cleanOrg)) orgCategories.set(cleanOrg, new Set());
    orgCategories.get(cleanOrg)!.add(cleanCat);
  };

  for (const p of people || []) {
    for (const a of p.awards || []) {
      add(a.organization, a.category || a.title);
    }
  }

  for (const f of films || []) {
    for (const a of f.awards || []) {
      add(a.organization, a.category || a.title);
    }
  }

  const result: Record<string, string[]> = {};
  for (const [org, cats] of orgCategories.entries()) {
    result[org] = Array.from(cats).sort();
  }

  console.log('Known categories per org:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
