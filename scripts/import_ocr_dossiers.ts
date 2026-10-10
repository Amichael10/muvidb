import { supabase } from './lib/db';
import fs from 'fs';
import path from 'path';

const OCR_DIR = 'C:\\Users\\User\\Downloads\\OCR';
const STORAGE_BUCKET = 'posters';
const SUPABASE_BASE_URL = 'https://pkenrmorywmuvnzfoylp.supabase.co';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

interface CompanyLink {
  name: string;
  role: 'production' | 'distribution';
}

interface CreditLink {
  name: string;
  role: 'actor' | 'director' | 'producer' | 'writer' | 'editor' | 'executive producer';
  character_name?: string;
  billing_order?: number;
}

interface FilmDossier {
  knownId?: string;
  title: string;
  original_title?: string;
  year?: number;
  synopsis: string;
  tagline?: string;
  awards?: string;
  posterFile?: string;
  companies: CompanyLink[];
  credits: CreditLink[];
}

const dossiers: FilmDossier[] = [
  {
    knownId: '5b356060-61b1-413b-ba9b-06b955262383',
    title: 'Adebimpe Omo Oba',
    year: 2019,
    synopsis: "Once upon a time in a faraway land, there lived a beautiful princess named Adebimpe. She is the essence of compassion, humility and meekness. She isn't daunted by the responsibilities that the role of a princess creates; instead her tragedy is the oppression, conspiracy, and cruelty by her loved ones. A tale of a charming princess and her battles—the conspiracy of silence and love.",
    tagline: 'Caught in between — love, conspiracy & royal legacy',
    posterFile: '52702570_835536530111627_1845618125073022976_n.jpg',
    companies: [
      { name: 'Oyebade Adebimpe Productions', role: 'production' },
      { name: 'Slate 1 FIlms Production', role: 'production' },
      { name: 'Corporate Pictures', role: 'distribution' },
      { name: 'Kehinde Adeyemi Films', role: 'distribution' }
    ],
    credits: [
      { name: 'Bogunmbe Abiola Paul', role: 'director' },
      { name: 'Adebimpe Oyebade', role: 'producer' },
      { name: 'Adebimpe Oyebade', role: 'writer' },
      { name: 'Adebimpe Oyebade', role: 'actor', character_name: 'Princess Adebimpe', billing_order: 1 },
      { name: 'Lateef Adedimeji', role: 'actor', billing_order: 2 }
    ]
  },
  {
    title: 'The Cooker',
    year: 2020,
    synopsis: "Some families create their own storm, then get upset when it rains heavily... Produced by Oyebade Adebimpe Productions.",
    tagline: 'Some families create their own storm, then get upset when it rains heavily...',
    posterFile: '120106607_1295704800761462_5176442545825196630_n.jpg',
    companies: [
      { name: 'Oyebade Adebimpe Productions', role: 'production' }
    ],
    credits: [
      { name: 'Adebimpe Oyebade', role: 'producer' },
      { name: 'Adebimpe Oyebade', role: 'writer' },
      { name: 'Adebimpe Oyebade', role: 'actor', billing_order: 1 }
    ]
  },
  {
    title: 'The Beginning and the End',
    original_title: 'Ibere Ati Opin',
    year: 2019,
    synopsis: "You must first deal with the hurt feelings before moving into forgiveness. A stirring drama featuring Lateef Adedimeji and Adebimpe Oyebade.",
    tagline: 'You must first deal with the hurt feelings before moving into forgiveness',
    posterFile: '55875088_859949437670336_7898111988788625408_n.jpg',
    companies: [
      { name: 'Oluwakemi Studios', role: 'production' },
      { name: 'Slate 1 FIlms Production', role: 'production' }
    ],
    credits: [
      { name: 'Bogunmbe Abiola Paul', role: 'director' },
      { name: 'Bogunmbe Abiola Paul', role: 'producer' },
      { name: 'Lateef Adedimeji', role: 'actor', billing_order: 1 },
      { name: 'Adebimpe Oyebade', role: 'actor', billing_order: 2 }
    ]
  },
  {
    title: 'Resentment',
    year: 2019,
    synopsis: "This anger inside and scars outside are marks from the wound within. A tale written by Oyebade Adebimpe displaying an extensive knowledge of storytelling.",
    tagline: 'This anger inside and scars outside are marks from the wound within',
    posterFile: '68952593_964837320514880_7151447102793449472_n.jpg',
    companies: [
      { name: 'Oyebade Adebimpe Productions', role: 'production' }
    ],
    credits: [
      { name: 'Adebimpe Oyebade', role: 'writer' },
      { name: 'Adebimpe Oyebade', role: 'producer' },
      { name: 'Adebimpe Oyebade', role: 'actor', billing_order: 1 }
    ]
  },
  {
    title: 'Osalawe',
    year: 2020,
    synopsis: "In the Yoruba pantheon, OSALAWE is a deity, a divine messenger of OLODUMARE. A guardian, protector and communicator. Through divination, she guides the fate of man. Comprising two words OSA (deity) and LAWE (deity of Lawe village), the Osa is selected amongst teenage girls accompanied by a male inborn warlord called IRIJU. Installed alongside her Iriju, Osalawe sprinkles water of protection all over the village riding on a white horse.",
    tagline: 'The Divine Messenger of Olodumare',
    posterFile: '58460718_878361469162466_249622794868883456_n.jpg',
    companies: [
      { name: 'Slate 1 FIlms Production', role: 'production' }
    ],
    credits: [
      { name: 'Bogunmbe Abiola Paul', role: 'director' },
      { name: 'Bogunmbe Abiola Paul', role: 'producer' },
      { name: 'Dele Gbadebo', role: 'writer' }
    ]
  },
  {
    knownId: 'c207c3bc-e7d7-45df-bd2a-6ee36f797fc6',
    title: 'Majele',
    original_title: 'Majele (Poison)',
    year: 2019,
    synopsis: "Majele (Poison) is a Yoruba period drama set in the 1980s by filmmaker Bogunmbe Abiola Paul. Exploring intricate webs of family, betrayal, and venomous intrigue, it made history as the first indigenous Yoruba language movie selected to be screened at the Real-time International Film Festival (RTF 2019).",
    tagline: 'From the producer of Ayewo & Ookun',
    awards: 'Official Selection - Real-time International Film Festival (RTF 2019)',
    posterFile: '33114987_642381882760427_280120232356347904_n.jpg',
    companies: [
      { name: 'Slate 1 FIlms Production', role: 'production' }
    ],
    credits: [
      { name: 'Bogunmbe Abiola Paul', role: 'director' },
      { name: 'Bogunmbe Abiola Paul', role: 'producer' }
    ]
  },
  {
    title: 'IMO',
    year: 2020,
    synopsis: "In the mystery of life comes the journey of knowledge through the forest of wisdom. Tolanikawo Ayinke Onikoyi nicknamed IMO has discovered the mystery of knowledge, but little did she know that knowledge only takes you to the door but cannot open the door to greatness.",
    tagline: 'The Journey of Knowledge Through the Forest of Wisdom',
    posterFile: '120017982_1295703444094931_8547148694700851668_n.jpg',
    companies: [
      { name: 'Slate 1 FIlms Production', role: 'production' },
      { name: 'KTD Entertainment', role: 'distribution' },
      { name: 'Filmone Entertainment', role: 'distribution' },
      { name: 'Blue Pictures', role: 'distribution' }
    ],
    credits: [
      { name: 'Bogunmbe Abiola Paul', role: 'director' },
      { name: 'Dele Gbadebo', role: 'writer' },
      { name: 'Bolaji Ajala', role: 'editor' },
      { name: 'Adeola Olusola', role: 'actor', character_name: 'Tolanikawo Ayinke Onikoyi (IMO)', billing_order: 1 },
      { name: 'Muyiwa Ademola', role: 'actor', billing_order: 2 },
      { name: 'Jibola Dabo', role: 'actor', billing_order: 3 },
      { name: 'Motilola', role: 'actor', billing_order: 4 },
      { name: 'Tunde Oladimeji', role: 'actor', billing_order: 5 },
      { name: 'Abiodun Babalola', role: 'actor', billing_order: 6 }
    ]
  },
  {
    title: 'Afaila Ojo',
    year: 2017,
    synopsis: "A wealthy businessman, Ola, spirals into deep addiction. In a bid to rescue him, his close friend employs a dedicated therapist, Oluchi, who has herself weathered painful relationships. As Oluchi uses stern guidance to enforce his regimen, romance blossoms between them—unaware that Ola's wife and trusted business friend are secretly conspiring together to engineer his downfall.",
    posterFile: '498291609_2546428339022429_2331066418988105781_nyear 2017.jpg',
    companies: [
      { name: 'Slate 1 FIlms Production', role: 'production' },
      { name: 'Saridon-P NTBB Enterprises Ltd', role: 'distribution' }
    ],
    credits: [
      { name: 'Bogunmbe Abiola Paul', role: 'director' },
      { name: 'Alh. Yusuf NTBB', role: 'executive producer' },
      { name: 'Femi Adebayo', role: 'actor', character_name: 'Ola', billing_order: 1 },
      { name: 'Aishat Lawal', role: 'actor', character_name: 'Oluchi', billing_order: 2 },
      { name: 'Dayo Amusa', role: 'actor', character_name: "Ola's Wife", billing_order: 3 },
      { name: 'Ayo Mogaji', role: 'actor', character_name: 'Temilade', billing_order: 4 },
      { name: 'Adelola Tijani', role: 'actor', character_name: 'Muraino', billing_order: 5 }
    ]
  },
  {
    title: 'The Real Housewives of Iyana Ipaja',
    original_title: 'Iya Suberu',
    year: 2019,
    synopsis: "An outrageous comedy capturing neighborhood gossip, drama, and street clashes in the vibrant district of Iyana Ipaja. Featuring Ale Iya Onipara and an all-star ensemble cast navigating hilarious rivalries.",
    tagline: 'Meet Ale Iya Onipara. Can you laugh? Get a laugh tutor!',
    posterFile: '496930160_2543214529343810_8893947560900905570_n.jpg',
    companies: [
      { name: 'Broadway Films', role: 'production' },
      { name: 'Abebiade Production', role: 'production' },
      { name: 'Silverbird Film Distribution', role: 'distribution' },
      { name: 'Blue Pictures', role: 'distribution' },
      { name: 'Filmone Entertainment', role: 'distribution' }
    ],
    credits: [
      { name: 'Aremu Afolayan', role: 'director' },
      { name: 'Seun Olaiya', role: 'director' },
      { name: 'Aremu Afolayan', role: 'producer' },
      { name: 'Toyosi Fasaye', role: 'writer' },
      { name: 'Tolulope Elijah', role: 'writer' },
      { name: 'Bolaji Amusan', role: 'actor', character_name: 'Ale Iya Onipara', billing_order: 1 },
      { name: 'Kayode Olasehinde', role: 'actor', character_name: 'Aderupoko', billing_order: 2 },
      { name: 'Toyin Afolayan', role: 'actor', character_name: 'Lola Idije', billing_order: 3 },
      { name: 'Funsho Adeolu', role: 'actor', billing_order: 4 },
      { name: 'Jide Kosoko', role: 'actor', billing_order: 5 },
      { name: 'Ibrahim Yekini', role: 'actor', billing_order: 6 },
      { name: 'Ronke Oshodi Oke', role: 'actor', billing_order: 7 },
      { name: 'Lateef Adedimeji', role: 'actor', billing_order: 8 }
    ]
  },
  {
    knownId: 'b1634cf4-d87a-41d0-894d-114af2a94f68',
    title: 'Agbede Meji',
    original_title: 'Agbede Meji (Crossroad)',
    year: 2017,
    synopsis: "A gripping drama examining moral dilemmas, buried domestic secrets, and pivotal choices where lives hang in the balance at the crossroad of fate. Written and produced by Yomi Fabiyi.",
    tagline: 'Crossroad',
    posterFile: '498232128_2545195442479052_4439237718245082111_n.jpg',
    companies: [
      { name: 'Rocklaf Studio International', role: 'production' },
      { name: 'Yomi Fabiyi Films Production', role: 'production' },
      { name: 'Corporate Pictures', role: 'distribution' }
    ],
    credits: [
      { name: 'Abbey Lanre', role: 'director' },
      { name: 'Yomi Fabiyi', role: 'producer' },
      { name: 'Yomi Fabiyi', role: 'writer' },
      { name: 'Toyin Abraham', role: 'actor', billing_order: 1 },
      { name: 'Gabriel Afolayan', role: 'actor', billing_order: 2 },
      { name: 'Yomi Fabiyi', role: 'actor', billing_order: 3 },
      { name: 'Stella Monye', role: 'actor', billing_order: 4 }
    ]
  },
  {
    knownId: '5830592f-8a3a-4b15-8351-d7fa7045f000',
    title: 'The Royal Hibiscus Hotel',
    year: 2018,
    synopsis: "Ope, an aspiring London chef, returns home to Lagos hoping to modernize her parents' charming boutique hotel. Shocked to discover they are quietly selling it to an ambitious investor named Deji, complications intensify as an unexpected romance blooms between them.",
    awards: 'Official Selection - Toronto International Film Festival (TIFF 2017)',
    posterFile: '498249159_2544529272545669_6303222176223770854_n.jpg',
    companies: [
      { name: 'Ebonylife Films', role: 'production' },
      { name: 'Filmone Entertainment', role: 'distribution' },
      { name: 'Netflix', role: 'distribution' }
    ],
    credits: [
      { name: 'Ishaya Bako', role: 'director' },
      { name: 'Zainab Balogun', role: 'actor', character_name: 'Ope', billing_order: 1 },
      { name: 'Kenneth Okolie', role: 'actor', character_name: 'Deji', billing_order: 2 },
      { name: 'OC Ukeje', role: 'actor', character_name: 'Felix', billing_order: 3 },
      { name: 'Joke Silva', role: 'actor', character_name: 'Augusta', billing_order: 4 },
      { name: 'Rachel Oniga', role: 'actor', character_name: 'Rose', billing_order: 5 }
    ]
  },
  {
    title: 'The Minder (Agbomoto)',
    original_title: 'Agbomoto',
    year: 2018,
    synopsis: "Following the legacy of award-winning Metomi, The Minder (Agbomoto) introduces a dynamic, layered screenplay touching the intricate depths of human loyalty and destiny. Aso te ba ri lara egungun ti wa, t'egun wa ni se.",
    tagline: '...the story continues',
    posterFile: '497861287_2543214412677155_3985349298563379187_n.jpg',
    companies: [
      { name: 'Rocklaf Studio International', role: 'production' },
      { name: 'Yomi Fabiyi Films Production', role: 'production' },
      { name: 'Corporate Pictures', role: 'distribution' }
    ],
    credits: [
      { name: 'Yomi Fabiyi', role: 'producer' },
      { name: 'Yomi Fabiyi', role: 'writer' },
      { name: 'Yomi Fabiyi', role: 'actor', billing_order: 1 }
    ]
  }
];

