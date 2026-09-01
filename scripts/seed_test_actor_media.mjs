import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedTestActor() {
  console.log('🌟 Enriching End To End Test account with rich media...');

  const personId = 'c3ce398d-7c69-47db-bafa-817a6e9b2bff';

  const mockBio = 'End To End Test is an acclaimed Nollywood actor, producer, and performing artist known for versatile character portrayals in critically acclaimed African cinema, theatrical productions, and award-winning blockbusters.';

  const mockHighlights = [
    {
      id: 'media_1',
      type: 'video',
      category: 'showreel',
      title: 'Official Acting Showreel 2026',
      url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/actors/c3ce398d-7c69-47db-bafa-817a6e9b2bff/videos/official_showreel_2026.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      embed_provider: 'youtube',
      embed_id: 'dQw4w9WgXcQ',
      duration: '2:45'
    },
    {
      id: 'media_2',
      type: 'video',
      category: 'monologue',
      title: 'Dramatic Monologue - "The Betrayal of Oba"',
      url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/actors/c3ce398d-7c69-47db-bafa-817a6e9b2bff/videos/dramatic_monologue.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
      embed_provider: 'youtube',
      embed_id: 'L_LUpnjgPso',
      duration: '1:30'
    },
    {
      id: 'media_3',
      type: 'video',
      category: 'scene_clip',
      title: 'Climax Scene from "The Royal Mandate"',
      url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/actors/c3ce398d-7c69-47db-bafa-817a6e9b2bff/videos/royal_mandate_scene.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
      embed_provider: 'youtube',
      embed_id: '3JZ_D3ELwOQ',
      duration: '3:12'
    },
    {
      id: 'photo_1',
      type: 'photo',
      category: 'headshot',
      title: 'Official Headshot 2026',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85',
      thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80',
      width: 1200,
      height: 1600,
      aspect_ratio: '3:4'
    },
    {
      id: 'photo_2',
      type: 'photo',
      category: 'production_still',
      title: 'On-set Behind the Scenes - "Warrior\'s Oath"',
      url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1400&q=85',
      thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
      width: 1400,
      height: 933,
      aspect_ratio: '16:9'
    },
    {
      id: 'photo_3',
      type: 'photo',
      category: 'red_carpet',
      title: 'AMVCA Awards Red Carpet Appearance',
      url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1200&q=85',
      thumbnail: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=500&q=80',
      width: 1200,
      height: 1600,
      aspect_ratio: '3:4'
    }
  ];

  const mockAwards = [
    { name: 'Africa Magic Viewers Choice Awards (AMVCA)', category: 'Best Actor in a Drama', year: 2025, status: 'Winner' },
    { name: 'Africa Movie Academy Awards (AMAA)', category: 'Best Performance by an Actor in a Leading Role', year: 2024, status: 'Winner' },
    { name: 'Nigeria Entertainment Awards', category: 'Best Lead Actor', year: 2023, status: 'Nominee' }
  ];

  const { data: updated, error } = await supabase
    .from('people')
    .update({
      bio: mockBio,
      birthplace: 'Lagos, Nigeria',
      date_of_birth: '1992-05-18',
      gender: 'Male',
      nationality: 'Nigerian',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=85',
      popularity_score: 950,
      is_spotlight: true,
      is_verified: true,
      awards: mockAwards,
      youtube_stats: {
        banner: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1600&q=80',
        videos: '12',
        thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        subscribers: '45.2K',
        instagram_highlights: mockHighlights
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', personId)
    .select('*')
    .single();

  if (error) {
    console.error('Update error:', error.message);
  } else {
    console.log('✅ Successfully enriched End To End Test account:');
    console.log('  Name:', updated.name);
    console.log('  Slug:', updated.slug);
    console.log('  URL: /actors/' + updated.slug);
    console.log('  Photo:', updated.photo_url);
    console.log('  Highlights count:', updated.youtube_stats?.instagram_highlights?.length);
    console.log('  Awards count:', updated.awards?.length);
  }

  // Also link a couple of Nollywood films to this actor
  const { data: films } = await supabase.from('films').select('id, title').limit(4);
  if (films && films.length > 0) {
    for (const f of films) {
      await supabase.from('credits').upsert({
        film_id: f.id,
        person_id: personId,
        role: 'actor',
        character_name: 'Lead Character',
        source: 'manual_test'
      }, { onConflict: 'film_id,person_id,role' });
      console.log(`  🎬 Linked credit for film: "${f.title}"`);
    }
  }
}

seedTestActor().catch(console.error);
