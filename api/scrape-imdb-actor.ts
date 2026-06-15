import { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';
import { supabase } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { actorName } = req.body;

    if (!actorName) {
      return res.status(400).json({ error: 'actorName is required' });
    }

    console.log(`🎬 API: Searching IMDb for actor: ${actorName}`);

    // 1. Search for the actor
    const searchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(actorName)}&s=nm`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.statusText}`);
    const searchHtml = await searchRes.text();
    const $search = cheerio.load(searchHtml);
    
    const firstResultHref = $search('.ipc-metadata-list-summary-item a.ipc-metadata-list-summary-item__t').first().attr('href');
    
    if (!firstResultHref) {
       // IMDb uses anti-bot heavily. If Cheerio fails, let's try regex as fallback
       const match = searchHtml.match(/href="(\/name\/nm\d+\/)"/);
       if (!match) {
         return res.status(404).json({ error: `Could not find actor "${actorName}" on IMDb. They may not exist or we were blocked.` });
       }
    }

    const actorPath = firstResultHref || searchHtml.match(/href="(\/name\/nm\d+\/)"/)?.[1];
    if (!actorPath) {
      return res.status(404).json({ error: `Actor URL not found.` });
    }

    // 2. Go to Actor Profile
    console.log(`👤 API: Navigating to actor profile...`);
    const profileUrl = `https://www.imdb.com${actorPath}`;
    const profileRes = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.statusText}`);
    const profileHtml = await profileRes.text();
    const $profile = cheerio.load(profileHtml);

    // 3. Extract Bio and Image
    let nameStr = $profile('h1.hero__primary-text').text().trim();
    if (!nameStr) {
      const match = profileHtml.match(/<h1[^>]*hero__primary-text[^>]*>(.*?)<\/h1>/);
      nameStr = match ? match[1].trim() : actorName;
    }

    let bioStr = $profile('.ipc-html-content-inner-div').first().text().trim();
    let imgStr = $profile('.ipc-image').first().attr('src');

    console.log(`✅ Extracted Profile: ${nameStr}`);
    
    // Upsert Person
    const { data: existingPerson } = await supabase.from('people').select('id').ilike('name', nameStr).maybeSingle();
    let personId = existingPerson?.id;

    if (existingPerson) {
      await supabase.from('people').update({ 
        ...(bioStr && { biography: bioStr }),
        ...(imgStr && { profile_image_url: imgStr })
      }).eq('id', personId);
    } else {
      const { data: newPerson, error: personErr } = await supabase
        .from('people')
        .insert({ 
          name: nameStr, 
          source: 'imdb', 
          nationality: 'Nigerian',
          biography: bioStr,
          profile_image_url: imgStr
        })
        .select('id')
        .single();
        
      if (personErr) throw new Error(personErr.message);
      personId = newPerson.id;
    }

    // 4. Extract Filmography
    console.log('🎞️ Extracting filmography...');
    const credits: { title: string, year?: string }[] = [];
    
    $profile('.ipc-metadata-list-summary-item__t').slice(0, 15).each((i, el) => {
      const title = $profile(el).text().trim();
      if (title) credits.push({ title });
    });

    // Fallback if cheerio misses them due to dynamic loading
    if (credits.length === 0) {
      const regex = /<a[^>]*ipc-metadata-list-summary-item__t[^>]*>(.*?)<\/a>/g;
      let m;
      while ((m = regex.exec(profileHtml)) !== null && credits.length < 15) {
         if (m[1].trim()) credits.push({ title: m[1].trim() });
      }
    }

    const insertedFilms = [];

    for (const credit of credits) {
      const { data: existingMovie } = await supabase.from('films').select('id').ilike('title', credit.title).maybeSingle();
      
      let movieId = existingMovie?.id;
      
      if (!existingMovie) {
        const { data: newMovie } = await supabase.from('films').insert({
          title: credit.title,
          source: 'imdb'
        }).select('id').single();
        movieId = newMovie?.id;
        insertedFilms.push(credit.title);
      }

      if (movieId && personId) {
        await supabase.from('film_cast').upsert({
          film_id: movieId,
          person_id: personId,
          role_type: 'actor'
        }, { onConflict: 'film_id, person_id' }).catch(() => null);
      }
    }

    return res.status(200).json({ 
      success: true, 
      actor: nameStr, 
      moviesAdded: insertedFilms.length,
      movies: credits.map(c => c.title)
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
