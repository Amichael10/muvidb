import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function insertAllPlays() {
  const allPlays = [
    // --- BAP PRODUCTIONS PLAYS ---
    {
      title: 'Saro The Musical',
      slug: 'saro-the-musical',
      playwright: 'Bolanle Austen-Peters & Team',
      director: 'Bolanle Austen-Peters',
      producer: 'BAP Productions',
      venue: 'Terra Kulture & Shaw Theatre',
      city: 'Lagos & London',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A high-octane musical extravaganza detailing the journeys of four ambitious young men who migrate to Lagos in search of fame, fortune, and artistic freedom.',
      genre: 'Musical Drama',
      year: 2013,
      status: 'archived'
    },
    {
      title: 'Wakaa! The Musical',
      slug: 'wakaa-the-musical',
      playwright: 'Bolanle Austen-Peters & Team',
      director: 'Bolanle Austen-Peters',
      producer: 'BAP Productions',
      venue: 'Terra Kulture & Shaw Theatre',
      city: 'Lagos & London',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A satire about political trial, youth ambition, social struggle, and love among fresh university graduates in Nigeria.',
      genre: 'Satirical Musical',
      year: 2016,
      status: 'archived'
    },
    {
      title: 'Fela and the Kalakuta Queens',
      slug: 'fela-and-the-kalakuta-queens',
      playwright: 'Bolanle Austen-Peters',
      director: 'Bolanle Austen-Peters',
      producer: 'BAP Productions',
      venue: 'Terra Kulture Arena & Cairo Opera House',
      city: 'Lagos & Cairo',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800',
      synopsis: 'An exhilarating musical chronicle of Afrobeat legend Fela Kuti and the fierce, loyal women who supported his music, political activism, and Kalakuta Republic.',
      genre: 'Biographical Musical',
      year: 2017,
      status: 'archived'
    },
    {
      title: 'Queen Moremi The Musical',
      slug: 'queen-moremi-the-musical',
      playwright: 'Bolanle Austen-Peters',
      director: 'Bolanle Austen-Peters',
      producer: 'BAP Productions',
      venue: 'Terra Kulture Arena',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A grand Yoruba historical stage production recounting Queen Moremi Ajasoro of Ile-Ife and her brave sacrifice to liberate her people.',
      genre: 'Historical Epic Musical',
      year: 2018,
      status: 'archived'
    },
    {
      title: 'Motherland The Musical',
      slug: 'motherland-the-musical',
      playwright: 'Bolanle Austen-Peters',
      director: 'Bolanle Austen-Peters',
      producer: 'BAP Productions',
      venue: 'Terra Kulture Arena',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800',
      synopsis: "A rich theatrical story of Nigeria's political evolution, hope, resilience, and unity told through energetic song, traditional dance, and poignant drama.",
      genre: 'Musical Drama',
      year: 2022,
      status: 'archived'
    },
    {
      title: 'Oluronbi The Musical',
      slug: 'oluronbi-the-musical',
      playwright: 'Bolanle Austen-Peters',
      director: 'Bolanle Austen-Peters',
      producer: 'BAP Productions',
      venue: 'Terra Kulture Arena',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1518834107882-7782e6e8c63b?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A enchanting Yoruba folklore musical of Oluronbi who makes a desperate pledge to the tree spirit to gain beauty and child-bearing grace.',
      genre: 'Folklore Musical',
      year: 2021,
      status: 'archived'
    },
    {
      title: "The Secret Lives of Baba Segi's Wives",
      slug: 'secret-lives-of-baba-segis-wives',
      playwright: 'Rotimi Babatunde (Adapted from Lola Shoneyin)',
      director: 'Femi Elufowoju Jr.',
      producer: 'BAP Productions & Arcola Theatre',
      venue: 'Terra Kulture Arena & Arcola Theatre London',
      city: 'Lagos & London',
      country: 'Nigeria / UK',
      poster_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A satirical stage adaptation of Lola Shoneyin\'s acclaimed novel following Baba Segi\'s polygamous household rocked by secrets, jealousy, and unexpected truths.',
      genre: 'Satirical Stage Play',
      year: 2018,
      status: 'archived'
    },

    // --- NATIONAL THEATRE NIGERIA PLAYS ---
    {
      title: 'I Wish, I Wish (Parts 1 & 2)',
      slug: 'i-wish-i-wish',
      playwright: 'Bola Edwards (Grandma Wura)',
      director: 'Bola Edwards',
      producer: 'Proud African Roots & National Theatre',
      venue: 'Main Bowl, National Theatre',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A landmark multi-cast musical drama staged at the newly renovated National Theatre featuring over 100 performers, live orchestra, and theatrical storytelling.',
      genre: 'Grand Musical',
      year: 2026,
      status: 'currently_running'
    },
    {
      title: 'Queen Idia',
      slug: 'queen-idia-stage-play',
      playwright: 'National Troupe of Nigeria',
      director: 'Tola Akerele & National Troupe',
      producer: 'National Theatre of Nigeria',
      venue: 'National Theatre Main Bowl',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A historical epic stage drama showcasing the Benin Kingdom legend of Queen Idia, featuring traditional warrior dance, royal court dialogue, and coral regalia.',
      genre: 'Historical Epic Drama',
      year: 2026,
      status: 'upcoming'
    },
    {
      title: 'Langbodo',
      slug: 'langbodo-festac-77',
      playwright: 'Wale Ogunyemi',
      director: 'Dapo Adelugba',
      producer: 'Federal Ministry of Culture & National Theatre',
      venue: 'National Theatre Main Bowl',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&q=80&w=800',
      synopsis: 'The landmark official Nigerian entry play presented at the newly opened National Theatre during FESTAC \'77 based on D.O. Fagunwa\'s Ogboju Ode Ninu Igbo Irunmale.',
      genre: 'Cultural Allegorical Drama',
      year: 1977,
      status: 'archived'
    },
    {
      title: "Death and the King's Horseman",
      slug: 'death-and-the-kings-horseman',
      playwright: 'Wole Soyinka',
      director: 'Wole Soyinka & National Troupe',
      producer: 'National Troupe of Nigeria',
      venue: 'National Theatre Main Bowl',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=800',
      synopsis: 'Wole Soyinka\'s masterpiece tragedy exploring ancient Yoruba tradition, ritual obligation, colonial intervention, and metaphysical duty.',
      genre: 'Yoruba Tragedy',
      year: 1975,
      status: 'archived'
    },
    {
      title: 'Oba Ovonramwen',
      slug: 'oba-ovonramwen',
      playwright: 'Ola Rotimi',
      director: 'Ola Rotimi',
      producer: 'National Theatre of Nigeria',
      venue: 'National Theatre Main Bowl',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1518834107882-7782e6e8c63b?auto=format&fit=crop&q=80&w=800',
      synopsis: 'Ola Rotimi\'s historical masterpiece chronicling the 1897 British punitive expedition against King Ovonramwen Nogbaisi and the historic Benin Empire.',
      genre: 'Historical Tragedy',
      year: 1971,
      status: 'archived'
    },
    {
      title: 'Kurunmi',
      slug: 'kurunmi-ola-rotimi',
      playwright: 'Ola Rotimi',
      director: 'Ola Rotimi',
      producer: 'National Theatre & National Troupe',
      venue: 'National Theatre Main Bowl',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800',
      synopsis: 'A powerful Yoruba historical tragedy depicting General Kurunmi of Ijaye as he defends Yoruba ancestral traditions against change and civil war.',
      genre: 'Historical War Drama',
      year: 1969,
      status: 'archived'
    },
    {
      title: 'Tales By Moonlight (Live Stage Edition)',
      slug: 'tales-by-moonlight-stage',
      playwright: 'National Theatre Creative Team',
      director: 'Tola Akerele',
      producer: 'National Theatre of Nigeria',
      venue: 'National Theatre Open Air Arena',
      city: 'Lagos',
      country: 'Nigeria',
      poster_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800',
      synopsis: 'An interactive live stage performance bringing classic Nigerian animal fables, moral folklore, and fireside storytelling to life for family audiences.',
      genre: 'Folklore Stage Drama',
      year: 2026,
      status: 'upcoming'
    }
  ];

  console.log(`Starting insertion of ${allPlays.length} total theatre plays...`);

  for (const play of allPlays) {
    const { data: existing } = await supabase
      .from('plays')
      .select('id, title')
      .eq('slug', play.slug)
      .maybeSingle();

    if (!existing) {
      const { data: inserted, error } = await supabase
        .from('plays')
        .insert(play)
        .select()
        .single();

      if (error) {
        console.error(`Error inserting ${play.title}:`, error);
      } else {
        console.log(`✓ Inserted play: ${play.title} (ID: ${inserted.id})`);
      }
    } else {
      const { error: updateErr } = await supabase
        .from('plays')
        .update(play)
        .eq('id', existing.id);

      if (updateErr) {
        console.error(`Error updating ${play.title}:`, updateErr);
      } else {
        console.log(`✓ Updated existing play: ${play.title} (ID: ${existing.id})`);
      }
    }
  }

  console.log('--- ALL THEATRE PLAYS SUCCESSFULLY INSERTED & UPDATED IN DB ---');
}

insertAllPlays();
