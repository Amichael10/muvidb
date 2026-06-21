import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Initialize Groq (if key exists)
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// Initialize OpenAI (if key exists)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/**
 * Clean and parse JSON from AI response
 */
export function parseJSON(text: string) {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    // Try to extract JSON array from within surrounding text
    try {
      const bracketStart = text.indexOf('[');
      const bracketEnd = text.lastIndexOf(']');
      if (bracketStart !== -1 && bracketEnd > bracketStart) {
        const extracted = text.substring(bracketStart, bracketEnd + 1);
        return JSON.parse(extracted);
      }
    } catch (err2) {
      // Also try extracting a JSON object
      try {
        const objStart = text.indexOf('{');
        const objEnd = text.lastIndexOf('}');
        if (objStart !== -1 && objEnd > objStart) {
          const extracted = '[' + text.substring(objStart, objEnd + 1) + ']';
          return JSON.parse(extracted);
        }
      } catch (err3) {}
    }
    console.error('Failed to parse AI JSON. Raw text was:', text.substring(0, 500) + '...');
    return [];
  }
}

/**
 * Unified request handler with rotation + fallback + telemetry
 * Supports Gemini, Groq, and OpenAI (ChatGPT)
 */
export async function generateAIContent(prompt: string) {
  const providers = [];
  
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini',
      execute: async () => {
        const result = await geminiModel.generateContent(prompt);
        return { text: result.response.text(), engine: 'gemini', headers: null };
      }
    });
  }

  if (openai) {
    providers.push({
      name: 'openai',
      execute: async () => {
        const response = await openai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'gpt-4o-mini',
          temperature: 0.3,
        });
        const text = response.choices[0]?.message?.content || '';
        return { text, engine: 'openai', headers: null };
      }
    });
  }

  if (groq) {
    providers.push({
      name: 'groq',
      execute: async () => {
        // Primary Groq Model
        try {
          const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
          }).asResponse();
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          return { text: data.choices[0]?.message?.content || '', engine: 'groq', headers: response.headers };
        } catch (err: any) {
          // If 70b is limited, try the smaller 8b model as a sub-fallback
          console.warn('Groq 70b limited, trying 8b instant...');
          const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
          }).asResponse();
          const data = await response.json();
          return { text: data.choices[0]?.message?.content || '', engine: 'groq-8b', headers: response.headers };
        }
      }
    });
  }

  if (providers.length === 0) {
    throw new Error('No AI providers configured. Please check GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY.');
  }

  // Shuffle providers to distribute load if both are available
  const shuffled = [...providers].sort(() => Math.random() - 0.5);
  let lastError = null;

  for (const provider of shuffled) {
    try {
      console.log(`Trying AI Provider: ${provider.name}...`);
      const { text, engine, headers } = await provider.execute();
      
      let telemetry: any = { engine, status: 'ok', remaining: 100, reset: 0 };
      if (engine === 'groq' && headers) {
        telemetry.remaining = parseInt(headers.get('x-ratelimit-remaining-tokens') || '0');
        telemetry.reset = parseFloat(headers.get('x-ratelimit-reset-tokens') || '0');
      }

      return { text, telemetry };
    } catch (err: any) {
      lastError = err;
      console.warn(`Provider ${provider.name} failed:`, err.message);
      // Continue to next provider
    }
  }

  throw lastError || new Error('All AI providers failed');
}

/**
 * Vision Content Generator (Gemini Flash Vision)
 */
export async function generateAIVisionContent(prompt: string, base64Data: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Vision AI requires Gemini.');
  }
  
  console.log(`[AI Service] Sending Vision request to Gemini (mimeType: ${mimeType})...`);
  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  };

  // Attempt 1: Gemini 2.5 Flash (primary)
  try {
    const result = await geminiModel.generateContent([prompt, imagePart]);
    return {
      text: result.response.text(),
      telemetry: { engine: 'gemini-vision-2.5', status: 'ok' }
    };
  } catch (err: any) {
    console.warn('[AI Service] Gemini 2.5 Flash Vision failed:', err.message);

    // Attempt 2: Gemini 2.0 Flash Lite (free tier fallback)
    try {
      console.log('[AI Service] Trying Gemini 2.0 Flash Lite fallback...');
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      const result = await fallbackModel.generateContent([prompt, imagePart]);
      return {
        text: result.response.text(),
        telemetry: { engine: 'gemini-vision-2.0-lite', status: 'ok' }
      };
    } catch (fallbackErr: any) {
      console.warn('[AI Service] Gemini 2.0 Flash Lite fallback failed:', fallbackErr.message);

      // Attempt 3: OpenAI gpt-4o-mini vision (if configured)
      if (openai) {
        try {
          console.log('[AI Service] Trying OpenAI Vision fallback...');
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
              ]
            }],
            temperature: 0.2,
          });
          return {
            text: response.choices[0]?.message?.content || '',
            telemetry: { engine: 'openai-vision-4o-mini', status: 'ok' }
          };
        } catch (openaiErr: any) {
          console.error('[AI Service] OpenAI Vision fallback failed:', openaiErr.message);
          throw new Error(`All vision providers failed. Gemini 2.5: ${err.message} | Gemini 2.0 Lite: ${fallbackErr.message} | OpenAI: ${openaiErr.message}`);
        }
      }

      throw new Error(`Vision API failed: ${err.message} (Gemini 2.0 Lite fallback: ${fallbackErr.message}). No OpenAI key configured for further fallback.`);
    }
  }
}
