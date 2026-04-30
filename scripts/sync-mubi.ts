import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import fs from 'fs';

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ROLE_MAP: Record<string, string> = {
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

async function fetchMubi(url: string) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
}

async function discoverFilms(country = 'Nigeria', page = 1) {
    const url = `https://mubi.com/en/films?all_films=true&country=${country}&sort=popularity_quality_score&page=${page}`;
    console.log(`\n🔍 Discovering films on page ${page} for ${country}...`);
    
    const html = await fetchMubi(url);
    const $ = cheerio.load(html);
    
    const scriptContent = $('#__NEXT_DATA__').html();
    if (!scriptContent) return [];

    const nextData = JSON.parse(scriptContent);
    const films = nextData.props.pageProps.films || [];
    
    return films.map((f: any) => ({
        slug: f.slug,
        title: f.title,
        id: f.id,
        year: f.year
    }));
}

async function extractFilm(slug: string) {
    const filmUrl = `https://mubi.com/en/films/${slug}`;
    const castUrl = `https://mubi.com/en/films/${slug}/cast`;
    
    console.log(`  🎬 Extracting: ${slug}...`);
    
    const filmHtml = await fetchMubi(filmUrl);
    const $f = cheerio.load(filmHtml);
    const filmDataStr = $f('#__NEXT_DATA__').html();
    if (!filmDataStr) throw new Error(`Could not find __NEXT_DATA__ for ${slug}`);
    
    const filmNextData = JSON.parse(filmDataStr);
    const film = filmNextData.props.pageProps.initFilm;

    const castHtml = await fetchMubi(castUrl);
    const $c = cheerio.load(castHtml);
    const credits: any[] = [];
    
    const castDataStr = $c('#__NEXT_DATA__').html();
    if (castDataStr) {
        const castData = JSON.parse(castDataStr).props.pageProps;
        // Mubi sometimes provides structured cast/crew in JSON
        if (castData.cast) {
            castData.cast.forEach((c: any) => {
                credits.push({
                    name: c.name,
                    role: 'actor',
                    character_name: c.role,
                    mubi_slug: c.slug
                });
            });
        }
        if (castData.crew) {
            castData.crew.forEach((c: any) => {
                credits.push({
                    name: c.name,
                    role: ROLE_MAP[c.job] || 'crew',
                    original_role: c.job,
                    mubi_slug: c.slug
                });
            });
        }
    }

    // Fallback to DOM parsing if JSON didn't yield enough
    if (credits.length === 0) {
        $c('a[class*="css-8cjqw"]').each((i, el) => {
            const name = $c(el).find('span').first().text().trim();
            const rawRole = $c(el).find('span').last().text().trim();
            const mubiSlug = $c(el).attr('href')?.split('/').pop();
            
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
    }

    return {
        metadata: {
            title: film.title,
            year: film.year,
            synopsis: film.short_synopsis || film.default_editorial || '',
            runtime_minutes: film.duration,
            genres: film.genres || [],
            poster_url: film.still_url || film.stills?.retina,
            backdrop_url: film.stills?.retina,
            mubi_id: String(film.id),
            mubi_slug: slug,
            language: 'English'
        },
        credits
    };
}

async function syncFilm(data: any) {
    const { metadata, credits } = data;
    
    // 1. Check for existing film by mubi_id or (title and year)
    let { data: existing } = await supabase
        .from('films')
        .select('id, mubi_id')
        .or(`mubi_id.eq.${metadata.mubi_id},and(title.eq."${metadata.title}",year.eq.${metadata.year})`)
        .maybeSingle();

    let filmId = existing?.id;

    const filmPayload = {
        title: metadata.title,
        year: metadata.year,
        synopsis: metadata.synopsis,
        runtime_minutes: metadata.runtime_minutes,
        poster_url: metadata.poster_url,
        backdrop_url: metadata.backdrop_url,
        mubi_id: metadata.mubi_id,
        mubi_slug: metadata.mubi_slug,
        language: metadata.language,
        source: 'mubi',
        needs_review: true
    };

    if (filmId) {
        await supabase.from('films').update(filmPayload).eq('id', filmId);
        console.log(`    ✓ Updated film: ${metadata.title}`);
    } else {
        const { data: newFilm, error } = await supabase
            .from('films')
            .insert(filmPayload)
            .select('id')
            .single();
        if (error) {
            console.error(`    ✗ Error creating film: ${error.message}`);
            return;
        }
        filmId = newFilm.id;
        console.log(`    + Created film: ${metadata.title}`);
    }

    // 2. Map Genres
    if (metadata.genres?.length > 0) {
        // Fetch all genres from DB to map names
        const { data: dbGenres } = await supabase.from('genres').select('id, name');
        for (const gName of metadata.genres) {
            const genre = dbGenres?.find(g => g.name.toLowerCase() === gName.toLowerCase());
            if (genre) {
                await supabase.from('film_genres').upsert({ film_id: filmId, genre_id: genre.id }, { onConflict: 'film_id,genre_id' });
            }
        }
    }

    // 3. Upsert Credits
    for (const c of credits) {
        // Find or create person
        let { data: person } = await supabase
            .from('people')
            .select('id')
            .ilike('name', c.name)
            .maybeSingle();
            
        let personId = person?.id;
        if (!personId) {
            const { data: newPerson } = await supabase
                .from('people')
                .insert({ name: c.name, needs_review: true, source: 'mubi' })
                .select('id')
                .single();
            personId = newPerson?.id;
        }

        if (personId) {
            await supabase.from('credits').upsert({
                film_id: filmId,
                person_id: personId,
                role: c.role,
                character_name: c.character_name || null,
                billing_order: 0
            }, { onConflict: 'film_id,person_id,role' });
        }
    }
}

async function main() {
    const country = 'Nigeria';
    const maxPages = 15; // Mubi usually has ~20 films per page, 15 pages covers 300 films
    
    try {
        console.log(`🚀 Starting full MUBI sync for ${country}...`);
        let totalSynced = 0;

        for (let page = 1; page <= maxPages; page++) {
            const discovered = await discoverFilms(country, page);
            if (discovered.length === 0) {
                console.log(`  No more films found on page ${page}. Finishing.`);
                break;
            }

            console.log(`✅ Page ${page}: Found ${discovered.length} films.`);
            
            for (const item of discovered) {
                try {
                    const data = await extractFilm(item.slug);
                    await syncFilm(data);
                    totalSynced++;
                    
                    // Small delay to be polite to MUBI
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err: any) {
                    console.error(`  ✗ Failed ${item.slug}: ${err.message}`);
                }
            }
        }
        
        console.log(`\n🎉 Sync complete. Total films processed: ${totalSynced}`);
    } catch (err: any) {
        console.error('💥 Global failure:', err.message);
    }
}

main();
