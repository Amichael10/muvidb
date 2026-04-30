const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConstraints() {
  const { data, error } = await supabase.rpc('get_table_constraints', { t_name: 'films' });
  
  // Since get_table_constraints might not exist, let's use a raw query if possible or just inspect the table via a common RPC if available.
  // Actually, let's try to fetch one row and see the columns, and maybe try to insert a duplicate to see what happens.
  
  // Alternative: use a query to pg_constraint
  const { data: constraints, error: cError } = await supabase.rpc('execute_sql', { 
    sql: "SELECT conname, contype, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'films'::regclass;" 
  });

  if (cError) {
    console.error('Error fetching constraints:', cError);
    // If execute_sql doesn't exist, we can't do much here without knowing the RPCs.
  } else {
    console.log('Constraints for films table:');
    console.log(JSON.stringify(constraints, null, 2));
  }
}

checkConstraints();