async function getOrCreateCompany(name: string): Promise<string> {
  const cleanName = name.trim();
  const { data: existing } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  // Insert company
  const { data: inserted, error } = await supabase
    .from('companies')
    .insert({
      name: cleanName,
      slug: slugify(cleanName)
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`Could not create company "${cleanName}":`, error.message);
    // fallback check again
    const { data: retry } = await supabase.from('companies').select('id').ilike('name', cleanName).limit(1);
    if (retry && retry[0]) return retry[0].id;
    throw error;
  }

  console.log(`Created company: "${cleanName}" (${inserted.id})`);
  return inserted.id;
}

async function getOrCreatePerson(name: string): Promise<string> {
  const cleanName = name.trim();
  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  // Insert person
  const { data: inserted, error } = await supabase
    .from('people')
    .insert({
      name: cleanName,
      slug: slugify(cleanName)
    })
    .select('id')
    .single();

  if (error) {
    console.warn(`Could not create person "${cleanName}":`, error.message);
    const { data: retry } = await supabase.from('people').select('id').ilike('name', cleanName).limit(1);
    if (retry && retry[0]) return retry[0].id;
    throw error;
  }

  console.log(`Created person: "${cleanName}" (${inserted.id})`);
  return inserted.id;
}

async function uploadPosterFile(fileName: string, filmSlug: string): Promise<string | null> {
  const filePath = path.join(OCR_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Poster file not found: ${filePath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase().replace('.', '') || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const storagePath = `films/${filmSlug}-poster.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (uploadError) {
    console.warn(`⚠️ Could not upload poster to Supabase storage:`, uploadError.message);
    return null;
  }

  const publicUrl = `${SUPABASE_BASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
  console.log(`Uploaded poster for "${filmSlug}": ${publicUrl}`);
  return publicUrl;
}

async function main() {
  console.log(`=== Processing ${dossiers.length} Film Dossiers ===\n`);

  for (const item of dossiers) {
    console.log(`--------------------------------------------------`);
    console.log(`🎬 Processing: "${item.title}"`);

    const filmSlug = slugify(item.title);
    let filmId = item.knownId;

    if (!filmId) {
      // Look up film by exact or close title
      const { data: match } = await supabase
        .from('films')
        .select('id, title')
        .ilike('title', item.title)
        .limit(1);

      if (match && match.length > 0) {
        filmId = match[0].id;
        console.log(`Found existing film ID: ${filmId}`);
      }
    }

    // Upload poster if available
    let posterUrl: string | null = null;
    if (item.posterFile) {
      posterUrl = await uploadPosterFile(item.posterFile, filmSlug);
    }

    // Build payload for films table
    const filmPayload: Record<string, any> = {
      title: item.title,
      slug: filmSlug,
      synopsis: item.synopsis,
      status: 'released',
      is_nollywood: true
    };
    if (item.original_title) filmPayload.original_title = item.original_title;
    if (item.year) filmPayload.year = item.year;
    if (item.tagline) filmPayload.tagline = item.tagline;
    if (item.awards) filmPayload.awards = item.awards;
    if (posterUrl) filmPayload.poster_url = posterUrl;

    if (filmId) {
      const { error: updateErr } = await supabase
        .from('films')
        .update(filmPayload)
        .eq('id', filmId);

      if (updateErr) {
        console.error(`Error updating film "${item.title}":`, updateErr.message);
        continue;
      }
      console.log(`✅ Updated film: "${item.title}" (${filmId})`);
    } else {
      const { data: insertedFilm, error: insertErr } = await supabase
        .from('films')
        .insert(filmPayload)
        .select('id')
        .single();

      if (insertErr) {
        console.error(`Error inserting film "${item.title}":`, insertErr.message);
        continue;
      }
      filmId = insertedFilm.id;
      console.log(`Created new film: "${item.title}" (${filmId})`);
    }

    // Update film_companies (Multi-production & multi-distribution)
    // First clear existing links for this film
    await supabase.from('film_companies').delete().eq('film_id', filmId);

    const companyInserts: Array<{ film_id: string; company_id: string; role: string }> = [];
    for (const c of item.companies) {
      try {
        const cId = await getOrCreateCompany(c.name);
        companyInserts.push({
          film_id: filmId,
          company_id: cId,
          role: c.role
        });
      } catch (err: any) {
        console.warn(`Could not link company ${c.name}:`, err.message);
      }
    }

    if (companyInserts.length > 0) {
      const { error: compErr } = await supabase.from('film_companies').insert(companyInserts);
      if (compErr) {
        console.error(`Error linking companies for "${item.title}":`, compErr.message);
      } else {
        console.log(`Linked ${companyInserts.length} companies (${item.companies.map(c => `${c.name} [${c.role}]`).join(', ')})`);
      }
    }

    // Update credits (Strict zero-duplicate actor guarantee)
    for (const cr of item.credits) {
      try {
        const personId = await getOrCreatePerson(cr.name);

        // Check if credit already exists for this person in this film
        const { data: existingCreds } = await supabase
          .from('credits')
          .select('id, role, character_name, billing_order')
          .eq('film_id', filmId)
          .eq('person_id', personId);

        if (existingCreds && existingCreds.length > 0) {
          // Update in-place
          const target = existingCreds[0];
          await supabase
            .from('credits')
            .update({
              role: cr.role,
              character_name: cr.character_name || target.character_name,
              billing_order: cr.billing_order || target.billing_order
            })
            .eq('id', target.id);
        } else {
          // Insert new credit row
          await supabase
            .from('credits')
            .insert({
              film_id: filmId,
              person_id: personId,
              role: cr.role,
              character_name: cr.character_name || null,
              billing_order: cr.billing_order || null
            });
        }
      } catch (err: any) {
        console.warn(`Could not link credit ${cr.name}:`, err.message);
      }
    }
    console.log(`Attached ${item.credits.length} credits for "${item.title}"`);
  }

  console.log(`\n🎉 Completed all film imports and associations!`);
}

main().catch(console.error);
