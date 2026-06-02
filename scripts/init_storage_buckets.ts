import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function init() {
  console.log('🚀 Initializing Supabase Storage Buckets...');
  
  const buckets = ['posters', 'people', 'backdrops'];
  
  try {
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const existingNames = new Set((existingBuckets || []).map(b => b.name));

    for (const bucket of buckets) {
      if (existingNames.has(bucket)) {
        console.log(`  ✓ Bucket "${bucket}" already exists.`);
      } else {
        console.log(`  📦 Creating public bucket "${bucket}"...`);
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: 10485760 // 10MB limit
        });

        if (createError) {
          console.error(`  ❌ Failed to create "${bucket}":`, createError.message);
        } else {
          console.log(`  ✓ Bucket "${bucket}" successfully created programmatically!`);
        }
      }
    }
    console.log('\n🎉 Storage bucket initialization completed successfully!');
  } catch (err: any) {
    console.error('💥 Critical Error initializing buckets:', err.message);
  }
}

init().catch(console.error);
