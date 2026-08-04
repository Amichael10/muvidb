# Person name matching

## What actually fixes order swaps

**Not Cohere.** Order-insensitive matching is done by `people.name_key` / `match_people_by_name` in Postgres:

- `Abiodun Marian` ↔ `Marian Abiodun` share key `2:abiodun|marian`
- OCR noise is stripped first: `1. Marian Abiodun`, `(Supa)`, `starring …`

Cohere Rerank is optional polish for ranking typos when lexical is uncertain. Auto-link must succeed from `name_key` alone.

## Flow

1. **`match_people_by_name` RPC** — exact fold + `name_key` swap (OCR / auto-link)
2. **Lexical search** — `name_key` eq + OR of strong tokens, then client rank
3. **Fuzzy** — `suggest_similar_people` (trigram) for near-misses
4. **Cohere** — only if the top hit is not already certain
5. **`pickAutoMatch`** — exact → name_key swap → near-typo → high-confidence Cohere

## Files

- `src/lib/personNameMatch.js` — token fold / `sortedNameKey` / `pickAutoMatch`
- `src/lib/peopleSearch.js` — search + `matchPeopleByNameKey`
- `src/pages/admin/AdminCreditsExtractor.jsx` — OCR resolve uses RPC first
- SQL: `person_name_key()`, `match_people_by_name()`, `find_person_by_name()`
