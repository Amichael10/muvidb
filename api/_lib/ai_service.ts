import { GoogleGenerativeAI } from '@google/generative-ai';
import { CohereClientV2 } from 'cohere-ai';
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
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-flash-latest';
const GEMINI_VISION_MODELS = (process.env.GEMINI_VISION_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-2.5-flash-lite')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
let geminiKeyIdx = 0;

function geminiModelFor(model: string) {
  return new GoogleGenerativeAI(GEMINI_KEYS[geminiKeyIdx] || '').getGenerativeModel({ model });
}

function isGeminiQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 429 || /quota|resource_exhausted|rate limit|too many requests|\b429\b/.test(msg);
}

/** A revoked/typo'd Gemini key (401). Drop it for the life of this process. */
function isDeadGeminiKeyError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 401 || /api key not valid|invalid.?api.?key|unauthorized|\b401\b|permission.?denied/.test(msg);
}
const deadGeminiKeys = new Set<string>();

/** Run a Gemini call, rotating to the next key on quota or dead-key errors. */
async function withGeminiRotation(model: string, fn: (m: any) => Promise<any>): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < Math.max(1, GEMINI_KEYS.length); attempt++) {
    if (deadGeminiKeys.has(GEMINI_KEYS[geminiKeyIdx]) && deadGeminiKeys.size < GEMINI_KEYS.length) {
      geminiKeyIdx = (geminiKeyIdx + 1) % GEMINI_KEYS.length;
      continue;
    }
    try {
      return await fn(geminiModelFor(model));
    } catch (err: any) {
      lastErr = err;
      if (isDeadGeminiKeyError(err) && GEMINI_KEYS.length > 1) {
        console.warn(`[gemini] key #${geminiKeyIdx + 1}/${GEMINI_KEYS.length} is INVALID — dropping it`);
        deadGeminiKeys.add(GEMINI_KEYS[geminiKeyIdx]);
        geminiKeyIdx = (geminiKeyIdx + 1) % GEMINI_KEYS.length;
        continue;
      }
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

// Cohere: same multi-key rotation as Groq (chat + embed + rerank).
const COHERE_KEYS = collectKeys('COHERE_API_KEY');
let cohereKeyIdx = 0;
const COHERE_CHAT_MODEL = process.env.COHERE_CHAT_MODEL || 'command-a-03-2025';
const COHERE_EMBED_MODEL = process.env.COHERE_EMBED_MODEL || 'embed-v4.0';
const COHERE_RERANK_MODEL = process.env.COHERE_RERANK_MODEL || 'rerank-v4.0-pro';

const cohereClientFor = () => new CohereClientV2({ token: COHERE_KEYS[cohereKeyIdx] || '' });

/** Cohere SDK uses statusCode; some paths surface status. */
function cohereErrStatus(err: any): number | undefined {
  return err?.statusCode ?? err?.status;
}

function isCohereQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return cohereErrStatus(err) === 429 || /quota|rate limit|rate_limit|too many requests|\b429\b/.test(msg);
}

/** Revoked/typo'd key (401/403). Drop it for the life of this process. */
function isCohereDeadKeyError(err: any): boolean {
  const status = cohereErrStatus(err);
  const msg = (err?.message || '').toLowerCase();
  return status === 401 || status === 403 || /invalid.?api.?key|unauthorized|forbidden|\b401\b|\b403\b/.test(msg);
}
const deadCohereKeys = new Set<string>();

/** Run a Cohere call, rotating on quota AND skipping keys that are simply dead. */
async function withCohereRotation(fn: (client: CohereClientV2) => Promise<any>): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < Math.max(1, COHERE_KEYS.length); attempt++) {
    // Skip keys already proven dead this process.
    if (deadCohereKeys.has(COHERE_KEYS[cohereKeyIdx]) && deadCohereKeys.size < COHERE_KEYS.length) {
      cohereKeyIdx = (cohereKeyIdx + 1) % COHERE_KEYS.length;
      continue;
    }
    try {
      return await fn(cohereClientFor());
    } catch (err: any) {
      lastErr = err;
      if (isCohereDeadKeyError(err) && COHERE_KEYS.length > 1) {
        console.warn(`[cohere] key #${cohereKeyIdx + 1}/${COHERE_KEYS.length} is INVALID — dropping it`);
        deadCohereKeys.add(COHERE_KEYS[cohereKeyIdx]);
        cohereKeyIdx = (cohereKeyIdx + 1) % COHERE_KEYS.length;
        continue;
      }
      if (isCohereQuotaError(err) && COHERE_KEYS.length > 1) {
        console.warn(`[cohere] key #${cohereKeyIdx + 1}/${COHERE_KEYS.length} quota hit, rotating…`);
        cohereKeyIdx = (cohereKeyIdx + 1) % COHERE_KEYS.length;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function extractCohereText(response: any): string {
  const content = response?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === 'string') parts.push(part);
    else if (part?.type === 'text' && typeof part.text === 'string') parts.push(part.text);
  }
  return parts.join('');
}

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
const GEMINI_VISION_MODELS = (process.env.GEMINI_VISION_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-2.5-flash-lite')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
let geminiKeyIdx = 0;

function geminiModelFor(model: string) {
  return new GoogleGenerativeAI(GEMINI_KEYS[geminiKeyIdx] || '').getGenerativeModel({ model });
}

function isGeminiQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 429 || /quota|resource_exhausted|rate limit|too many requests|\b429\b/.test(msg);
}

/** A revoked/typo'd Gemini key (401). Drop it for the life of this process. */
function isDeadGeminiKeyError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return err?.status === 401 || /api key not valid|invalid.?api.?key|unauthorized|\b401\b|permission.?denied/.test(msg);
}
const deadGeminiKeys = new Set<string>();

