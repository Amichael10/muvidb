
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

async function diagnose() {
  console.log('--- Database Diagnosis ---');
  
  // Count total films
  const { count: totalFilms, error: countError } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true });
    
  if (countError) console.error('Error counting films:', countError);
  console.log('Total Films:', totalFilms);

  // Count films missing critical data
  const { count: missingDataFilms, error: missingError } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .or('synopsis.is.null,poster_url.is.null');
    
  if (missingError) console.error('Error counting missing data films:', missingError);
  console.log('Films missing synopsis or poster:', missingDataFilms);

  // Count total people
  const { count: totalPeople, error: peopleCountError } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true });
    
  if (peopleCountError) console.error('Error counting people:', peopleCountError);
  console.log('Total People:', totalPeople);

  // Check for "FilmFlux" or "IrokoTV" names in people
  const { data: badPeople, error: badPeopleError } = await supabase
    .from('people')
    .select('name')
    .or('name.ilike.%filmflux%,name.ilike.%irokotv%,name.ilike.%actor%');
    
  if (badPeopleError) console.error('Error checking bad people:', badPeopleError);
  console.log('Bad names in people table:', badPeople?.length || 0);
  if (badPeople && badPeople.length > 0) {
    console.log('Sample bad names:', badPeople.slice(0, 5).map(p => p.name));
  }

  // Count total credits
  const { count: totalCredits, error: creditsError } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true });
    
  if (creditsError) console.error('Error counting credits:', creditsError);
  console.log('Total Credits:', totalCredits);

  console.log('--- End Diagnosis ---');
}

diagnose();
