import { supabase, withRetry } from '../db.js';

export async function searchPeople(args: {
  query: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50);
  const cleanQ = (args.query || '').trim();

  let req = supabase
    .from('people')
    .select('id, name, slug, known_for_department, photo_url, bio, awards')
    .limit(limit);

  if (cleanQ) {
    req = req.or(`name.ilike.%${cleanQ}%,slug.ilike.%${cleanQ}%`);
  }

  const { data } = await withRetry(() => req);
  return {
    results_count: data?.length || 0,
    people: data || []
  };
}

export async function getPersonFilmography(args: {
  person_id?: string;
  name?: string;
}) {
  let person: any = null;
  if (args.person_id) {
    const { data } = await withRetry(() =>
      supabase
        .from('people')
        .select('id, name, slug, known_for_department, photo_url, bio, awards, date_of_birth, birthplace, imdb_id')
        .eq('id', args.person_id)
        .maybeSingle()
    );
    person = data;
  } else if (args.name) {
    const { data } = await withRetry(() =>
      supabase
        .from('people')
        .select('id, name, slug, known_for_department, photo_url, bio, awards, date_of_birth, birthplace, imdb_id')
        .ilike('name', args.name.trim())
        .limit(1)
        .maybeSingle()
    );
    person = data;
  }

  if (!person) {
    return {
      error: `Person not found with ${args.person_id ? `ID: ${args.person_id}` : `Name: ${args.name}`}`
    };
  }

  // Fetch all credits for this person
  const { data: credits } = await withRetry(() =>
    supabase
      .from('credits')
      .select(`
        role, character_name, billing_order,
        films(id, title, year, poster_url, content_type, distributor, average_rating)
      `)
      .eq('person_id', person.id)
  );

  const directing: any[] = [];
  const writing: any[] = [];
  const producing: any[] = [];
  const acting: any[] = [];
  const otherCrew: any[] = [];

  for (const c of credits || []) {
    const film = (c as any).films;
    if (!film) continue;

    const entry = {
      film_id: film.id,
      title: film.title,
      year: film.year,
      poster_url: film.poster_url,
      content_type: film.content_type,
      distributor: film.distributor,
      role: c.role,
      character_name: c.character_name,
      billing_order: c.billing_order
    };

    if (c.role === 'director') directing.push(entry);
    else if (c.role === 'writer') writing.push(entry);
    else if (c.role === 'producer') producing.push(entry);
    else if (c.role === 'actor') acting.push(entry);
    else otherCrew.push(entry);
  }

  // Sort by year descending
  const sortByYear = (a: any, b: any) => (b.year || 0) - (a.year || 0);
  directing.sort(sortByYear);
  writing.sort(sortByYear);
  producing.sort(sortByYear);
  acting.sort(sortByYear);

  return {
    person_id: person.id,
    name: person.name,
    slug: person.slug,
    known_for_department: person.known_for_department,
    photo_url: person.photo_url,
    biography: person.bio,
    awards: person.awards || [],
    credits_count: (credits || []).length,
    filmography: {
      directing,
      writing,
      producing,
      acting,
      other_crew: otherCrew
    }
  };
}
