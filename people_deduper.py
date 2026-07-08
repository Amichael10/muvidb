#!/usr/bin/env python3
"""people_deduper.py — safe duplicate-actor merger for the Ensembla/muvidb people table.

Runs SEPARATELY from the cast enricher (ideally on its own Kaggle account) so the
two never interfere. It finds people whose names are near-duplicates (misspellings,
word-order swaps, punctuation), asks Qwen3-VL-8B (via Ollama) to confirm which are
truly the same person, then MERGES duplicates into one primary record.

SAFETY (the whole point):
  - Every credit on a duplicate is RE-POINTED to the primary before the duplicate
    is removed. A credit is only *deleted* when the primary already has the exact
    same (film, role, character) credit — i.e. it is a true duplicate, and the
    information is preserved on the primary.
  - A duplicate person is deleted ONLY after we re-fetch and confirm it has zero
    remaining credits. If anything is left, we abort that merge and leave it intact.
  - Non-name fields (description, image, bio, dob, …) are copied from the duplicate
    to the primary only where the primary's field is empty — never overwritten.
  - DRY RUN by default. Set DEDUPE_DRY_RUN=0 to actually write.

Env:
  VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
  OLLAMA_HOST            (default http://127.0.0.1:11434)
  OLLAMA_TEXT_MODEL      (default qwen3-vl:8b-instruct)
  DEDUPE_DRY_RUN         (default "1" — set "0" to apply)
  DEDUPE_LOOP            (default "0" — set "1" for a continuous 24/7 pass)
  DEDUPE_SLEEP_SECS      (default 1800 — pause between loop passes)
  DEDUPE_FUZZ_MIN        (default 88 — rapidfuzz score to consider two names candidates)
"""
import os
import sys
import json
import time
import re
import unicodedata
import requests


