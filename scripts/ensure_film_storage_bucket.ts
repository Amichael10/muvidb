import { supabase } from './lib/db';

async function main() {
  console.log('Checking storage buckets...');
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('List buckets error:', error);
    return;
  }

  const existing = new Set((buckets || []).map(b => b.name));
  console.log('Existing buckets:', [...existing]);

  const targetBuckets = [
    { name: 'film-media', public: true, fileSizeLimit: 20971520 }, // 20MB
    { name: 'posters', public: true, fileSizeLimit: 10485760 },
    { name: 'backdrops', public: true, fileSizeLimit: 20971520 }
  ];

  for (const tb of targetBuckets) {
    if (!existing.has(tb.name)) {
      console.log(`Creating bucket "${tb.name}"...`);
      const { data, error: cErr } = await supabase.storage.createBucket(tb.name, {
        public: tb.public,
        fileSizeLimit: tb.fileSizeLimit,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4']
      });
      if (cErr) console.warn(`Failed to create ${tb.name}:`, cErr.message);
      else console.log(`✅ Created bucket "${tb.name}"!`);
    } else {
      console.log(`Bucket "${tb.name}" already exists.`);
    }
  }
}

main().catch(console.error);
