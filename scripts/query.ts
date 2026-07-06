// Generic read-only DB inspector. Replaces the one-off check_*/inspect_*/find_*
// scripts — do not create new ones; use this or a throwaway script in scratch/.
//
// Usage:
//   npm run db -- <table> [options]
//   npx tsx scripts/query.ts <table> [options]
//
// Options:
//   --select <cols>        Columns, PostgREST syntax (default: *)
//   --where <filter>       PostgREST filter, repeatable: year=eq.2024, title=ilike.*love*
//   --order <col[.desc]>   Sort (default: none)
//   --limit <n>            Row limit (default: 20)
//   --count                Print row count only (respects --where)
//
// Examples:
//   npm run db -- films --select id,title,year --order created_at.desc --limit 10
//   npm run db -- films --where year=eq.2024 --where country=eq.NG --count
//   npm run db -- people --where name=ilike.*adesua* --select id,name,slug
//   npm run db -- films --select "id,title,credits(person_id,role)" --limit 5
import { supabase } from './lib/db';

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('--')) {
  fail(
    'Usage: npm run db -- <table> [--select cols] [--where col=op.value]... [--order col.desc] [--limit n] [--count]'
  );
}

const table = args[0];
let select = '*';
const wheres: string[] = [];
let order: string | undefined;
let limit = 20;
let countOnly = false;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  const next = () => args[++i] ?? fail(`Missing value after ${a}`);
  if (a === '--select') select = next();
  else if (a === '--where') wheres.push(next());
  else if (a === '--order') order = next();
  else if (a === '--limit') limit = parseInt(next(), 10);
  else if (a === '--count') countOnly = true;
  else fail(`Unknown option: ${a}`);
}

async function run() {
  let q = supabase
    .from(table)
    .select(countOnly ? '*' : select, countOnly ? { count: 'exact', head: true } : {});

  for (const w of wheres) {
    const eq = w.indexOf('=');
    if (eq === -1) fail(`Bad --where "${w}" — expected col=op.value (e.g. year=eq.2024)`);
    const col = w.slice(0, eq);
    const rest = w.slice(eq + 1);
    const dot = rest.indexOf('.');
    if (dot === -1) fail(`Bad --where "${w}" — missing operator (e.g. eq., ilike., in.)`);
    q = q.filter(col, rest.slice(0, dot), rest.slice(dot + 1));
  }

  if (!countOnly) {
    if (order) {
      const desc = order.endsWith('.desc');
      const col = order.replace(/\.(asc|desc)$/, '');
      q = q.order(col, { ascending: !desc });
    }
    q = q.limit(limit);
  }

  const { data, error, count } = await q;
  if (error) fail(`${error.code ?? ''} ${error.message}${error.hint ? `\nhint: ${error.hint}` : ''}`);

  if (countOnly) console.log(count);
  else {
    console.log(JSON.stringify(data, null, 2));
    console.error(`\n(${data?.length ?? 0} rows)`);
  }
}

run();