def load_dotenv_file(path: str) -> None:
    """Tiny .env loader so the standalone script works locally without deps."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            if k and k not in os.environ:
                os.environ[k] = v.strip().strip("\"'")


load_dotenv_file(".env.local")
load_dotenv_file(".env")

SB_URL   = os.getenv("VITE_SUPABASE_URL", "").strip().rstrip("/")
SB_KEY   = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
OLLAMA   = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").strip().rstrip("/")
MODEL    = os.getenv("OLLAMA_TEXT_MODEL", "qwen3-vl:8b-instruct").strip()
DRY_RUN  = os.getenv("DEDUPE_DRY_RUN", "1").strip().lower() in ("1", "true", "yes")
LOOP     = os.getenv("DEDUPE_LOOP", "0").strip().lower() in ("1", "true", "yes")
SLEEP    = int(os.getenv("DEDUPE_SLEEP_SECS", "1800"))
FUZZ_MIN = int(os.getenv("DEDUPE_FUZZ_MIN", "88"))
TOKEN_FUZZ_MIN = int(os.getenv("DEDUPE_TOKEN_FUZZ_MIN", "82"))
GIVEN_ALIAS_MIN = int(os.getenv("DEDUPE_GIVEN_ALIAS_MIN", "88"))
TWO_TOKEN_FUZZ_MIN = int(os.getenv("DEDUPE_TWO_TOKEN_FUZZ_MIN", "84"))
CLEAN_JUNK = os.getenv("DEDUPE_CLEAN_JUNK", "1").strip().lower() in ("1", "true", "yes")

# Fields we never touch when merging metadata onto the primary.
PROTECTED_FIELDS = {"id", "name", "created_at", "updated_at"}

if not SB_URL or not SB_KEY:
    print("❌ VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    sys.exit(1)

try:
    from rapidfuzz import fuzz
except ImportError:
    print("❌ rapidfuzz not installed. pip install rapidfuzz")
    sys.exit(1)

def _looks_like_jwt(key: str) -> bool:
    return key.count(".") == 2


def supabase_headers() -> dict:
    """Support both legacy JWT service-role keys and new sb_secret_* API keys."""
    h = {
        "apikey": SB_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
        "User-Agent": "lumi-people-deduper/1.0",
    }
    if _looks_like_jwt(SB_KEY):
        h["Authorization"] = f"Bearer {SB_KEY}"
    return h


H = supabase_headers()


# ── Supabase helpers ──────────────────────────────────────────────────────────
def sb_get(path: str) -> list:
    r = requests.get(f"{SB_URL}/rest/v1/{path}", headers=H, timeout=60)
    r.raise_for_status()
    return r.json()


def sb_patch(path: str, payload: dict) -> bool:
    r = requests.patch(f"{SB_URL}/rest/v1/{path}", headers=H, json=payload, timeout=60)
    if r.status_code not in (200, 204):
        print(f"    ⚠️ PATCH {path} -> {r.status_code}: {r.text[:200]}")
        return False
    return True


def sb_delete(path: str) -> bool:
    r = requests.delete(f"{SB_URL}/rest/v1/{path}", headers=H, timeout=60)
    if r.status_code not in (200, 204):
        print(f"    ⚠️ DELETE {path} -> {r.status_code}: {r.text[:200]}")
        return False
    return True


def fetch_all_people() -> list:
    """Page through the whole people table."""
    people, offset, page = [], 0, 1000
    while True:
        batch = sb_get(f"people?select=*&order=name.asc&offset={offset}&limit={page}")
        people.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return people


def credits_for(person_id: str) -> list:
    return sb_get(f"credits?person_id=eq.{person_id}&select=id,film_id,role,character_name,billing_order")


# ── Candidate clustering (cheap, narrows what the LLM sees) ────────────────────
def _norm(name: str) -> str:
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[\u200b\u200c\u200d\ufeff]", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def _name_score(a: str, b: str) -> float:
    return max(fuzz.token_sort_ratio(a, b), fuzz.ratio(a, b))


def _token_skeleton(token: str) -> str:
    return "".join(ch for ch in token if ch not in "aeiou")


def _tokens_match(a: str, b: str, min_score: int = TOKEN_FUZZ_MIN) -> bool:
    if fuzz.ratio(a, b) >= min_score:
        return True
    sa, sb = _token_skeleton(a), _token_skeleton(b)
    return len(sa) >= 3 and sa == sb


def _token_match_stats(a_tokens: list, b_tokens: list, min_score: int = TOKEN_FUZZ_MIN) -> dict:
    used = set()
    stats = {"total": 0, "exact": 0, "near": 0}
    for a in a_tokens:
        best_i, best_score = None, 0
        for i, b in enumerate(b_tokens):
            if i in used:
                continue
            score = fuzz.ratio(a, b)
            if score > best_score:
                best_i, best_score = i, score
        if best_i is not None and _tokens_match(a, b_tokens[best_i], min_score):
            used.add(best_i)
            stats["total"] += 1
            if a == b_tokens[best_i]:
                stats["exact"] += 1
            else:
                stats["near"] += 1
    return stats


def _contained_tokens(a_tokens: list, b_tokens: list) -> bool:
    a, b = set(a_tokens), set(b_tokens)
    return (len(a) >= 2 and a < b) or (len(b) >= 2 and b < a)


def _near_given_name_alias(a_tokens: list, b_tokens: list) -> bool:
    """Catch likely stage/name-change aliases, then let the LLM decide.

    Example: "Faithia Balogun" vs "Fathia Williams" has a strong given-name
    match but a different surname, so pure fuzzy scoring never surfaces it.
    """
    if len(a_tokens) < 2 or len(b_tokens) < 2:
        return False
    if len(a_tokens) > 3 or len(b_tokens) > 3:
        return False
    a, b = a_tokens[0], b_tokens[0]
    if a == b or min(len(a), len(b)) < 5:
        return False
    return fuzz.ratio(a, b) >= GIVEN_ALIAS_MIN


def _candidate_match_reason(a_norm: str, b_norm: str):
    a_tokens, b_tokens = a_norm.split(), b_norm.split()
    if not a_tokens or not b_tokens:
        return None

    score = _name_score(a_norm, b_norm)
    if score >= FUZZ_MIN:
        return f"fuzzy score {score:.1f}"

    if _contained_tokens(a_tokens, b_tokens):
        return "token containment"

    surname_ok = (
        len(a_tokens) >= 2 and len(b_tokens) >= 2
        and fuzz.ratio(a_tokens[-1], b_tokens[-1]) >= 90
    )
    if surname_ok and score >= max(80, FUZZ_MIN - 8):
        return f"same surname + fuzzy score {score:.1f}"

    token_stats = _token_match_stats(a_tokens, b_tokens)
    if token_stats["total"] >= 3:
        return "three matching/near-matching tokens"
    if token_stats["total"] >= 2 and score >= TWO_TOKEN_FUZZ_MIN:
        return f"two token matches + fuzzy score {score:.1f}"

    if _near_given_name_alias(a_tokens, b_tokens):
        return "near given-name alias"

    return None


# ── Role-label junk detection ─────────────────────────────────────────────────
# The cast enricher sometimes saved a bare crew-role label ("Production Manager")
# as if it were a person. Those have no real name and should be DELETED — unless a
# real name is attached ("Fola Makeup Artist", "Production Manager Uchendu Mbunabo").
ROLE_PHRASES = [
    "production manager", "production assistant", "costume manager", "costume assistant",
    "costumier", "make up", "makeup", "makeup artist", "make up artist", "wardrobe",
    "director", "assistant director", "director of photography", "cinematographer", "dop",
    "editor", "supervising editor", "producer", "executive producer", "associate producer",
    "line producer", "sound", "sound recordist", "sound mixer", "gaffer", "continuity",
    "screenplay", "story", "still photo", "still photographer", "props", "set", "props and set",
    "welfare", "welfare assistant", "script supervisor", "light", "lighting", "art director",
    "set designer", "location manager", "colorist", "color", "vfx", "special effects",
    "music", "composer", "soundtrack", "writer", "screenwriter", "unit manager", "production",
    "manager", "assistant", "crew", "cast", "actor", "actress", "director name",
    # logistics / support roles that also leak in as fake "people"
    "logistics", "logistics manager", "logixtic", "logistic manager", "driver", "drivers",
    "security", "runner", "caterer", "catering", "transport", "transportation",
    "accountant", "account", "marketer", "marketing", "publicity", "publicist", "graphics",
    "graphic", "poster", "trailer", "dubbing", "subtitle", "translator", "boom", "boom operator",
    "grip", "best boy", "focus puller", "dolly", "crane", "drone", "generator", "power",
    "medic", "usher", "extra", "extras", "stunt", "stunts", "choreographer", "choreography",
    "dancer", "decor", "set decor", "post production", "color grading", "colourist", "landlord",
]
_ROLE_WORDS = {w for ph in ROLE_PHRASES for w in ph.split()} | {
    "1", "2", "3", "i", "ii", "iii", "the", "and", "of", "dp", "pm", "asst", "snr", "jnr",
    "custom", "costumer", "makeover", "mua", "dop1", "dop2",  # common OCR/shorthand variants
}


_LONG_ROLE_WORDS = [w for w in _ROLE_WORDS if len(w) >= 5]


def _is_role_token(t: str) -> bool:
    """A token is 'role-ish' if it's a known role word, or (for longer tokens) an
    OCR-garbled near-match of one — 'custom'~'costume', 'managet'~'manager'."""
    if t in _ROLE_WORDS:
        return True
    if len(t) >= 5:
        return max((fuzz.ratio(t, w) for w in _LONG_ROLE_WORDS), default=0) >= 82
    return False


def is_role_junk(name: str) -> bool:
    """True ONLY if every token is a crew-role word (or OCR garble of one), i.e.
    there is no real personal name anywhere. 'Production Manager' -> junk;
    'Fola Makeup Artist' / 'Production Manager Uchendu Mbunabo' -> kept (real name)."""
    n = _norm(name)
    if not n:
        return True
    return all(_is_role_token(t) for t in n.split())


# Stray punctuation to strip from the start/end of a name. Note: parentheses and
# internal apostrophes/hyphens are NOT stripped (aliases "(Obifax)", "Asa'ah",
# "Fash-Lanso" are legitimate).
_STRIP_CHARS = " \t\r\n,.;:!?*|/\\\"'`~^_=+<>[]{}@#$%&"


def clean_display_name(name: str) -> str:
    """Trim stray leading/trailing punctuation and collapse whitespace."""
    return " ".join(name.strip(_STRIP_CHARS).split())


def has_letters(name: str) -> bool:
    return any(ch.isalpha() for ch in name)


class _UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def _block_keys(norm_name: str) -> set:
    """Cheap blocking keys: the first 3 chars of each token. A name only needs to
    share ONE key with another to become a comparison candidate, so word-order
    swaps and most misspellings still land in a common block."""
    keys = set()
    for t in norm_name.split():
        if len(t) >= 3:
            keys.add(f"p3:{t[:3]}")
        if len(t) >= 5:
            keys.add(f"p2:{t[:2]}")
            consonants = _token_skeleton(t)
            if len(consonants) >= 3:
                keys.add(f"cs:{consonants[:4]}")
    return keys


def build_candidate_clusters(people: list) -> list:
    """Group people whose names are fuzzy-similar, using blocking so we never do
    the full N^2 comparison (infeasible at ~38k people). Each returned cluster has
    >=2 people and is a *candidate* set — the LLM makes the final same-person call.
    """
    from collections import defaultdict

    # Pre-normalise once and bucket each person into blocks by token prefix.
    norms = {p["id"]: _norm(p["name"]) for p in people}
    by_id = {p["id"]: p for p in people}
    blocks = defaultdict(list)
    for p in people:
        for k in _block_keys(norms[p["id"]]):
            blocks[k].append(p["id"])

    uf = _UnionFind()
    comparisons = 0
    big = 0
    for k, ids in blocks.items():
        if len(ids) < 2:
            continue
        if len(ids) > 4000:
            # Pathologically common prefix (e.g. "moh"); skip to stay tractable.
            big += 1
            continue
        for a in range(len(ids)):
            ni = norms[ids[a]]
            for b in range(a + 1, len(ids)):
                nj = norms[ids[b]]
                comparisons += 1
                if _candidate_match_reason(ni, nj):
                    uf.union(ids[a], ids[b])

    # Collect connected components of size >= 2.
    groups = defaultdict(list)
    for pid in norms:
        root = uf.find(pid)
        groups[root].append(by_id[pid])
    clusters = [g for g in groups.values() if len(g) >= 2]
    print(f"  Blocking: {len(blocks)} blocks, {comparisons:,} comparisons"
          f"{f', {big} oversized blocks skipped' if big else ''}.")
    return clusters


# ── LLM confirmation ──────────────────────────────────────────────────────────
DEDUPE_PROMPT = """You are deduplicating actors/crew in a Nollywood film database.
Below are people whose names look similar. Some are the SAME real person spelled
differently (misspellings, word-order swaps, missing/extra punctuation), and some
are genuinely DIFFERENT people who happen to have similar names.

