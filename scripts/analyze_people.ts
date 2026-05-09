
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePeople() {
  console.log('--- People Analysis ---');
  
  // Get all people names
  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, created_at');

  if (error) {
    console.error('Error fetching people:', error);
    return;
  }

  console.log(`Total people in DB: ${people?.length}`);

  // Group by normalized name
  const normalizedGroups = new Map<string, any[]>();
  people?.forEach(p => {
    const norm = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalizedGroups.has(norm)) {
      normalizedGroups.set(norm, []);
    }
    normalizedGroups.get(norm)!.push(p);
  });

  let duplicateCount = 0;
  let groupCount = 0;
  normalizedGroups.forEach((members, name) => {
    if (members.length > 1) {
      duplicateCount += (members.length - 1);
      groupCount++;
      if (groupCount < 10) {
        console.log(`Duplicate group: "${name}" (${members.length} members)`);
      }
    }
  });

  console.log(`Total duplicate groups: ${groupCount}`);
  console.log(`Total duplicate records to remove: ${duplicateCount}`);

  // Check recent additions
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count: recentCount } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);
    
  console.log(`People added in the last hour: ${recentCount}`);

  console.log('--- End Analysis ---');
}

analyzePeople();
