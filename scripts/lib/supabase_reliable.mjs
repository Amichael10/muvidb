import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Agent, setGlobalDispatcher } from 'undici';
import dns from 'node:dns/promises';

// Configure DNS to use reliable external resolvers
dns.setServers(['8.8.8.8', '1.1.1.1']);

const agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.resolve4(hostname).then(addresses => {
        if (options && options.all) {
          callback(null, addresses.map(a => ({ address: a, family: 4 })));
        } else {
          callback(null, addresses[0], 4);
        }
      }).catch(err => callback(err));
    },
    timeout: 30000
  },
  headersTimeout: 30000,
  bodyTimeout: 30000
});

setGlobalDispatcher(agent);

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Service Role Key in .env / .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
