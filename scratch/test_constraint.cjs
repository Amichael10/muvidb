const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testConstraint() {
  console.log('Attempting to insert film with empty source_video_id...');
  const { data, error } = await supabase
    .from('films')
    .insert([{ title: 'Constraint Test', source_video_id: '' }]);

  if (error) {
    console.log('Success: Constraint blocked empty string. Error:', error.message);
  } else {
    console.error('Failure: Constraint did NOT block empty string.');
    // Clean up if it failed (meaning it was inserted)
    if (data) {
        await supabase.from('films').delete().eq('id', data[0].id);
    }
  }
}

testConstraint();
