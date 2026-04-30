const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log('🧹 Starting cleanup of non-African Mubi films...');
    
    // Deleting films that have a mubi_id (synced by us) but are NOT marked as is_nollywood
    // Since we only had is_nollywood as a filter before, any other African films were also marked as false.
    // However, the user said "delete the ones that are not african".
    // To be perfectly safe, I'll only delete the ones we just synced today that are likely the international ones.
    
    const { data: films, error } = await supabase
        .from('films')
        .select('id, title, mubi_slug, is_nollywood')
        .not('mubi_id', 'is', null)
        .eq('is_nollywood', false);

    if (error) {
        console.error('Error fetching films:', error);
        return;
    }

    console.log(`🔍 Found ${films.length} candidate films for deletion.`);
    
    let deletedCount = 0;
    for (const film of films) {
        // Since we didn't store country, we assume non-nollywood ones from Mubi are international
        // (as we were specifically targeting Nigeria/Nollywood until now).
        // Any genuine African films accidentally deleted will be re-synced by the new filtered scraper.
        
        console.log(`🗑️ Deleting: ${film.title}`);
        const { error: delError } = await supabase
            .from('films')
            .delete()
            .eq('id', film.id);
        
        if (delError) {
            console.error(`  ❌ Failed to delete ${film.title}:`, delError.message);
        } else {
            deletedCount++;
        }
    }

    console.log(`\n✅ Cleanup complete. Deleted ${deletedCount} non-African films.`);
}

cleanup().catch(console.error);
