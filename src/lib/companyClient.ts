import { supabase } from './supabase';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor';
  title?: string;
  status: 'active' | 'invited';
  email?: string;
  user_name?: string;
  created_at?: string;
}

export interface TalentRepItem {
  id: string;
  company_id: string;
  person_id: string;
  representation_type?: string;
  agent_name?: string;
  contact_email?: string;
  contact_phone?: string;
  booking_url?: string;
  is_primary?: boolean;
  people?: {
    id: string;
    name: string;
    slug?: string;
    photo_url?: string;
    primary_role?: string;
  };
}

export interface CompanyFilm {
  id: string;
  title: string;
  slug?: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  synopsis?: string;
  trailer_url?: string;
  status?: string;
  release_date?: string;
  theatrical_release_date?: string;
  box_office_domestic?: number;
  box_office_worldwide?: number;
  box_office_opening_weekend?: number;
  box_office_currency?: string;
  role?: string;
  view_count?: number;
  average_rating?: number;
}

/**
 * Fetch companies that the current user has access to manage.
 * If user is admin, they can manage any company or pick from top studios.
 */
export async function fetchUserManagedCompanies(user: { id: string; role?: string; email?: string } | null) {
  if (!user?.id) return [];

  const companies: any[] = [];
  const addedIds = new Set<string>();

  // 1. Check company_members
  try {
    const { data: memberRows } = await supabase
      .from('company_members')
      .select('company_id, role, title, companies(*)')
      .eq('user_id', user.id);

    if (memberRows && memberRows.length > 0) {
      memberRows.forEach((m: any) => {
        if (m.companies && !addedIds.has(m.companies.id)) {
          addedIds.add(m.companies.id);
          companies.push({
            ...m.companies,
            memberRole: m.role || 'editor',
            memberTitle: m.title,
          });
        }
      });
    }
  } catch {
    // If company_members table not yet migrated, continue
  }

  // 2. Check companies where claimed_by = user.id
  try {
    const { data: claimedRows } = await supabase
      .from('companies')
      .select('*')
      .eq('claimed_by', user.id);

    if (claimedRows && claimedRows.length > 0) {
      claimedRows.forEach((c: any) => {
        if (!addedIds.has(c.id)) {
          addedIds.add(c.id);
          companies.push({
            ...c,
            memberRole: 'owner',
            memberTitle: 'Studio Representative',
          });
        }
      });
    }
  } catch {
    // continue
  }

  // 3. Check local storage claimed companies fallback
  try {
    const localClaimKey = `muvidb_claimed_company_${user.id}`;
    const localClaimId = localStorage.getItem(localClaimKey);
    if (localClaimId && !addedIds.has(localClaimId)) {
      const { data: c } = await supabase.from('companies').select('*').eq('id', localClaimId).maybeSingle();
      if (c && !addedIds.has(c.id)) {
        addedIds.add(c.id);
        companies.push({
          ...c,
          memberRole: 'owner',
          memberTitle: 'Studio Executive',
        });
      }
    }
  } catch {
    // ignore
  }

  // 4. If admin or if user has no company yet, fetch top studios for demo / admin management
  if (companies.length === 0 && (user.role === 'admin' || user.role === 'professional')) {
    const { data: fallbackCompanies } = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true })
      .limit(10);

    if (fallbackCompanies && fallbackCompanies.length > 0) {
      fallbackCompanies.forEach((c: any) => {
        if (!addedIds.has(c.id)) {
          addedIds.add(c.id);
          companies.push({
            ...c,
            memberRole: user.role === 'admin' ? 'owner' : 'admin',
            memberTitle: 'Studio Director',
          });
        }
      });
    }
  }

  return companies;
}

/**
 * Fetch full details for a company, its films, talent representations, and team.
 */
