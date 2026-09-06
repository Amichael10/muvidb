import fs from 'fs';

const breakdown = JSON.parse(fs.readFileSync('unattached_films_channel_breakdown.json', 'utf8'));

console.log('Total Scanned Movies:', breakdown.total_scanned);
console.log('Active DB Channel Groups:', breakdown.active_channel_groups_count);
console.log('Deleted / Untracked Groups:', breakdown.untracked_deleted_groups_count);

const deletedOrUntracked = breakdown.groups.filter((g: any) => !g.is_active_in_db);
const activeInDb = breakdown.groups.filter((g: any) => g.is_active_in_db);

const totalMoviesInDeletedChannels = deletedOrUntracked.reduce((acc: number, g: any) => acc + g.count, 0);
const totalMoviesInActiveChannels = activeInDb.reduce((acc: number, g: any) => acc + g.count, 0);

console.log('Total Movies in Deleted / Untracked Channels:', totalMoviesInDeletedChannels);
console.log('Total Movies in Active Channels (Unlinked):', totalMoviesInActiveChannels);

console.log('\n=========================================');
console.log('TOP 40 DELETED / UNTRACKED CHANNELS');
console.log('=========================================');
deletedOrUntracked.slice(0, 40).forEach((g: any, i: number) => {
  const sample = g.sample_films[0]?.title ? ` (e.g. "${g.sample_films[0].title}")` : '';
  console.log(`${i + 1}. [${g.count} movies] ${g.channel_name}${sample}`);
});

console.log('\n=========================================');
console.log('TOP 20 ACTIVE CHANNELS (UNLINKED MOVIES)');
console.log('=========================================');
activeInDb.slice(0, 20).forEach((g: any, i: number) => {
  const sample = g.sample_films[0]?.title ? ` (e.g. "${g.sample_films[0].title}")` : '';
  console.log(`${i + 1}. [${g.count} movies] ${g.channel_name}${sample}`);
});
