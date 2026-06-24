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
import requests

SB_URL   = os.getenv("VITE_SUPABASE_URL", "").strip().rstrip("/")
SB_KEY   = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
OLLAMA   = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").strip().rstrip("/")
MODEL    = os.getenv("OLLAMA_TEXT_MODEL", "qwen3-vl:8b-instruct").strip()
DRY_RUN  = os.getenv("DEDUPE_DRY_RUN", "1").strip().lower() in ("1", "true", "yes")
LOOP     = os.getenv("DEDUPE_LOOP", "0").strip().lower() in ("1", "true", "yes")
SLEEP    = int(os.getenv("DEDUPE_SLEEP_SECS", "1800"))
FUZZ_MIN = int(os.getenv("DEDUPE_FUZZ_MIN", "88"))

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

H = {
    "apikey": SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


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
    return " ".join(name.lower().replace(".", " ").replace("-", " ").split())


def build_candidate_clusters(people: list) -> list:
    """Group people whose names are fuzzy-similar. Each returned cluster has >=2
    people and is a *candidate* set — the LLM makes the final same-person call."""
    remaining = list(people)
    clusters = []
    used = set()
    for i, p in enumerate(remaining):
        if p["id"] in used:
            continue
        cluster = [p]
        ni = _norm(p["name"])
        for q in remaining[i + 1:]:
            if q["id"] in used:
                continue
            nj = _norm(q["name"])
            # token_sort_ratio handles word-order swaps; ratio catches misspellings.
            score = max(fuzz.token_sort_ratio(ni, nj), fuzz.ratio(ni, nj))
            if score >= FUZZ_MIN:
                cluster.append(q)
        if len(cluster) >= 2:
            for c in cluster:
                used.add(c["id"])
            clusters.append(cluster)
    return clusters


# ── LLM confirmation ──────────────────────────────────────────────────────────
DEDUPE_PROMPT = """You are deduplicating actors/crew in a Nollywood film database.
Below are people whose names look similar. Some are the SAME real person spelled
differently (misspellings, word-order swaps, missing/extra punctuation), and some
are genuinely DIFFERENT people who happen to have similar names.

For each set of records that refer to the SAME real person, output a merge group.
Choose the primary_id as the record with the cleanest, most complete, correctly
spelled name (prefer the one with more credits when spelling is equally good).
Do NOT merge people you are not confident are the same. When unsure, leave them
separate (omit them from the output).

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

    primary_credits = credits_for(pid)
    # Key existing primary credits so we don't create true duplicates.
    existing = {(c["film_id"], c.get("role"), c.get("character_name")) for c in primary_credits}

    dup_credits = credits_for(did)
    repoint, collide = [], []
    for c in dup_credits:
        key = (c["film_id"], c.get("role"), c.get("character_name"))
        if key in existing:
            collide.append(c)      # primary already has it — dup copy is redundant
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

    clusters = build_candidate_clusters(people)
    print(f"  {len(clusters)} candidate duplicate clusters (fuzz >= {FUZZ_MIN}).")

    merged_total = 0
    for cluster in clusters:
        # annotate credit counts to help the LLM pick a primary
        for p in cluster:
            try:
                p["_credits"] = len(credits_for(p["id"]))
            except Exception:
                p["_credits"] = "?"
        merges = llm_confirm_merges(cluster)
        for m in merges:
            primary = by_id.get(m.get("primary_id"))
            if not primary:
                continue
            for dup_id in m.get("duplicate_ids", []):
                dup = by_id.get(dup_id)
                if not dup or dup_id == primary["id"]:
                    continue
                if merge_person(primary, dup, by_id):
                    merged_total += 1

    print(f"[Dedupe pass] Done. {merged_total} duplicates merged"
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
