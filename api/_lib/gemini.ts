import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

/**
 * Clean and parse JSON from Gemini's response
 */
export function parseJSON(text: string) {
  try {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse Gemini JSON:', e);
    return null;
  }
}
