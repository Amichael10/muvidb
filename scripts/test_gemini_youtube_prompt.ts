import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || '';
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();
  console.log('Available models:', json.models ? json.models.map((m: any) => m.name) : json);
}

async function generateSynopsisWithGemini(title: string, youtubeUrl: string) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `You are the MuviDB AI Movie Specialist.

Target Movie Title: "${title}"
YouTube Video Link: "${youtubeUrl}"

Instructions:
Write me a MuviDB worthy synopsis for this movie, the genre and age rating for it.

Output format strictly as valid JSON with keys:
{
  "synopsis": "Clean, engaging 2-4 sentence plot synopsis of the movie",
  "genres": ["Primary Genre", "Secondary Genre"],
  "age_rating": "PG-13"  // Must be one of: "G", "PG", "PG-13", "15", "18"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').strip?.() || text.trim();
    const parsed = JSON.parse(cleanJson);
    return parsed;
  } catch (err) {
    console.error(`Gemini error for ${title}:`, err);
    return null;
  }
}

async function runTest() {
  await listModels();
  const candidates = JSON.parse(fs.readFileSync('movies_enrichment_candidates.json', 'utf-8'));
  console.log(`Running YouTube Gemini prompt test on first 3 candidates...\n`);

  for (let i = 0; i < Math.min(3, candidates.length); i++) {
    const c = candidates[i];
    console.log(`🎬 Target: ${c.title} (${c.youtube_url})`);
    const res = await generateSynopsisWithGemini(c.title, c.youtube_url);
    console.log('Result:', JSON.stringify(res, null, 2));
    console.log('--------------------------------------------------\n');
  }
}

runTest();
