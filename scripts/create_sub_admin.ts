import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const email = 'hellojosiah1@gmail.com';
const password = 'Admin1234';
const role = 'admin_limited';

async function main() {
  console.log(`Starting sub-admin creation for: ${email}`);

  // 1. Create or retrieve the user
  console.log('Checking if user already exists or creating new user...');
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { role, full_name: 'Josiah Sub-Admin' }
  });

  let userId: string;

  if (createError) {
    if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
      console.log('User already exists in Auth. Retrieving user ID...');
      // Find the user by listing users
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        throw new Error(`Failed to list users: ${listError.message}`);
      }

      const existingUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!existingUser) {
        throw new Error(`Could not find existing user with email ${email} even though creation failed.`);
      }

      userId = existingUser.id;
      console.log(`Found existing user with ID: ${userId}. Updating password and metadata...`);

      // Update password & metadata for existing user
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        app_metadata: { role },
        user_metadata: { role }
      });

      if (updateAuthError) {
        throw new Error(`Failed to update auth user: ${updateAuthError.message}`);
      }
      console.log('Auth user password and metadata updated successfully.');
    } else {
      throw new Error(`Failed to create user in Auth: ${createError.message}`);
    }
  } else {
    userId = createData.user.id;
    console.log(`Created new Auth user with ID: ${userId}`);
  }

  // 2. Ensure the user exists in public.users with correct role
  console.log('Ensuring user exists in public.users database table...');
  const { data: dbUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is code for "no rows returned"
    console.warn(`Warning selecting from public.users: ${selectError.message}`);
  }

  if (!dbUser) {
    console.log('User not found in public.users. Inserting new record...');
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        name: 'Josiah Sub-Admin',
        role
      });

    if (insertError) {
      throw new Error(`Failed to insert into public.users: ${insertError.message}`);
    }
    console.log('Successfully inserted user into public.users.');
  } else {
    console.log('User found in public.users. Updating role and details...');
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email,
        name: dbUser.name || 'Josiah Sub-Admin',
        role
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update public.users: ${updateError.message}`);
    }
    console.log('Successfully updated role in public.users.');
  }

  console.log(`\n🎉 Success! Sub-admin account has been successfully configured:`);
  console.log(`- Email: ${email}`);
  console.log(`- Password: ${password}`);
  console.log(`- Role: ${role}`);
}

main().catch(err => {
  console.error('\n❌ Error creating sub-admin:', err.message || err);
  process.exit(1);
});
