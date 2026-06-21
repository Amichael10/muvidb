import * as dotenv from 'dotenv';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

dotenv.config({ path: '.env.local' });
dotenv.config();