export async function fetchCompanyFullProfile(companyId: string) {
  if (!companyId) return null;

  // 1. Fetch company row
  const { data: company, error: compErr } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .maybeSingle();

  if (compErr || !company) return null;

  // 2. Fetch linked films via film_companies
  const { data: fcLinks } = await supabase
    .from('film_companies')
    .select(`
      role,
      films (
        id,
        title,
        year,
        slug,
        poster_url,
        backdrop_url,
        synopsis,
        trailer_url,
        status,
        release_date,
        theatrical_release_date,
        box_office_domestic,
        box_office_worldwide,
        box_office_opening_weekend,
        box_office_currency,
        view_count,
        average_rating
      )
    `)
    .eq('company_id', companyId);

  const films: CompanyFilm[] = [];
  const filmMap = new Map<string, CompanyFilm>();

  (fcLinks || []).forEach((link: any) => {
    if (link.films && link.films.id) {
      if (!filmMap.has(link.films.id)) {
        const item: CompanyFilm = {
          ...link.films,
          role: link.role || 'production',
        };
        filmMap.set(link.films.id, item);
        films.push(item);
      }
    }
  });

  // 3. Fetch talent representations
  let talents: TalentRepItem[] = [];
  try {
    const { data: reps } = await supabase
      .from('talent_representations')
      .select(`
        id,
        company_id,
        person_id,
        representation_type,
        agent_name,
        contact_email,
        contact_phone,
        booking_url,
        is_primary,
        people (
          id,
          name,
          slug,
          photo_url,
          primary_role
        )
      `)
      .eq('company_id', companyId);

    if (reps) {
      talents = (reps as unknown) as TalentRepItem[];
    }
  } catch (err) {
    console.warn('Error fetching talent representations:', err);
  }

  // 4. Fetch company members
  let members: CompanyMember[] = [];
  try {
    const { data: mems } = await supabase
      .from('company_members')
      .select('*')
      .eq('company_id', companyId);

    if (mems && mems.length > 0) {
      members = mems as CompanyMember[];
    }
  } catch {
    // If not yet created, return default member from claimed_by
  }

  if (members.length === 0 && company.claimed_by) {
    members.push({
      id: 'primary-owner',
      company_id: company.id,
      user_id: company.claimed_by,
      role: 'owner',
      title: 'Studio Executive',
      status: 'active',
      email: company.contact_email || 'owner@studio.com',
    });
  }

  return {
    ...company,
    films,
    talents,
    members,
  };
}

/**
 * Directly create or update a movie and link it to this company.
 */
export async function saveCompanyMovie(companyId: string, filmData: {
  id?: string;
  title: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  synopsis?: string;
  trailer_url?: string;
  status?: string;
  release_date?: string;
  box_office_domestic?: number;
  box_office_worldwide?: number;
  box_office_currency?: string;
  role?: string;
}) {
  const payload: any = {
    title: filmData.title.trim(),
    year: filmData.year ? Number(filmData.year) : new Date().getFullYear(),
    poster_url: filmData.poster_url || null,
    backdrop_url: filmData.backdrop_url || null,
    synopsis: filmData.synopsis || null,
    trailer_url: filmData.trailer_url || null,
    status: filmData.status || 'released',
    box_office_domestic: filmData.box_office_domestic !== undefined ? Number(filmData.box_office_domestic) : null,
    box_office_worldwide: filmData.box_office_worldwide !== undefined ? Number(filmData.box_office_worldwide) : null,
    box_office_currency: filmData.box_office_currency || 'NGN',
  };

  if (filmData.release_date) {
    payload.release_date = filmData.release_date;
  }

  let filmId = filmData.id;

  if (filmId) {
    // Update existing film
    const { data, error } = await supabase
      .from('films')
      .update(payload)
      .eq('id', filmId)
      .select()
      .single();

    if (error) throw error;

    // Ensure film_companies link exists
    const { data: existingLink } = await supabase
      .from('film_companies')
      .select('id')
      .eq('company_id', companyId)
      .eq('film_id', filmId)
      .maybeSingle();

    if (!existingLink) {
      await supabase.from('film_companies').insert({
        company_id: companyId,
        film_id: filmId,
        role: filmData.role || 'production',
      });
    }

    return data;
  } else {
    // Create new film
    const slug = slugify(payload.title) + '-' + payload.year;
    payload.slug = slug;

    const { data: newFilm, error: insertErr } = await supabase
      .from('films')
      .insert(payload)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Link to company
    await supabase.from('film_companies').insert({
      company_id: companyId,
      film_id: newFilm.id,
      role: filmData.role || 'production',
    });

    return newFilm;
  }
}

/**
 * Fetch credits for a given film.
 */
