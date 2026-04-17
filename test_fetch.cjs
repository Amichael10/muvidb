const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = 'sb_publishable_z8vTS60VmKgpsh1NiBnWDA_ed6ajgRJ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      people!fk_users_linked_profile(name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('ERROR:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS, fetched:', data?.length);
  }
}
test();
