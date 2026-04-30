const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ROLE_MAP = {
    'Cast': 'actor',
    'Director': 'director',
    'Producer': 'producer',
    'Executive Producer': 'producer',
    'Screenplay': 'writer',
    'Cinematography': 'crew',
    'Music': 'crew',
    'Editing': 'crew',
    'Art Direction': 'crew',
    'Costume Design': 'crew'
};

async function fetchMubi(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
}

/**
 * Discovery: Get film slugs for a specific country
 */
async function discoverFilms(country = 'Nigeria', page = 1) {
    const url = `https://mubi.com/en/films?all_films=true&country=${country}&sort=popularity_quality_score&page=${page}`;
    console.log(`\n🔍 Discovering films on page ${page} for ${country}...`);
    
    const html = await fetchMubi(url);
    const $ = cheerio.load(html);
    
    const scriptContent = $('#__NEXT_DATA__').html();
    if (!scriptContent) return [];

    const nextData = JSON.parse(scriptContent);
    const films = nextData.props.pageProps.films || [];
    
    return films.map(f => ({
        slug: f.slug,
        title: f.title,
        id: f.id
    }));
}

/**
 * Extraction: Get full details and cast for a film
 */
async function extractFilm(slug) {
    const filmUrl = `https://mubi.com/en/films/${slug}`;
    const castUrl = `https://mubi.com/en/films/${slug}/cast`;
    
    console.log(`\n🎬 Extracting: ${slug}...`);
    
    // 1. Get Core Metadata
    const filmHtml = await fetchMubi(filmUrl);
    const $f = cheerio.load(filmHtml);
    const filmNextData = JSON.parse($f('#__NEXT_DATA__').html());
    const film = filmNextData.props.pageProps.initFilm;

    // 2. Get Full Cast/Crew
    const castHtml = await fetchMubi(castUrl);
    const $c = cheerio.load(castHtml);
    const credits = [];
    
    // Parse the DOM for cast/crew as observed by browser subagent
    $c('a[class*="css-8cjqw"]').each((i, el) => {
        const name = $c(el).find('span').first().text().trim();
        const rawRole = $c(el).find('span').last().text().trim();
        const mubiSlug = $c(el).attr('href')?.split('/').pop();
        
        // Handle multiple roles (e.g. "Director, Screenplay")
        const roles = rawRole.split(/,| and /).map(r => r.trim());
        
        roles.forEach(role => {
            credits.push({
                name,
                role: ROLE_MAP[role] || 'crew',
                original_role: role,
                mubi_slug: mubiSlug
            });
        });
    });

    return {
        metadata: {
            title: film.title,
            year: film.year,
            synopsis: film.short_synopsis || film.default_editorial || '',
            runtime_minutes: film.duration,
            genres: film.genres || [],
            poster_url: film.still_url || film.stills?.retina,
            backdrop_url: film.stills?.retina,
            mubi_id: film.id,
            mubi_slug: slug,
            language: 'English' // Defaulting for Nigeria, Mubi doesn't always specify clearly in this JSON
        },
        credits
    };
}

async function runTest() {
    try {
        // Step 1: Discover first page of Nigeria
        const discovered = await discoverFilms('Nigeria', 1);
        console.log(`✅ Discovered ${discovered.length} films.`);
        
        if (discovered.length > 0) {
            const firstFilm = discovered[0];
            console.log(`\nProcessing first film: ${firstFilm.title}`);
            
            const data = await extractFilm(firstFilm.slug);
            
            console.log('\n--- Final Data Structure ---');
            console.log(JSON.stringify(data.metadata, null, 2));
            console.log(`\nCredits Count: ${data.credits.length}`);
            console.log(`Cast Sample: ${data.credits.filter(c => c.role === 'actor').slice(0, 3).map(c => c.name).join(', ')}`);
            console.log(`Crew Sample: ${data.credits.filter(c => c.role !== 'actor').slice(0, 3).map(c => `${c.name} (${c.original_role})`).join(', ')}`);
            
            fs.writeFileSync('scratch/mubi_full_sample.json', JSON.stringify(data, null, 2));
            console.log('\n💾 Saved full result to scratch/mubi_full_sample.json');
        }
    } catch (err) {
        console.error('💥 Execution failed:', err.message);
    }
}

runTest();
