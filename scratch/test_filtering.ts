import { generateAIContent } from '../api/_lib/ai_service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testFiltering() {
  const titles = [
    { title: '007: Road to 1 Million', synopsis: 'A competition show inspired by James Bond.', cast: ['Brian Cox'] },
    { title: 'Brotherhood', synopsis: 'Two brothers on opposite sides of the law in Lagos.', cast: ['Tobi Bakre', 'Falz'] },
    { title: 'Gangs of Lagos', synopsis: 'Street life in Isale Eko.', cast: ['Tobi Bakre'] }
  ];

  for (const movie of titles) {
    console.log(`\nTesting: ${movie.title}`);
    
    // Regex Check
    const isExcluded = /007|James Bond|Mission Impossible|Marvel|Avengers|Hollywood/i.test(movie.title);
    if (isExcluded) {
      console.log('  ❌ Regex: Excluded');
    } else {
      console.log('  ✅ Regex: Passed');
      
      // AI Check
      const prompt = `Identify if the following film is a Nollywood (Nigerian) or African production. 
Title: ${movie.title}
Synopsis: ${movie.synopsis}
Cast: ${movie.cast?.join(', ')}

Return ONLY a JSON object: {"isAfrican": true/false, "confidence": 0-1, "reason": "brief reason"}`;

      try {
        const { text, telemetry } = await generateAIContent(prompt);
        console.log(`  🤖 AI (${telemetry.engine}): ${text.trim()}`);
      } catch (e) {
        console.error('  ⚠️ AI failed');
      }
    }
  }
}

testFiltering();
