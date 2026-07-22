import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Collect all keys for an env prefix: BASE, BASE_2 … BASE_10, plus a
// comma-separated list inside BASE. De-duped. Each free-tier key has its own
// quota, so rotating across them multiplies the daily ceiling.
function collectKeys(base: string): string[] {
  const raw: (string | undefined)[] = [process.env[base]];
  for (let i = 2; i <= 10; i++) raw.push(process.env[`${base}_${i}`]);
  return [
    ...new Set(
      raw.filter(Boolean).flatMap((k) => k!.split(',')).map((k) => k.trim()).filter(Boolean)
    ),
  ];
}

// Gemini: rotate on 429/RESOURCE_EXHAUSTED before falling back to OpenAI/Groq.
const GEMINI_KEYS = collectKeys('GEMINI_API_KEY');
let geminiKeyIdx = 0;

function geminiModelFor(model: string) {
  return new GoogleGenerativeAI(GEMINI_KEYS[geminiKeyIdx] || '').getGenerativeModel({ model });
}

function isGeminiQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 429 || /quota|resource_exhausted|rate limit|too many requests|\b429\b/.test(msg);
}

/** Run a Gemini call, rotating to the next key on quota errors. */
async function withGeminiRotation(model: string, fn: (m: any) => Promise<any>): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < Math.max(1, GEMINI_KEYS.length); attempt++) {
    try {
      return await fn(geminiModelFor(model));
    } catch (err: any) {
      lastErr = err;
      if (isGeminiQuotaError(err) && GEMINI_KEYS.length > 1) {
        console.warn(`[gemini] key #${geminiKeyIdx + 1}/${GEMINI_KEYS.length} quota hit, rotating…`);
        geminiKeyIdx = (geminiKeyIdx + 1) % GEMINI_KEYS.length;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Groq: same multi-key rotation as Gemini.
const GROQ_KEYS = collectKeys('GROQ_API_KEY');
let groqKeyIdx = 0;
const groqClientFor = () => new Groq({ apiKey: GROQ_KEYS[groqKeyIdx] || '' });

function isGroqQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 429 || /quota|rate limit|rate_limit|too many requests|\b429\b/.test(msg);
}

/** A revoked/typo'd key (401). Unlike a quota error this NEVER recovers, so the
 *  key is dropped from the pool instead of being retried forever. */
function isDeadKeyError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 401 || /invalid api key|invalid_api_key|unauthorized|\b401\b/.test(msg);
}
const deadGroqKeys = new Set<string>();

/** Run a Groq call, rotating on quota AND skipping keys that are simply dead. */
async function withGroqRotation(fn: (client: Groq) => Promise<any>): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < Math.max(1, GROQ_KEYS.length); attempt++) {
    // Skip keys already proven dead this process.
    if (deadGroqKeys.has(GROQ_KEYS[groqKeyIdx]) && deadGroqKeys.size < GROQ_KEYS.length) {
      groqKeyIdx = (groqKeyIdx + 1) % GROQ_KEYS.length;
      continue;
    }
    try {
      return await fn(groqClientFor());
    } catch (err: any) {
      lastErr = err;
      if (isDeadKeyError(err) && GROQ_KEYS.length > 1) {
        console.warn(`[groq] key #${groqKeyIdx + 1}/${GROQ_KEYS.length} is INVALID (401) — dropping it`);
        deadGroqKeys.add(GROQ_KEYS[groqKeyIdx]);
        groqKeyIdx = (groqKeyIdx + 1) % GROQ_KEYS.length;
        continue;
      }
      if (isGroqQuotaError(err) && GROQ_KEYS.length > 1) {
        console.warn(`[groq] key #${groqKeyIdx + 1}/${GROQ_KEYS.length} quota hit, rotating…`);
        groqKeyIdx = (groqKeyIdx + 1) % GROQ_KEYS.length;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

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
  
  if (GEMINI_KEYS.length) {
    providers.push({
      name: 'gemini',
      execute: async () => {
        const result = await withGeminiRotation('gemini-flash-latest', (m) => m.generateContent(prompt));
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

  if (GROQ_KEYS.length) {
    providers.push({
      name: 'groq',
      execute: async () => withGroqRotation(async (client) => {
        // Primary Groq Model
        try {
          const response = await client.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
          }).asResponse();
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          return { text: data.choices[0]?.message?.content || '', engine: 'groq', headers: response.headers };
        } catch (err: any) {
          if (isGroqQuotaError(err)) throw err; // let rotation handle quota
          // If 70b is otherwise limited, try the smaller 8b model as a sub-fallback
          console.warn('Groq 70b limited, trying 8b instant...');
          const response = await client.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
          }).asResponse();
          const data = await response.json();
          return { text: data.choices[0]?.message?.content || '', engine: 'groq-8b', headers: response.headers };
        }
      })
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
  if (!GEMINI_KEYS.length) {
    throw new Error('GEMINI_API_KEY is not set. Vision AI requires Gemini.');
  }
  
  console.log(`[AI Service] Sending Vision request to Gemini (mimeType: ${mimeType})...`);
  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  };

  // Attempt 1: Gemini 2.5 Flash (primary), rotating keys on quota
  try {
    const result = await withGeminiRotation('gemini-flash-latest', (m) => m.generateContent([prompt, imagePart]));
    return {
      text: result.response.text(),
      telemetry: { engine: 'gemini-vision-2.5', status: 'ok' }
    };
  } catch (err: any) {
    console.warn('[AI Service] Gemini 2.5 Flash Vision failed:', err.message);

    // Attempt 2: Gemini 2.0 Flash Lite (free tier fallback)
    try {
      console.log('[AI Service] Trying Gemini 2.0 Flash Lite fallback...');
      const result = await withGeminiRotation('gemini-2.0-flash-lite', (m) => m.generateContent([prompt, imagePart]));
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