/** Run a Gemini call, rotating to the next key on quota or dead-key errors. */
async function withGeminiRotation(model: string, fn: (m: any) => Promise<any>): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < Math.max(1, GEMINI_KEYS.length); attempt++) {
    if (deadGeminiKeys.has(GEMINI_KEYS[geminiKeyIdx]) && deadGeminiKeys.size < GEMINI_KEYS.length) {
      geminiKeyIdx = (geminiKeyIdx + 1) % GEMINI_KEYS.length;
      continue;
    }
    try {
      return await fn(geminiModelFor(model));
    } catch (err: any) {
      lastErr = err;
      if (isDeadGeminiKeyError(err) && GEMINI_KEYS.length > 1) {
        console.warn(`[gemini] key #${geminiKeyIdx + 1}/${GEMINI_KEYS.length} is INVALID — dropping it`);
        deadGeminiKeys.add(GEMINI_KEYS[geminiKeyIdx]);
        geminiKeyIdx = (geminiKeyIdx + 1) % GEMINI_KEYS.length;
        continue;
      }
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

// Cohere: same multi-key rotation as Groq (chat + embed + rerank).
const COHERE_KEYS = collectKeys('COHERE_API_KEY');
let cohereKeyIdx = 0;
const COHERE_CHAT_MODEL = process.env.COHERE_CHAT_MODEL || 'command-a-03-2025';
const COHERE_EMBED_MODEL = process.env.COHERE_EMBED_MODEL || 'embed-v4.0';
const COHERE_RERANK_MODEL = process.env.COHERE_RERANK_MODEL || 'rerank-v4.0-pro';

const cohereClientFor = () => new CohereClientV2({ token: COHERE_KEYS[cohereKeyIdx] || '' });

/** Cohere SDK uses statusCode; some paths surface status. */
function cohereErrStatus(err: any): number | undefined {
  return err?.statusCode ?? err?.status;
}

function isCohereQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return cohereErrStatus(err) === 429 || /quota|rate limit|rate_limit|too many requests|\b429\b/.test(msg);
}

/** Revoked/typo'd key (401/403). Drop it for the life of this process. */
function isCohereDeadKeyError(err: any): boolean {
  const status = cohereErrStatus(err);
  const msg = (err?.message || '').toLowerCase();
  return status === 401 || status === 403 || /invalid.?api.?key|unauthorized|forbidden|\b401\b|\b403\b/.test(msg);
}
const deadCohereKeys = new Set<string>();

/** Run a Cohere call, rotating on quota AND skipping keys that are simply dead. */
async function withCohereRotation(fn: (client: CohereClientV2) => Promise<any>): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < Math.max(1, COHERE_KEYS.length); attempt++) {
    // Skip keys already proven dead this process.
    if (deadCohereKeys.has(COHERE_KEYS[cohereKeyIdx]) && deadCohereKeys.size < COHERE_KEYS.length) {
      cohereKeyIdx = (cohereKeyIdx + 1) % COHERE_KEYS.length;
      continue;
    }
    try {
      return await fn(cohereClientFor());
    } catch (err: any) {
      lastErr = err;
      if (isCohereDeadKeyError(err) && COHERE_KEYS.length > 1) {
        console.warn(`[cohere] key #${cohereKeyIdx + 1}/${COHERE_KEYS.length} is INVALID — dropping it`);
        deadCohereKeys.add(COHERE_KEYS[cohereKeyIdx]);
        cohereKeyIdx = (cohereKeyIdx + 1) % COHERE_KEYS.length;
        continue;
      }
      if (isCohereQuotaError(err) && COHERE_KEYS.length > 1) {
        console.warn(`[cohere] key #${cohereKeyIdx + 1}/${COHERE_KEYS.length} quota hit, rotating…`);
        cohereKeyIdx = (cohereKeyIdx + 1) % COHERE_KEYS.length;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function extractCohereText(response: any): string {
  const content = response?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === 'string') parts.push(part);
    else if (part?.type === 'text' && typeof part.text === 'string') parts.push(part.text);
  }
  return parts.join('');
}

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

/**
 * Unified request handler with rotation + fallback + telemetry
 * Supports Gemini, Groq, OpenAI, and Cohere
 */
export async function generateAIContent(
  prompt: string,
  options?: { preferredProvider?: string }
) {
  const providers = [];

  if (GEMINI_KEYS.length) {
    providers.push({
      name: 'gemini',
      execute: async () => {
        const result = await withGeminiRotation(GEMINI_TEXT_MODEL, (m) => m.generateContent(prompt));
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

  if (COHERE_KEYS.length) {
    providers.push({
      name: 'cohere',
      execute: async () => withCohereRotation(async (client) => {
        const response = await client.chat({
          model: COHERE_CHAT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        });
        return { text: extractCohereText(response), engine: 'cohere', headers: null };
      })
    });
  }

  if (providers.length === 0) {
    throw new Error('No AI providers configured. Please check GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or COHERE_API_KEY.');
  }

  // Order providers: if preferredProvider is specified, put it first, then shuffle the rest
  let orderedProviders = [];
  if (options?.preferredProvider) {
    const prefIndex = providers.findIndex(p => p.name === options.preferredProvider);
    if (prefIndex !== -1) {
      const preferred = providers.splice(prefIndex, 1)[0];
      const rest = providers.sort(() => Math.random() - 0.5);
      orderedProviders = [preferred, ...rest];
    } else {
      orderedProviders = providers.sort(() => Math.random() - 0.5);
    }
  } else {
    orderedProviders = providers.sort(() => Math.random() - 0.5);
  }

  let lastError = null;

  for (const provider of orderedProviders) {
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
 * Vision Content Generator (Gemini + OpenAI fallback)
 */
export async function generateAIVisionContent(prompt: string, base64Data: string, mimeType: string) {
  console.log(`[AI Service] Sending Vision request (mimeType: ${mimeType})...`);
  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  };

  const geminiErrors: string[] = [];
  if (GEMINI_KEYS.length) {
    for (const model of GEMINI_VISION_MODELS) {
      try {
        console.log(`[AI Service] Trying Gemini Vision model: ${model}`);
        const result = await withGeminiRotation(model, (m) => m.generateContent([prompt, imagePart]));
        return {
          text: result.response.text(),
          telemetry: { engine: `gemini-vision-${model}`, status: 'ok' }
        };
      } catch (err: any) {
        const message = err?.message || String(err);
        console.warn(`[AI Service] Gemini Vision model ${model} failed:`, message);
        geminiErrors.push(`${model}: ${message}`);
      }
    }
  } else {
    geminiErrors.push('No GEMINI_API_KEY configured');
  }

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
      throw new Error(`All vision providers failed. Gemini: ${geminiErrors.join(' | ')} | OpenAI: ${openaiErr.message}`);
    }
  }

  throw new Error(`Vision API failed. Gemini attempts: ${geminiErrors.join(' | ')}. No OpenAI key configured for further fallback.`);
}

/** Whether Cohere keys are available in this process. */
export function hasCohere(): boolean {
  return COHERE_KEYS.length > 0;
}

/**
 * Embed texts with Cohere (float vectors). Batches of up to 96 texts recommended.
 */
export async function embedWithCohere(
  texts: string[],
  opts: { inputType?: 'search_document' | 'search_query' | 'classification' | 'clustering' } = {}
): Promise<number[][]> {
  if (!COHERE_KEYS.length) throw new Error('COHERE_API_KEY is not set.');
  if (!texts.length) return [];

  const response: any = await withCohereRotation((client) =>
    client.embed({
      model: COHERE_EMBED_MODEL,
      texts,
      inputType: opts.inputType || 'search_document',
      embeddingTypes: ['float'],
    })
  );

  const floats = response?.embeddings?.float;
  if (!Array.isArray(floats)) throw new Error('Cohere embed response missing embeddings.float');
  return floats;
}

/**
 * Rerank documents for a query. Returns original indices + relevance scores, highest first.
 */
export async function rerankWithCohere(
  query: string,
  documents: string[],
  opts: { topN?: number } = {}
): Promise<Array<{ index: number; relevanceScore: number }>> {
  if (!COHERE_KEYS.length) throw new Error('COHERE_API_KEY is not set.');
  if (!documents.length) return [];

  const response: any = await withCohereRotation((client) =>
    client.rerank({
      model: COHERE_RERANK_MODEL,
      query,
      documents,
      topN: opts.topN ?? Math.min(documents.length, 20),
    })
  );

  return (response?.results || []).map((r: any) => ({
    index: r.index,
    relevanceScore: r.relevanceScore ?? r.relevance_score ?? 0,
  }));
}
