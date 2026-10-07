import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { generateQueueBatch } from '../api/_lib/outreach_generator.js';

interface CliArgs {
  limit: number;
  craft?: string;
  minFilms: number;
  maxFilms: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit = 10;
  let craft: string | undefined = undefined;
  let minFilms = 1;
  let maxFilms = 15;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 10;
      i++;
    } else if (a.startsWith('--limit=')) {
      limit = parseInt(a.split('=')[1], 10) || 10;
    } else if (a === '--craft' && args[i + 1]) {
      craft = args[i + 1];
      i++;
    } else if (a.startsWith('--craft=')) {
      craft = a.split('=')[1];
    } else if (a.startsWith('--min=')) {
      minFilms = parseInt(a.split('=')[1], 10) || 1;
    } else if (a.startsWith('--max=')) {
      maxFilms = parseInt(a.split('=')[1], 10) || 15;
    }
  }

  return { limit, craft, minFilms, maxFilms };
}

async function main() {
  const { limit, craft, minFilms, maxFilms } = parseArgs();

  console.log('========================================================');
  console.log('🎯 MUVIDB TALENT SELECTOR & QUEUE GENERATOR');
  console.log('========================================================');
  console.log(`Target Craft: ${craft || 'All Departments (Actors, Directors, Crew)'}`);
  console.log(`Film Range:   ${minFilms} to ${maxFilms} films`);
  console.log(`Batch Size:   ${limit} talents`);
  console.log('--------------------------------------------------------');
  console.log('Scanning database for uncontacted talents with Instagram IDs...');

  try {
    const result = await generateQueueBatch({
      limit,
      craft,
      minFilms,
      maxFilms,
    });

    if (result.queued === 0) {
      console.log('\n⚠️ No new eligible uncontacted talents found matching these filters.');
      console.log('Tip: Try broadening your filters with --max=25 or use the Admin Studio at /admin/outreach');
      return;
    }

    console.log(`\n🎉 Successfully selected and queued ${result.queued} talents!\n`);

    for (let i = 0; i < result.candidates.length; i++) {
      const c = result.candidates[i];
      console.log(`${i + 1}. ${c.name} (${c.instagram_handle})`);
      console.log(`   Dept: ${c.known_for_department} | Credits: ${c.film_count} films`);
      if (c.highlight_films?.length) {
        console.log(`   Films Mentioned: ${c.highlight_films.join(', ')}`);
      }
      console.log(`   Profile: ${c.profile_url}`);
      console.log('--------------------------------------------------------');
    }

    console.log('\n✅ These talents are now staged in the outreach queue (status: queued).');
    console.log('👉 Next step: Run `npm run outreach:worker` (or `npm run outreach:worker -- --dry-run` to preview)');
  } catch (err: any) {
    console.error('\n❌ Failed to select talents:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
