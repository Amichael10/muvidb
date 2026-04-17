const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = 'sb_publishable_z8vTS60VmKgpsh1NiBnWDA_ed6ajgRJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: films, error: filmError } = await supabase.from('films').select('id, title');
  const { data: people, error: peopleError } = await supabase.from('people').select('id, name');
  const { data: cinemas, error: cinemaError } = await supabase.from('cinemas').select('id, name');

  console.log('--- Database Check ---');
  console.log('Films count:', films?.length);
  console.log('Films error:', filmError?.message);
  console.log('People count:', people?.length);
  console.log('Cinemas count:', cinemas?.length);
  
  if (films?.length > 0) {
    console.log('First film:', films[0].title);
  }
}

check();
