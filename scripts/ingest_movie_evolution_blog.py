#!/usr/bin/env python3
"""
Ingest Movie Evolution Blog Archive (intro2filmclass.blogspot.com)
1. Option 2: Single collective archival critic profile (Movie Evolution Archive).
2. Existing Movies: Reconcile in DB. Update cast/crew in-place (strictly zero duplicate actor guarantee).
   Do NOT overwrite synopsis unless the DB record has none. Enrich missing poster/backdrop.
3. Missing Movies: Create afresh with title, year, language, posters/backdrops, synopsis, full credits.
4. Critic Reviews: Insert rich review quotes, ratings, and permalink URLs for all posts.
"""

import os
import sys
import io
import json
import re
import time
from pathlib import Path
from difflib import SequenceMatcher
from dotenv import load_dotenv
from supabase import create_client, Client

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

load_dotenv('.env')
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing Supabase credentials in .env / .env.local")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

CRITIC_ID = '26bfcc0b-2a0e-4f43-81f0-4acc08b75471'
CRITIC_NAME = 'Movie Evolution (Film Class Archive)'
CRITIC_TITLE = 'Nollywood Archival Studies (2009–2010)'

PERSON_CACHE = {}

def norm_key(title):
    if not title: return ""
    t = title.lower()
    t = re.sub(r'^(?:the|a|an)\s+', '', t)
    t = re.sub(r'[^a-z0-9]', '', t)
    return t

def similarity(a, b):
    return SequenceMatcher(None, norm_key(a), norm_key(b)).ratio()

def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_-]+', '-', s)
    s = re.sub(r'^-+|-+$', '', s)
    return s or 'film'

def detect_language(title: str, text: str) -> str:
    yoruba_cues = [
        'aye', 'omo', 'aso', 'igbagbe', 'onitemi', 'orun', 'aladaba', 'ojude', 'saworoide', 
        'arugba', 'enikeji', 'owuye', 'abikoye', 'modupe', 'olowo', 'taloye', 'gbenga', 
        'adebayo', 'femi', 'funke', 'odunlade', 'muyideen', 'sola', 'sobowale'
    ]
    combined = (title + ' ' + text).lower()
    matches = sum(1 for cue in yoruba_cues if re.search(rf'\b{cue}\b', combined))
    return 'Yoruba' if matches >= 2 else 'English'

def parse_rating_val(quote: str, default: float = 3.5) -> float:
    m = re.search(r'(?:RATING|SCORE|GRADE)\s*[:\-–]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:\/\s*([0-9]+))?|\d+%)', quote, re.I)
    if m:
        raw = m.group(1).replace('%', '').strip()
        try:
            if '/' in raw:
                parts = raw.split('/')
                num = float(parts[0].strip())
                den = float(parts[1].strip())
                return round((num / den) * 5.0, 1)
            val = float(raw)
            if val > 10:
                return round((val / 100.0) * 5.0, 1)
            elif val <= 5.0:
                return round(val, 1)
            elif val <= 10.0:
                return round(val / 2.0, 1)
        except:
            pass
    return default

def get_or_create_person(name: str) -> str:
    clean = (name or "").strip()
    if not clean or len(clean) < 2:
        return ""
    p_slug = slugify(clean)
    if p_slug in PERSON_CACHE:
        return PERSON_CACHE[p_slug]

    # Fast indexed lookup by slug or name
    try:
        res = supabase.from_('people').select('id, name').or_(f"slug.eq.{p_slug},name.ilike.{clean}").limit(1).execute()
        if res.data:
            pid = res.data[0]['id']
            PERSON_CACHE[p_slug] = pid
            return pid
    except Exception:
        pass

    # Insert new person
    try:
        new_payload = {
            'name': clean,
            'slug': p_slug,
            'nationality': 'Nigerian',
            'source': 'archive_movie_evolution'
        }
        ins = supabase.from_('people').insert(new_payload).execute()
        if ins.data:
            pid = ins.data[0]['id']
            PERSON_CACHE[p_slug] = pid
            return pid
    except Exception:
        # On collision, lookup by slug
        try:
            res = supabase.from_('people').select('id').eq('slug', p_slug).limit(1).execute()
            if res.data:
                pid = res.data[0]['id']
                PERSON_CACHE[p_slug] = pid
                return pid
        except:
            pass
    return ""

