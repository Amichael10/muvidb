import { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';
import { supabase } from './supabase.js';
import { handleCors } from './cors.js';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { actorName } = req.body;

    if (!actorName) {
      return res.status(400).json({ error: 'actorName is required' });
    }

    console.log(`🎬 API: Searching IMDb for actor: ${actorName}`);

    let actorPath = '';
    const nmMatch = actorName.match(/(nm\d+)/);
    if (nmMatch) {
      actorPath = `/name/${nmMatch[1]}/`;
      console.log(`🔗 API: Detected direct IMDb ID/URL: ${actorPath}`);
    } else {
      // Search for actor on IMDb
      const searchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(actorName)}&s=nm`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.statusText}`);
      const searchHtml = await searchRes.text();
      const $search = cheerio.load(searchHtml);

      const firstResultHref = $search('.ipc-metadata-list-summary-item a.ipc-metadata-list-summary-item__t').first().attr('href');
      actorPath = firstResultHref || searchHtml.match(/href="(\/name\/nm\d+\/)"/)?.[1] || '';

      if (!actorPath) {
        return res.status(404).json({ error: `Could not find actor "${actorName}" on IMDb.` });
      }
    }

    // 2. Fetch actor profile
    console.log(`👤 API: Navigating to actor profile ${actorPath}...`);
    const profileUrl = `https://www.imdb.com${actorPath}`;
    const profileRes = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.statusText}`);
    const profileHtml = await profileRes.text();
    const $profile = cheerio.load(profileHtml);

    // 3. Extract Bio and Image
    let nameStr = $profile('h1[data-testid="hero__pageTitle"]').text().trim() || $profile('h1.hero__primary-text').text().trim();
    if (!nameStr) {
      const match = profileHtml.match(/<h1[^>]*hero__primary-text[^>]*>(.*?)<\/h1>/);
      nameStr = match ? match[1].trim() : actorName.replace(/https?:\/\/.*\/name\//i, '').replace(/\//g, '');
    }

    let bioStr = $profile('.ipc-html-content-inner-div').first().text().trim() || '';
    let imgStr = $profile('[data-testid="hero-media__poster"] img.ipc-image').attr('src') || $profile('.ipc-image').first().attr('src') || null;

    // Check JSON-LD metadata for rich details
    const jsonLds = profileHtml.match(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
    let birthDate: string | null = null;
    if (jsonLds) {
      for (const jld of jsonLds) {
        try {
          const raw = jld.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          const parsed = JSON.parse(raw);
          if (parsed['@type'] === 'Person') {
            if (parsed.name && !nameStr) nameStr = parsed.name;
            if (parsed.image && !imgStr) imgStr = parsed.image;
            if (parsed.description && !bioStr) bioStr = parsed.description;
            if (parsed.birthDate) birthDate = parsed.birthDate;
          }
        } catch {
          // ignore
        }
      }
    }

    console.log(`✅ Extracted Profile: ${nameStr} (DOB: ${birthDate})`);

    const personSlug = slugify(nameStr);
    const { data: existingPerson } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, bio')
      .or(`slug.eq.${personSlug},name.ilike.${nameStr}`)
      .limit(1)
      .maybeSingle();

    let personId = existingPerson?.id;

    if (existingPerson) {
      await supabase.from('people').update({
        ...(bioStr && { bio: bioStr }),
        ...(imgStr && !existingPerson.photo_url && { photo_url: imgStr }),
        ...(birthDate && { date_of_birth: birthDate }),
        nationality: 'Nigerian',
        known_for_department: 'Acting',
        is_verified: true,
      }).eq('id', personId);
    } else {
      const { data: newPerson, error: personErr } = await supabase
        .from('people')
        .insert({
          name: nameStr,
          slug: personSlug,
          source: 'imdb_scrape',
          nationality: 'Nigerian',
          bio: bioStr || `${nameStr} is a recognized Nollywood actor.`,
          photo_url: imgStr,
          date_of_birth: birthDate,
          known_for_department: 'Acting',
          is_verified: true,
          popularity_score: 80,
        })
        .select('id')
        .single();

      if (personErr) throw new Error(personErr.message);
      personId = newPerson.id;
    }

    // 4. Extract Filmography
    console.log('🎞️ Extracting filmography...');
    const credits: Array<{ title: string; year?: number; character?: string; role: string }> = [];

    $profile('.ipc-metadata-list-summary-item').each((_, el) => {
      const $el = $profile(el);
      const titleText = $el.find('.ipc-metadata-list-summary-item__t').text().trim();
      const yearText = $el.find('.ipc-metadata-list-summary-item__li').first().text().trim();
      const yearNum = parseInt(yearText, 10) || undefined;
      const charText = $el.find('.ipc-metadata-list-summary-item__c').text().trim() || undefined;

      if (titleText) {
        credits.push({
          title: titleText,
          year: yearNum,
          character: charText,
          role: 'actor',
        });
      }
    });

    // Fallback if specific classes are obfuscated
    if (credits.length === 0) {
      const regex = /<a[^>]*ipc-metadata-list-summary-item__t[^>]*>(.*?)<\/a>/g;
      let m;
      while ((m = regex.exec(profileHtml)) !== null && credits.length < 50) {
        if (m[1].trim()) credits.push({ title: m[1].trim(), role: 'actor' });
      }
    }

    const insertedFilms: string[] = [];

    for (const credit of credits) {
      const filmSlug = slugify(`${credit.title}-${credit.year || 2024}`);
      const { data: existingMovie } = await supabase
        .from('films')
        .select('id, title, slug')
        .or(`slug.eq.${filmSlug},title.ilike.${credit.title}`)
        .limit(1)
        .maybeSingle();

      let movieId = existingMovie?.id;

      if (!existingMovie) {
        const { data: newMovie } = await supabase.from('films').insert({
          title: credit.title,
          slug: filmSlug,
          year: credit.year || 2024,
          synopsis: `${credit.title} is a Nigerian feature production starring ${nameStr}.`,
          source: 'imdb_enrichment',
          is_published: true,
          is_nollywood: true,
        }).select('id').single();

        movieId = newMovie?.id;
        insertedFilms.push(credit.title);
      }

      if (movieId && personId) {
        const { data: existingCredit } = await supabase
          .from('credits')
          .select('id')
          .eq('film_id', movieId)
          .eq('person_id', personId)
          .eq('role', credit.role || 'actor')
          .maybeSingle();

        if (!existingCredit) {
          await supabase.from('credits').insert({
            film_id: movieId,
            person_id: personId,
            role: credit.role || 'actor',
            character_name: credit.character || null,
            source: 'imdb_enrichment',
          });
        }
      }
    }

    // Update verified film count
    const { data: totalCredits } = await supabase.from('credits').select('id').eq('person_id', personId);
    await supabase.from('people').update({ film_count: totalCredits?.length || credits.length }).eq('id', personId);

    return res.status(200).json({
      success: true,
      actor: nameStr,
      filmCount: totalCredits?.length || credits.length,
      moviesAdded: insertedFilms.length,
      movies: credits.map((c) => c.title),
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
