const cheerio = require('cheerio');

async function testMubiCastScrape() {
  const url = 'https://mubi.com/en/us/films/mami-wata/cast';
  console.log(`\n🔍 Fetching Cast Page: ${url}...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract __NEXT_DATA__
    const scriptContent = $('#__NEXT_DATA__').html();
    if (!scriptContent) {
      console.error('❌ Could not find __NEXT_DATA__ script tag.');
      return;
    }

    const nextData = JSON.parse(scriptContent);
    const castData = nextData.props.pageProps;
    
    console.log('✅ Success! Extracted Cast Metadata:');
    console.log('-----------------------------------');
    console.log('Available keys in pageProps:', Object.keys(castData));

    // Look for the actual cast list
    // In many Mubi cast pages, it's under 'cast' or 'crew'
    if (castData.cast) {
        console.log(`Total Cast Members: ${castData.cast.length}`);
        console.log(`Cast Samples: ${castData.cast.slice(0, 3).map(c => c.name).join(', ')}`);
    }
    
    if (castData.crew) {
        console.log(`Total Crew Members: ${castData.crew.length}`);
        const crewJobs = castData.crew.slice(0, 5).map(c => `${c.name} (${c.job})`);
        console.log(`Crew Samples: ${crewJobs.join(', ')}`);
    }

    // Optional: Save to file for further inspection
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(__dirname, 'mubi_cast_sample.json');
    fs.writeFileSync(outputPath, JSON.stringify(castData, null, 2));
    console.log(`\n💾 Saved full cast JSON to: ${outputPath}`);

  } catch (error) {
    console.error('💥 Error during scraping:', error.message);
  }
}

testMubiCastScrape();
