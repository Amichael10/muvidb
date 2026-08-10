import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const FILMONE_COMPANY_ID = '4738381b-d428-45d8-9179-688c5172d657'; // Filmone Entertainment

const FILMONE_TITLES = [
  // 2025 YearBook Top Titles
  'Everybody Loves Jenifa',
  'Queen Lateefah',
  'Ajosepo',
  'Beast Of Two Worlds',
  'Ajakaju',
  'Alakada: Bad And Boujee',
  'Lakatabu',
  'The Waiter',
  "Farmer's Bride",
  'Funmilayo Ransome Kuti',
  'Muri & Ko',
  'Outside',
  'Red Circle',
  "All's Fair In Love",
  'Thin Line',
  'L.I.F.E.',
  'Ghetto Love Story',
  // 2019-2024 YearBook Top Nollywood Blockbusters
  'A Tribe Called Judah',
  'Battle On Buka Street',
  'Omo Ghetto: The Saga',
  'Orisa',
  'Kesari',
  'Merry Men',
  'Ada Omo Baba Oloba',
  'Hotel Labamba',
  'Ijakumo',
  'Brotherhood',
  'King of Thieves',
  'Fate of Alakada',
  'Sugar Rush',
  'Prophetess',
  "Quam's Money",
  'The Ghost and the Tout Too',
  'Mamba\'s Diamond',
  'Dwindle',
  'My Village People',
  'Swallow',
  'Bad Comments',
  'Devil in Agbada',
  'Breaded Life',
  'The Prophetess',
  'Passport',
  'Palava',
  'Domitilla: The Reboot',
  'Listening Post',
  'The Trade',
  'Gangs of Lagos',
  'Jagun Jagun',
  'Mikolo',
  'The Kujus',
  'Kujus Again',
  'Akudaaya'
];

async function updateFilmOneDistributor() {
  console.log('🎬 Updating FilmOne Entertainment distribution attribution across Nollywood films...');

  let updatedCount = 0;
  let linkedCompanyCount = 0;

  for (const titleStr of FILMONE_TITLES) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, streaming_links')
      .ilike('title', `%${titleStr}%`);

    if (error) {
      console.error(`Error querying title "${titleStr}":`, error.message);
      continue;
    }

    if (!films || films.length === 0) {
      console.log(`ℹ️ Title not found in DB: "${titleStr}"`);
      continue;
    }

    for (const film of films) {
      const links = typeof film.streaming_links === 'object' && film.streaming_links ? film.streaming_links : {};
      const updatedLinks = { ...links, distributor: 'FilmOne Entertainment' };

      // 1. Update streaming_links in films table
      const { error: updateErr } = await supabase
        .from('films')
        .update({
          streaming_links: updatedLinks,
        })
        .eq('id', film.id);

      if (updateErr) {
        console.error(`Error updating "${film.title}":`, updateErr.message);
      } else {
        updatedCount++;
        console.log(`✅ Updated distributor for "${film.title}"`);
      }

      // 2. Link FilmOne in film_companies as distribution company
      const { data: existingCompanyLink } = await supabase
        .from('film_companies')
        .select('id')
        .eq('film_id', film.id)
        .eq('company_id', FILMONE_COMPANY_ID)
        .maybeSingle();

      if (!existingCompanyLink) {
        const { error: companyLinkErr } = await supabase
          .from('film_companies')
          .insert([{
            film_id: film.id,
            company_id: FILMONE_COMPANY_ID,
            role: 'distribution'
          }]);

        if (companyLinkErr) {
          console.error(`Error linking FilmOne company for "${film.title}":`, companyLinkErr.message);
        } else {
          linkedCompanyCount++;
        }
      }
    }
  }

  console.log(`\n🎉 Complete!`);
  console.log(`- Updated ${updatedCount} film records with distributor = "FilmOne Entertainment"`);
  console.log(`- Linked ${linkedCompanyCount} film-company association records in DB.`);
}

updateFilmOneDistributor();
