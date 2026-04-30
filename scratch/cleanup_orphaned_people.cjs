const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupOrphans() {
    console.log('Fetching people with mubi_slug...');
    
    // 1. Get all people with a mubi_slug
    const { data: people, error: fetchError } = await supabase
        .from('people')
        .select('id, name')
        .not('mubi_slug', 'is', null);

    if (fetchError) {
        console.error('Error fetching people:', fetchError);
        return;
    }

    console.log(`Found ${people.length} people with mubi_slug.`);
    
    let deletedCount = 0;
    
    // 2. Check each person to see if they have any credits
    for (const person of people) {
        const { count, error: countError } = await supabase
            .from('credits')
            .select('*', { count: 'exact', head: true })
            .eq('person_id', person.id);
            
        if (countError) {
            console.error(`Error checking credits for ${person.name}:`, countError);
            continue;
        }
        
        if (count === 0) {
            // Orphan found! Delete them.
            console.log(`Deleting orphan: ${person.name} (${person.id})`);
            const { error: deleteError } = await supabase
                .from('people')
                .delete()
                .eq('id', person.id);
                
            if (deleteError) {
                console.error(`Failed to delete ${person.name}:`, deleteError);
            } else {
                deletedCount++;
            }
        }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedCount} orphaned people.`);
}

cleanupOrphans().catch(console.error);
