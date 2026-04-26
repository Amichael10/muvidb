import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZW5ybW9yeXdtdXZuemZveWxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIyODE1NCwiZXhwIjoyMDkwODA0MTU0fQ.yy7yeue7zZe6nsa-UmZUiPtw0tjF_6QgdA4rsLBLYEE' // SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function testColumns() {
  const tables = ['films', 'people', 'channels', 'companies', 'cinemas']
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.log(`Error querying ${table}:`, error.message)
    } else {
      if (data && data.length > 0) {
        const row = data[0]
        console.log(`Table ${table} columns:`, Object.keys(row).join(', '))
      } else {
        console.log(`Table ${table} is empty.`)
        // To get columns even if empty, we might not get them this way. But usually there's data.
      }
    }
  }
}

testColumns()