def reconcile_credits(film_id: str, new_credits: list):
    """
    Strict Zero-Duplicate Actor Guarantee & In-Place Update Rule (AGENTS.md).
    """
    try:
        curr_res = supabase.from_('credits').select('id, person_id, role, character_name, billing_order').eq('film_id', film_id).execute()
        existing_credits = curr_res.data or []
    except Exception as e:
        print(f"    [WARN] Error fetching existing credits: {e}")
        existing_credits = []

    credits_by_person = {}
    for c in existing_credits:
        pid = c.get('person_id')
        if pid:
            if pid not in credits_by_person:
                credits_by_person[pid] = []
            credits_by_person[pid].append(c)

    for cred in new_credits:
        person_name = cred.get('person_name', '').strip()
        role = cred.get('role', 'Actor').strip()
        character_name = (cred.get('character_name') or '').strip()
        order = cred.get('billing_order', 100)

        if not person_name:
            continue

        person_id = get_or_create_person(person_name)
        if not person_id:
            continue

        is_actor = role.lower() in ('actor', 'cast')
        existing_for_person = credits_by_person.get(person_id, [])

        matched_credit = None
        for ec in existing_for_person:
            ec_role = (ec.get('role') or '').lower()
            if is_actor and ec_role in ('actor', 'cast'):
                matched_credit = ec
                break
            elif not is_actor and ec_role == role.lower():
                matched_credit = ec
                break

        if matched_credit:
            # Update existing credit in-place
            cid = matched_credit['id']
            patch = {}
            if character_name and (not matched_credit.get('character_name') or matched_credit.get('character_name') != character_name):
                patch['character_name'] = character_name
            if order and order < (matched_credit.get('billing_order') or 999):
                patch['billing_order'] = order
            if patch:
                try:
                    supabase.from_('credits').update(patch).eq('id', cid).execute()
                    print(f"    [UPDATED CREDIT] {person_name} ({role}) in-place: {patch}")
                except Exception as ex:
                    print(f"    [WARN] Failed to patch credit {cid}: {ex}")
        else:
            # Insert fresh credit row
            payload = {
                'film_id': film_id,
                'person_id': person_id,
                'role': role,
                'character_name': character_name or None,
                'billing_order': order,
                'source': 'archive_movie_evolution'
            }
            try:
                ins = supabase.from_('credits').insert(payload).execute()
                if ins.data:
                    credits_by_person.setdefault(person_id, []).append(ins.data[0])
            except Exception as ex:
                print(f"    [WARN] Failed to insert credit for {person_name}: {ex}")

def ingest_review(film_id: str, post: dict):
    permalink = post.get('permalink')
    if not permalink:
        return

    # Check if review already exists
    try:
        check = supabase.from_('critic_reviews').select('id').eq('review_url', permalink).execute()
        if check.data:
            return
    except:
        pass

    student = post.get('student')
    quote_body = post.get('quote') or post.get('synopsis', '')[:300]
    if student:
        formatted_quote = f"[Review by {student}]: {quote_body}"
    else:
        formatted_quote = quote_body

    if len(formatted_quote) > 900:
        formatted_quote = formatted_quote[:897] + '...'

    rating = parse_rating_val(formatted_quote)

    payload = {
        'film_id': film_id,
        'critic_id': CRITIC_ID,
        'critic_name': CRITIC_NAME,
        'critic_title': CRITIC_TITLE,
        'quote': formatted_quote,
        'rating': rating,
        'review_url': permalink,
        'is_featured': True,
        'is_anonymous': False
    }

    try:
        supabase.from_('critic_reviews').insert(payload).execute()
        print(f"    [REVIEW ADDED] From {student or 'Contributor'}: {permalink}")
    except Exception as ex:
        print(f"    [WARN] Failed to insert critic review for {permalink}: {ex}")

