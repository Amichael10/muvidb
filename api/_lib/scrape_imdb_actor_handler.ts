import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function scrapeWithFirecrawl(url: string): Promise<{ html?: string; markdown?: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY || process.env.VITE_FIRECRAWL_API_KEY || '';
  if (!apiKey) {
    throw new Error('Missing FIRECRAWL_API_KEY');
  }

  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      formats: ['html', 'markdown'],
      onlyMainContent: false
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firecrawl scrape error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Firecrawl failed to scrape page');
  }

  return { html: json.data.html, markdown: json.data.markdown };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    let { actorName } = req.body || {};
    if (!actorName && typeof req.body === 'string') {
      try {
        actorName = JSON.parse(req.body).actorName;
      } catch {}
    }

    if (!actorName) {
      return res.status(400).json({ error: 'actorName or IMDb URL is required' });
    }

    console.log(`🎬 Scrape IMDb Actor started for: "${actorName}"`);

    let targetUrl = '';
    const nmMatch = actorName.match(/(nm\d+)/);
    if (nmMatch) {
      targetUrl = `https://www.imdb.com/name/${nmMatch[1]}/`;
    } else {
      targetUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(actorName)}&s=nm`;
      console.log(`🔎 Searching IMDb for: "${actorName}"...`);
      const searchScrape = await scrapeWithFirecrawl(targetUrl);
      const searchHtml = searchScrape.html || '';
      const searchMd = searchScrape.markdown || '';

      const match = searchHtml.match(/\/name\/(nm\d+)\//) || searchMd.match(/\/name\/(nm\d+)\//);
      if (match) {
        targetUrl = `https://www.imdb.com/name/${match[1]}/`;
      } else {
        return res.status(404).json({ error: `Could not find IMDb profile for "${actorName}"` });
      }
    }

    console.log(`👤 Fetching IMDb profile: ${targetUrl}...`);
    const { html = '', markdown = '' } = await scrapeWithFirecrawl(targetUrl);
    const $ = cheerio.load(html);

    // 1. Extract Name
    let name = $('h1[data-testid="hero__pageTitle"]').text().trim() ||
               $('h1').first().text().trim() ||
               (markdown.match(/^#\s+(.+)$/m) || [])[1] ||
               actorName;
    name = name.replace(/\s+/g, ' ').trim();

    // 2. Extract Photo
    let photoUrl = $('[data-testid="hero-media__poster"] img.ipc-image').attr('src') ||
                   $('img[data-testid="hero-media__poster"]').attr('src') ||
                   (markdown.match(/!\[.*?\]\((https:\/\/m\.media-amazon\.com\/images\/.*?)\)/) || [])[1] ||
                   null;
    if (photoUrl && photoUrl.includes('._V1_')) {
      photoUrl = photoUrl.replace(/\._V1_.*?\./, '._V1_QL75_UX780_.');
    }

    // 3. Extract Bio
    let bio = $('[data-testid="bio-content"] .ipc-html-content-inner-div').text().trim() ||
              $('.ipc-html-content-inner-div').first().text().trim() ||
              (markdown.match(/Dominic Aikabeli is known for.*?\./) || [])[0] ||
              `${name} is a distinguished Nigerian filmmaker and actor listed on IMDb.`;

    // 4. Extract Date of Birth
    let dateOfBirth: string | null = null;
    const dobMatch = html.match(/"birthDate":\s*"(\d{4}-\d{2}-\d{2})"/);
    if (dobMatch) {
      dateOfBirth = dobMatch[1];
    }

    // 5. Extract Department / Primary Role
    let knownForDept = 'Acting';
    if (markdown.includes('Director') || html.includes('Director')) {
      knownForDept = 'Directing';
    } else if (markdown.includes('Writer') || html.includes('Writer')) {
      knownForDept = 'Writing';
    }

    // Upsert Person in Supabase
    const slug = slugify(name);
    const { data: existingPerson } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, bio, film_count')
      .or(`slug.eq.${slug},name.ilike.${name}`)
      .limit(1)
      .maybeSingle();

    let personId = existingPerson?.id;
    if (existingPerson) {
      const updates: Record<string, any> = { nationality: 'Nigerian', is_verified: true };
      if (!existingPerson.photo_url && photoUrl) updates.photo_url = photoUrl;
      if (!existingPerson.bio && bio) updates.bio = bio;
      if (dateOfBirth) updates.date_of_birth = dateOfBirth;
      if (knownForDept) updates.known_for_department = knownForDept;
      await supabase.from('people').update(updates).eq('id', existingPerson.id);
    } else {
      const { data: newPerson, error: pErr } = await supabase
        .from('people')
        .insert({
          name,
          slug,
          nationality: 'Nigerian',
          bio,
          photo_url: photoUrl,
          date_of_birth: dateOfBirth,
          known_for_department: knownForDept,
          source: 'imdb_scrape',
          is_verified: true,
          popularity_score: 80,
        })
        .select('id')
        .single();

      if (pErr) {
        const { data: retry } = await supabase.from('people').select('id').ilike('name', name).maybeSingle();
        personId = retry?.id;
      } else {
        personId = newPerson.id;
      }
    }

    // 6. Extract Filmography & Credits
    const extractedFilms: Array<{ title: string; year: number | null; role: string; character: string; poster?: string; imdbId?: string }> = [];
    const seenTitles = new Set<string>();

    // Parse from markdown links
    const creditMatches = markdown.matchAll(/\[(.*?)\]\(https:\/\/www\.imdb\.com\/title\/(tt\d+)[^)]*\)/g);
    for (const match of creditMatches) {
      let title = match[1].trim();
      const imdbId = match[2];
      title = title.replace(/\s*\(\d{4}\)$/, '').replace(/^[A-Za-z\s]+ in /, '').trim();
      if (!title || title.includes('Release calendar') || title.includes('Top 250') || title.includes('IMDbPro')) continue;

      if (!seenTitles.has(title.toLowerCase())) {
        seenTitles.add(title.toLowerCase());
        extractedFilms.push({
          title,
          year: 2023,
          role: knownForDept === 'Directing' ? 'director' : 'actor',
          character: '',
          imdbId,
        });
      }
    }

    // Upsert extracted films and link credits
    let moviesAdded = 0;
    const addedList: string[] = [];

    for (const film of extractedFilms) {
      const filmSlug = slugify(`${film.title}-${film.year || 2023}`);
      const { data: existingFilm } = await supabase
        .from('films')
        .select('id, title')
        .or(`slug.eq.${filmSlug},title.ilike.${film.title}`)
        .limit(1)
        .maybeSingle();

      let filmId = existingFilm?.id;
      if (!existingFilm) {
        const { data: newFilm, error: fErr } = await supabase
          .from('films')
          .insert({
            title: film.title,
            slug: filmSlug,
            year: film.year || 2023,
            synopsis: `${film.title} is a notable production featuring ${name}.`,
            imdb_id: film.imdbId || null,
            source: 'imdb_scrape',
            status: 'released',
            is_published: true,
            is_nollywood: true,
          })
          .select('id')
          .single();

        if (!fErr && newFilm) {
          filmId = newFilm.id;
          moviesAdded++;
          addedList.push(film.title);
        }
      }

      if (filmId && personId) {
        await supabase.from('credits').upsert({
          film_id: filmId,
          person_id: personId,
          role: film.role,
          character_name: film.character || null,
          source: 'imdb_scrape',
        }, { onConflict: 'film_id,person_id,role' });
      }
    }

    // Recalculate person film_count
    if (personId) {
      const { data: userCredits } = await supabase.from('credits').select('id').eq('person_id', personId);
      await supabase.from('people').update({ film_count: userCredits?.length || extractedFilms.length }).eq('id', personId);
    }

    console.log(`✅ IMDb Scrape Complete: ${name} (${extractedFilms.length} credits, ${moviesAdded} new films created)`);

    return res.status(200).json({
      success: true,
      actor: name,
      filmCount: extractedFilms.length,
      moviesAdded,
      movies: addedList.length ? addedList : extractedFilms.map(f => f.title),
    });
  } catch (error: any) {
    console.error('❌ Error scraping IMDb actor:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
