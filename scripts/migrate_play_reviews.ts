import * as dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function testPg() {
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || process.env.SUPABASE_DB_URL;
  console.log("DB URL present?", Boolean(dbUrl));
  if (dbUrl) {
    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log("Connected to PG successfully!");
      
      // Add play_id columns if they don't exist
      console.log("Adding play_id to reviews...");
      await client.query(`
        ALTER TABLE reviews 
        ADD COLUMN IF NOT EXISTS play_id UUID REFERENCES plays(id) ON DELETE CASCADE;
      `);
      
      console.log("Adding play_id to critic_reviews...");
      await client.query(`
        ALTER TABLE critic_reviews 
        ADD COLUMN IF NOT EXISTS play_id UUID REFERENCES plays(id) ON DELETE CASCADE;
      `);

      console.log("Creating indices for performance...");
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_reviews_play_id ON reviews(play_id);
        CREATE INDEX IF NOT EXISTS idx_critic_reviews_play_id ON critic_reviews(play_id);
      `);

      // Make film_id nullable if it was NOT NULL
      await client.query(`
        ALTER TABLE reviews ALTER COLUMN film_id DROP NOT NULL;
        ALTER TABLE critic_reviews ALTER COLUMN film_id DROP NOT NULL;
      `);

      console.log("Schema migration completed successfully!");
      await client.end();
    } catch (err) {
      console.error("PG error:", err);
    }
  } else {
    console.log("No direct DB URL found in env.");
  }
}

testPg().catch(console.error);