def run_ingestion():
    print("=" * 70)
    print("STARTING MOVIE EVOLUTION ARCHIVE INGESTION PIPELINE")
    print("=" * 70)

    with open('scratch/extracted_blog_archive.json', encoding='utf-8') as f:
        posts = json.load(f)
    print(f"Loaded {len(posts)} extracted film review posts.")

    print("Fetching existing films from database for matching...")
    existing_films = []
    page = 0
    limit = 1000
    while True:
        res = supabase.from_('films').select('id, title, year, synopsis, poster_url, backdrop_url, slug').lte('year', 2016).range(page * limit, (page + 1) * limit - 1).execute()
        data = res.data or []
        existing_films.extend(data)
        if len(data) < limit:
            break
        page += 1

    res_null = supabase.from_('films').select('id, title, year, synopsis, poster_url, backdrop_url, slug').is_('year', 'null').limit(2000).execute()
    if res_null.data:
        existing_films.extend(res_null.data)

    print(f"Cached {len(existing_films)} films from DB for accurate matching.")

    films_by_norm = {}
    for f in existing_films:
        nk = norm_key(f['title'])
        if nk and nk not in films_by_norm:
            films_by_norm[nk] = f

    from collections import defaultdict
    grouped_posts = defaultdict(list)
    for p in posts:
        k = norm_key(p['title'])
        if k:
            grouped_posts[k].append(p)

    print(f"Grouped into {len(grouped_posts)} distinct movies.")

    updated_existing_count = 0
    created_new_count = 0
    total_reviews_linked = 0

    for idx, (g_key, post_list) in enumerate(grouped_posts.items()):
        primary = post_list[0]
        film_title = primary['title']
        film_year = primary.get('year')
        images = primary.get('images', [])

        print(f"\n[{idx+1}/{len(grouped_posts)}] Processing: '{film_title}' ({film_year or 'Year ?'}) - {len(post_list)} review(s)")

        matched_film = films_by_norm.get(g_key)
        if not matched_film:
            for db_k, db_f in films_by_norm.items():
                if similarity(g_key, db_k) >= 0.90:
                    matched_film = db_f
                    break

        film_id = None

        if matched_film:
            # Reconcile existing DB film
            film_id = matched_film['id']
            print(f"  -> [MATCHED] Existing DB Film: '{matched_film['title']}' (ID: {film_id})")

            film_patch = {}
            if not matched_film.get('synopsis') and primary.get('synopsis'):
                film_patch['synopsis'] = primary['synopsis']
                print("     [PATCH] Setting missing synopsis on existing film.")

            if not matched_film.get('poster_url') and images:
                film_patch['poster_url'] = images[0]
                if len(images) > 1:
                    film_patch['backdrop_url'] = images[1]
                else:
                    film_patch['backdrop_url'] = images[0]
                print(f"     [IMAGE] Setting missing poster/backdrop: {images[0]}")

            if film_patch:
                try:
                    supabase.from_('films').update(film_patch).eq('id', film_id).execute()
                    print(f"     [SUCCESS] Patched film record.")
                except Exception as ex:
                    print(f"     [WARN] Error patching film {film_id}: {ex}")

            updated_existing_count += 1
        else:
            # Create new film
            print(f"  -> [CREATING] New Film: '{film_title}'")
            poster_url = images[0] if images else None
            backdrop_url = images[1] if len(images) > 1 else poster_url
            synopsis_text = primary.get('synopsis') or primary.get('quote') or None
            lang = detect_language(film_title, primary.get('synopsis', ''))

            base_slug = slugify(film_title) + (f"-{film_year}" if film_year else "")
            test_slug = base_slug
            chk = supabase.from_('films').select('id').eq('slug', test_slug).execute()
            if chk.data:
                test_slug = f"{base_slug}-{int(time.time()) % 10000}"

            new_film_payload = {
                'title': film_title,
                'slug': test_slug,
                'year': film_year,
                'synopsis': synopsis_text,
                'poster_url': poster_url,
                'backdrop_url': backdrop_url,
                'language': lang,
                'is_nollywood': True,
                'is_published': True,
                'status': 'released',
                'content_type': 'movie',
                'source': 'archive_movie_evolution'
            }

            try:
                ins_res = supabase.from_('films').insert(new_film_payload).execute()
                if ins_res.data:
                    film_id = ins_res.data[0]['id']
                    print(f"     [SUCCESS] Created film '{film_title}' with ID: {film_id} (slug: {test_slug})")
                    films_by_norm[g_key] = ins_res.data[0]
                    created_new_count += 1
                else:
                    print(f"     [ERROR] Failed to insert film '{film_title}'.")
                    continue
            except Exception as ex:
                print(f"     [ERROR] Exception inserting film '{film_title}': {ex}")
                continue

        # Reconcile credits
        credits_to_sync = []
        director_name = primary.get('director')
        if director_name:
            credits_to_sync.append({
                'person_name': director_name,
                'role': 'Director',
                'billing_order': 1
            })

        producer_name = primary.get('producer')
        if producer_name:
            credits_to_sync.append({
                'person_name': producer_name,
                'role': 'Producer',
                'billing_order': 2
            })

        writer_name = primary.get('writer')
        if writer_name:
            credits_to_sync.append({
                'person_name': writer_name,
                'role': 'Screenplay',
                'billing_order': 3
            })

        cast_list = primary.get('cast', [])
        for c_idx, c in enumerate(cast_list):
            actor_name = c.get('actor')
            char_name = c.get('character')
            if actor_name:
                credits_to_sync.append({
                    'person_name': actor_name,
                    'role': 'Actor',
                    'character_name': char_name,
                    'billing_order': 10 + c_idx
                })

        if film_id and credits_to_sync:
            reconcile_credits(film_id, credits_to_sync)

        # Attach critic reviews
        if film_id:
            for rev_post in post_list:
                ingest_review(film_id, rev_post)
                total_reviews_linked += 1

    print("\n" + "=" * 70)
    print("INGESTION PIPELINE COMPLETE!")
    print(f"  Existing Films Reconciled / Enriched: {updated_existing_count}")
    print(f"  New Films Created:                   {created_new_count}")
    print(f"  Total Critic Reviews Linked:         {total_reviews_linked}")
    print("=" * 70)

if __name__ == '__main__':
    run_ingestion()