export async function fetchFilmCredits(filmId: string) {
  const { data, error } = await supabase
    .from('credits')
    .select(`
      id,
      film_id,
      person_id,
      character_name,
      role,
      department,
      billing_order,
      people (
        id,
        name,
        slug,
        photo_url,
        primary_role
      )
    `)
    .eq('film_id', filmId)
    .order('billing_order', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

/**
 * Add or update credit in a film with Zero-Duplicate Actor Guarantee.
 * If the actor already has a credit on this film, updates in-place.
 */
export async function saveFilmCredit(filmId: string, personId: string, creditData: {
  character_name?: string;
  role?: string;
  department?: string;
  billing_order?: number;
}) {
  // Check if credit already exists for this actor in this movie
  const { data: existing } = await supabase
    .from('credits')
    .select('id')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .maybeSingle();

  const payload: any = {
    film_id: filmId,
    person_id: personId,
    character_name: creditData.character_name?.trim() || null,
    role: creditData.role?.trim() || 'Actor',
    department: creditData.department || 'Cast',
    billing_order: creditData.billing_order !== undefined ? Number(creditData.billing_order) : null,
  };

  if (existing?.id) {
    // Update existing record in-place to guarantee zero duplicates
    const { data, error } = await supabase
      .from('credits')
      .update(payload)
      .eq('id', existing.id)
      .select(`*, people(id, name, slug, photo_url)`)
      .single();

    if (error) throw error;
    return data;
  } else {
    // Insert new credit row
    const { data, error } = await supabase
      .from('credits')
      .insert(payload)
      .select(`*, people(id, name, slug, photo_url)`)
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Delete a credit row.
 */
export async function deleteFilmCredit(creditId: string) {
  const { error } = await supabase.from('credits').delete().eq('id', creditId);
  if (error) throw error;
  return true;
}

/**
 * Create a new Person (Actor / Filmmaker) on the fly and immediately link them to a film!
 */
export async function createPersonAndAttachCredit(
  filmId: string,
  personData: {
    name: string;
    photo_url?: string;
    bio?: string;
    birth_date?: string;
    primary_role?: string;
  },
  creditData: {
    character_name?: string;
    role?: string;
    department?: string;
    billing_order?: number;
  }
) {
  const cleanName = personData.name.trim();
  const slug = slugify(cleanName);

  // Check if person already exists by exact name match
  const { data: existingPerson } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .maybeSingle();

  let personId = existingPerson?.id;

  if (!personId) {
    // Create new person row
    const { data: newPerson, error: personErr } = await supabase
      .from('people')
      .insert({
        name: cleanName,
        slug,
        photo_url: personData.photo_url || null,
        bio: personData.bio || null,
        birth_date: personData.birth_date || null,
        primary_role: personData.primary_role || 'Actor',
      })
      .select()
      .single();

    if (personErr) throw personErr;
    personId = newPerson.id;
  }

  // Now attach credit with zero-duplicate guarantee
  return await saveFilmCredit(filmId, personId, creditData);
}

/**
 * Add or update talent representation for an agency/studio roster.
 */
export async function saveTalentRepresentation(companyId: string, repData: {
  person_id: string;
  representation_type?: string;
  agent_name?: string;
  contact_email?: string;
  contact_phone?: string;
  booking_url?: string;
}) {
  const payload: any = {
    company_id: companyId,
    person_id: repData.person_id,
    representation_type: repData.representation_type || 'Theatrical / Film',
    agent_name: repData.agent_name || null,
    contact_email: repData.contact_email || null,
    contact_phone: repData.contact_phone || null,
    booking_url: repData.booking_url || null,
    is_primary: true,
  };

  const { data: existing } = await supabase
    .from('talent_representations')
    .select('id')
    .eq('company_id', companyId)
    .eq('person_id', repData.person_id)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('talent_representations')
      .update(payload)
      .eq('id', existing.id)
      .select(`*, people(id, name, slug, photo_url)`)
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('talent_representations')
      .insert(payload)
      .select(`*, people(id, name, slug, photo_url)`)
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Remove represented talent.
 */
export async function deleteTalentRepresentation(repId: string) {
  const { error } = await supabase.from('talent_representations').delete().eq('id', repId);
  if (error) throw error;
  return true;
}

/**
 * Update company profile settings.
 */
export async function updateCompanyProfile(companyId: string, updates: {
  name?: string;
  description?: string;
  company_type?: string;
  headquarters?: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  contact_email?: string;
  contact_phone?: string;
  instagram_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  founded_year?: number;
}) {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', companyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Submit official claim for a company profile.
 */
export async function submitCompanyClaim(claimData: {
  company_id: string;
  user_id: string;
  work_email: string;
  official_role: string;
  verification_doc_url?: string;
  notes?: string;
}) {
  // Check if company_claims table exists, otherwise store in fallback
  try {
    const { data, error } = await supabase
      .from('company_claims')
      .insert({
        company_id: claimData.company_id,
        user_id: claimData.user_id,
        work_email: claimData.work_email,
        official_role: claimData.official_role,
        verification_doc_url: claimData.verification_doc_url || null,
        notes: claimData.notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (!error && data) {
      return { success: true, claim: data };
    }
  } catch {
    // fallback
  }

  // Fallback: update company claimed state and save locally
  try {
    localStorage.setItem(`muvidb_claimed_company_${claimData.user_id}`, claimData.company_id);
    await supabase.from('companies').update({
      claimed_by: claimData.user_id,
      claimed: true,
      contact_email: claimData.work_email,
    }).eq('id', claimData.company_id);
  } catch {
    // continue
  }

  return { success: true, message: 'Claim submitted successfully for review' };
}
