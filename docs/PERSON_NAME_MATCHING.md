# Person name matching

## Why Cohere alone was not enough

Cohere was already wired for **film title** rerank (`/api/semantic-search`, used by global film search). It was **not** previously called for people / OCR credit linking — those paths used lexical `name_key` + optional trigram suggestions only.

## Current flow

`searchPeopleByName` (`src/lib/peopleSearch.js`) and OCR resolve (`AdminCreditsExtractor`):

1. **Lexical** — `name_key` order-insensitive (`Abiodun Marian` ↔ `Marian Abiodun`)
2. **Fuzzy top-up** — `suggest_similar_people` (pg_trgm) for OCR typos (`Mirian` ↔ `Marian`)
3. **Cohere Rerank** — `POST /api/semantic-search` with `entity: 'people'`
4. **Auto-link** — `pickAutoMatch` accepts exact fold, order-swap, near-typo (edit distance ≤ 2 on one token), or high-confidence Cohere with a shared strong token. Low-confidence guesses stay unmatched for the admin to pick.

Nicknames in parentheses / brackets (`(Supa)`, `[DJ]`) are stripped in JS and in SQL `person_name_key` so they do not break keys.

## Local vs production

- Production: Vercel `api/semantic-search.ts`
- Vite dev: bypass in `vite.config.ts` calls Cohere Rerank with `COHERE_API_KEY` from `.env.local`
