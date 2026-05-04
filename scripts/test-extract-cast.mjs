import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const testTitles = [
  {id: '016c3274-515e-4cc5-b986-0db7cfd7b10b', title: 'Ago(cage) Starring Aishat Lawal Muyiwa Ademola, Lalude,biolafowosere,ozain,ejidealakara'},
  {id: '504b5d39-0e40-4e19-a24f-78fa97d68e08', title: 'MR & MRS JOHNSON EPISODE 5 THE NANNY STARRING TUNDE BERNARD, TOSIN OLANIYAN, NIYI JOHNSON, SEYI EDUN'},
  {id: 'fcda8866-9ab6-4411-ada8-f6333502e8ba', title: 'Oloore Latest Yoruba Movie 2024 Drama Starring Sisi Qudri | Peter Ijagbemi | Adeyemo Ifasooto'}
];

const prompt = `You are a Nollywood database editor. These YouTube video titles contain actor/cast names embedded in them.

Your job:
1. EXTRACT the clean movie title (remove all marketing noise, years, category labels).
2. EXTRACT all actor/cast names embedded in the title.

Rules:
- Proper Case all names.
- ONLY return entries where you found at least 1 cast member.

Return ONLY JSON: [{"id": "...", "old_title": "...", "new_title": "...", "cast": ["Name One", "Name Two"]}]

Titles: ${JSON.stringify(testTitles)}`;

// Try Gemini first
if (process.env.GEMINI_API_KEY) {
  console.log('=== Testing with Gemini ===');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('RAW:', text);
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log('\nPARSED COUNT:', parsed.length);
    console.log('FIRST:', JSON.stringify(parsed[0], null, 2));
  } catch (e) {
    console.error('Gemini error:', e.message);
  }
}

// Try Groq
if (process.env.GROQ_API_KEY) {
  console.log('\n=== Testing with Groq ===');
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
    });
    const text = response.choices[0]?.message?.content || '';
    console.log('RAW:', text);
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log('\nPARSED COUNT:', parsed.length);
    console.log('FIRST:', JSON.stringify(parsed[0], null, 2));
  } catch (e) {
    console.error('Groq error:', e.message);
  }
}