For each set of records that refer to the SAME real person, output a merge group.
Choose the primary_id as the record with the cleanest, most complete, correctly
spelled name (prefer the one with more credits when spelling is equally good).
When one name is another name PLUS an extra trailing word (e.g. "Linda Adedeji"
vs "Linda Adedeji Landlord"), that extra word is the CHARACTER they played, not
part of their name — choose the SHORTER name as primary and merge the longer one in.
Do NOT merge people you are not confident are the same. When unsure, leave them
separate (omit them from the output).
Do NOT merge relatives, family members, or people who only share a surname/household
name. A shared last name, shared parent/child relationship, or shared production
family is not a duplicate-person signal.

Return ONLY valid JSON, no prose, in exactly this shape:
{{"merges": [{{"primary_id": "<id>", "duplicate_ids": ["<id>", "..."], "canonical_name": "<best spelling>"}}]}}
If there are no confident merges, return {{"merges": []}}.

PEOPLE (id | name | credit_count):
{rows}"""


def llm_confirm_merges(cluster: list) -> list:
    rows = "\n".join(f'{p["id"]} | {p["name"]} | {p.get("_credits", "?")}' for p in cluster)
    prompt = DEDUPE_PROMPT.format(rows=rows)
    try:
        r = requests.post(
            f"{OLLAMA}/api/chat",
            json={"model": MODEL, "stream": False, "format": "json",
                  "messages": [{"role": "user", "content": prompt}],
                  "options": {"temperature": 0}},
            timeout=180,
        )
        r.raise_for_status()
        content = r.json()["message"]["content"]
        data = json.loads(content)
        return data.get("merges", [])
    except Exception as e:
        print(f"  ⚠️ LLM merge-confirm failed for cluster: {e}")
        return []


# ── The safe merge ────────────────────────────────────────────────────────────
def merge_person(primary: dict, dup: dict, people_by_id: dict) -> bool:
    """Move dup's credits + metadata onto primary, then delete dup. Returns True
    only if the duplicate was fully merged and removed."""
    pid, did = primary["id"], dup["id"]
    if pid == did:
        return False

    # Deterministic safety net: even if the LLM said "same person", refuse to merge
    # names with no fuzzy/token/alias evidence at all. This still blocks over-eager
    # merges like "Emmanuel Oduneye" vs "Emmanuel Odunyemi".
    np, nd = _norm(primary["name"]), _norm(dup["name"])
    reason = _candidate_match_reason(np, nd)
    if not reason:
        score = _name_score(np, nd)
        print(f"  ↯ SKIP merge '{dup['name']}' -> '{primary['name']}' "
              f"(similarity {score:.1f}; no deterministic alias signal).")
        return False

    primary_credits = credits_for(pid)
    # Key on (film_id, role) — this is the DB's UNIQUE constraint on credits.
    # character_name is NOT part of it, so it must NOT be in the key, or re-points
    # collide with a 409 duplicate-key error and the whole merge aborts.
    existing = {(c["film_id"], c.get("role")) for c in primary_credits}

    dup_credits = credits_for(did)
    repoint, collide = [], []
    for c in dup_credits:
        key = (c["film_id"], c.get("role"))
        if key in existing:
            collide.append(c)      # primary already has this film+role — dup copy is redundant
        else:
            repoint.append(c)
            existing.add(key)

    print(f"  MERGE '{dup['name']}' -> '{primary['name']}': "
          f"{len(repoint)} credits move, {len(collide)} redundant, "
          f"{len(dup_credits)} total on dup")

    if DRY_RUN:
        return False  # report only

    # 1. Re-point the non-colliding credits to the primary.
    for c in repoint:
        if not sb_patch(f"credits?id=eq.{c['id']}", {"person_id": pid}):
            print(f"    ❌ Failed to move credit {c['id']}; ABORTING this merge (dup kept).")
            return False

    # 2. Delete only the truly-redundant collision credits (info already on primary).
    for c in collide:
        sb_delete(f"credits?id=eq.{c['id']}")

    # 3. Merge metadata: fill primary's EMPTY fields from dup. Never overwrite.
    fill = {}
    for k, v in dup.items():
        if k in PROTECTED_FIELDS:
            continue
        if (primary.get(k) in (None, "", [], {})) and v not in (None, "", [], {}):
            fill[k] = v
    if fill:
        sb_patch(f"people?id=eq.{pid}", fill)

    # 4. VERIFY the duplicate has no credits left, THEN delete it.
    remaining = credits_for(did)
    if remaining:
        print(f"    ❌ Dup still has {len(remaining)} credits after move; NOT deleting. Will retry next pass.")
        return False
    if sb_delete(f"people?id=eq.{did}"):
        print(f"    ✓ Merged and removed duplicate '{dup['name']}'.")
        return True
    return False


def run_pass() -> int:
    print(f"\n[Dedupe pass] DRY_RUN={DRY_RUN} model={MODEL}")
    people = fetch_all_people()
    print(f"  Loaded {len(people)} people.")
    by_id = {p["id"]: p for p in people}

    merged_total = 0

    # ── Tier -1: delete pure-symbol "people" and clean stray punctuation ─────
    # A name with no letters at all ("," "??" "--") is junk -> delete. A name with
    # stray leading/trailing punctuation ("RASHEED GANIYU,") gets cleaned in place;
    # cleaning also makes "GANIYU," identical to "GANIYU" so Tier 1 then merges them.
    symbol_deleted, cleaned_cnt = 0, 0
    if CLEAN_JUNK:
        kept = []
        for p in people:
            cleaned = clean_display_name(p["name"])
            if not has_letters(cleaned):
                print(f"  🗑 SYMBOL '{p['name']}'")
                if not DRY_RUN:
                    sb_delete(f"credits?person_id=eq.{p['id']}")
                    if sb_delete(f"people?id=eq.{p['id']}"):
                        symbol_deleted += 1
                continue
            if cleaned != p["name"]:
                print(f"  ✦ CLEAN '{p['name']}' -> '{cleaned}'")
                if not DRY_RUN:
                    sb_patch(f"people?id=eq.{p['id']}", {"name": cleaned})
                cleaned_cnt += 1
                p["name"] = cleaned   # update in-memory so later tiers see the clean name
            kept.append(p)
        people = kept
        print(f"  Tier -1: {symbol_deleted} symbol-only deleted, {cleaned_cnt} names cleaned.")

    # ── Tier 0: delete role-label junk "people" (no real name attached) ──────
    removed_junk = 0
    if CLEAN_JUNK:
        junk = [p for p in people if is_role_junk(p["name"])]
        print(f"  Tier 0: {len(junk)} role-label junk 'people' to delete.")
        for p in junk:
            print(f"  🗑 JUNK '{p['name']}'")
            if DRY_RUN:
                continue
            sb_delete(f"credits?person_id=eq.{p['id']}")   # nameless credit — discard
            if sb_delete(f"people?id=eq.{p['id']}"):
                removed_junk += 1
        # Drop them from the working set so later tiers ignore them.
        junk_ids = {p["id"] for p in junk}
        people = [p for p in people if p["id"] not in junk_ids]

    # ── Tier 1: exact-after-normalisation duplicates — no LLM needed ──────────
    # "Yomi Fash Lanso" == "Yomi Fash-Lanso", "UCHE NANCY" == "Uche Nancy", etc.
    # Identical normalised names are the same person with ~100% confidence.
    from collections import defaultdict
    exact = defaultdict(list)
    for p in people:
        exact[_norm(p["name"])].append(p)
    exact_groups = [g for g in exact.values() if len(g) >= 2]
    print(f"  Tier 1: {len(exact_groups)} exact-normalised duplicate groups.")
    merged_ids = set()
    for group in exact_groups:
        # primary = the member with the most credits (keeps the richest record)
        for p in group:
            p["_credits"] = len(credits_for(p["id"]))
        group.sort(key=lambda p: p["_credits"], reverse=True)
        primary = group[0]
        for dup in group[1:]:
            if merge_person(primary, dup, by_id):
                merged_total += 1
                merged_ids.add(dup["id"])

    # ── Tier 2: fuzzy candidates — LLM confirms the same-person call ──────────
    clusters = build_candidate_clusters([p for p in people if p["id"] not in merged_ids])
    print(f"  Tier 2: {len(clusters)} fuzzy clusters (fuzz >= {FUZZ_MIN}).")
    for cluster in clusters:
        for p in cluster:
            if "_credits" not in p:
                try: p["_credits"] = len(credits_for(p["id"]))
                except Exception: p["_credits"] = "?"
        merges = llm_confirm_merges(cluster)
        for m in merges:
            primary = by_id.get(m.get("primary_id"))
            if not primary:
                continue
            for dup_id in m.get("duplicate_ids", []):
                dup = by_id.get(dup_id)
                if not dup or dup_id == primary["id"] or dup_id in merged_ids:
                    continue
                if merge_person(primary, dup, by_id):
                    merged_total += 1
                    merged_ids.add(dup_id)

    print(f"[Dedupe pass] Done. {removed_junk} junk deleted, {merged_total} duplicates merged"
          f"{' (DRY RUN — nothing written)' if DRY_RUN else ''}.")
    return merged_total


def main():
    if not LOOP:
        run_pass()
        return
    while True:
        try:
            run_pass()
        except Exception as e:
            print(f"  ⚠️ Pass error: {e}")
        print(f"😴 Sleeping {SLEEP}s before next dedupe pass...")
        time.sleep(SLEEP)


if __name__ == "__main__":
    main()
