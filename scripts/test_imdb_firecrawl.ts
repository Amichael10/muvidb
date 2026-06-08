import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

async function test() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("No FIRECRAWL_API_KEY found!");
    return;
  }
  
  const url = 'https://www.imdb.com/title/tt21442290/fullcredits';
  console.log(`Requesting ${url} via Firecrawl...`);
  
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown']
      })
    });
    
    console.log(`Status: ${res.status}`);
    const data: any = await res.json();
    if (data.success) {
      console.log("Success! Data received.");
      const markdown = data.data.markdown || '';
      console.log("Markdown length:", markdown.length);
      fs.writeFileSync('scripts/imdb_divine_lies.md', markdown);
      console.log("Saved to scripts/imdb_divine_lies.md");
    } else {
      console.log("Firecrawl reported failure:", data.error);
    }
  } catch (err: any) {
    console.error("Error with Firecrawl request:", err.message);
  }
}

test();
