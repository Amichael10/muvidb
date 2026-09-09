import { supabase } from './lib/db';
import { embedWithCohere, hasCohere } from '../api/_lib/ai_service';
import { createHash } from 'crypto';

async function embedOgundeFilms() {
  if (!hasCohere()) {
    console.log('Cohere is not configured, skipping embedding.');
    return;
  }

  const { data: films } = await supabase
    .from('films')
    .select('id, title, synopsis')
    .or('slug.eq.aiye-1979,slug.eq.jaiyesimi-1980,slug.eq.aropin-ntenia-1982,slug.eq.ayanmo-1989,slug.eq.mister-johnson-1990');

  if (!films?.length) {
    console.log('No films found');
    return;
  }

  console.log(`Embedding ${films.length} films...`);
  const texts = films.map(f => `${f.title}. ${f.synopsis || ''}`.slice(0, 8000));
  const res = await embedWithCohere(texts, 'search_document');

  if (res?.embeddings) {
    for (let i = 0; i < films.length; i++) {
      const f = films[i];
      const vec = res.embeddings[i];
      const text = texts[i];
      const hash = createHash('sha256').update(text).digest('hex').slice(0, 32);

      const { error } = await supabase
        .from('film_embeddings')
        .upsert({
          film_id: f.id,
          embedding: `[${vec.join(',')}]`,
          content_hash: hash,
          model: 'embed-v4.0',
          updated_at: new Date().toISOString()
        }, { onConflict: 'film_id' });

      if (error) console.error(`Error embedding ${f.title}:`, error.message);
      else console.log(`✓ Embedded ${f.title}`);
    }
  }
}

embedOgundeFilms().catch(console.error);
