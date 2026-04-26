const { Client } = require('pg');
async function test() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  
  await client.query(`
    DROP TABLE IF EXISTS test_credits;
    CREATE TABLE test_credits (
        id SERIAL PRIMARY KEY,
        film_id INT,
        person_id INT,
        role VARCHAR
    );
    INSERT INTO test_credits (film_id, person_id, role) VALUES 
    (1, 100, 'Director'),
    (1, 200, 'Director'), 
    (2, 200, 'Actor');    
  `);

  await client.query(`
    UPDATE test_credits c1
    SET person_id = 100
    WHERE person_id = 200
    AND NOT EXISTS (
        SELECT 1 FROM test_credits c2 
        WHERE c2.person_id = 100
        AND c2.film_id = c1.film_id 
        AND c2.role = c1.role
    );
  `);
  
  const res = await client.query('SELECT * FROM test_credits ORDER BY id;');
  console.log(res.rows);
  await client.end();
}
test().catch(console.error);
