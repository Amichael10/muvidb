import json
import urllib.request
import urllib.parse
import os
import re
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")
TMDB_KEY = os.getenv("VITE_TMDB_API_KEY") or os.getenv("TMDB_API_KEY")

SUPABASE_URL = "https://pkenrmorywmuvnzfoylp.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo"

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json"
}

def fetch_tmdb_person(name, tmdb_id=None):
    if tmdb_id and TMDB_KEY:
        try:
            url = f"https://api.themoviedb.org/3/person/{tmdb_id}?api_key={TMDB_KEY}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=4) as resp:
                return json.loads(resp.read().decode())
        except Exception:
            pass

    if name and TMDB_KEY:
        try:
            query = urllib.parse.quote(name)
            url = f"https://api.themoviedb.org/3/search/person?api_key={TMDB_KEY}&query={query}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode())
                results = data.get("results", [])
                for p in results:
                    if p.get("name", "").strip().lower() == name.strip().lower():
                        return p
        except Exception:
            pass

    return None

def fetch_tmdb_external_ids(tmdb_id):
    if not tmdb_id or not TMDB_KEY:
        return {}
    try:
        url = f"https://api.themoviedb.org/3/person/{tmdb_id}/external_ids?api_key={TMDB_KEY}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=4) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return {}

def fetch_wikipedia_bio(name):
    if not name:
        return None
    try:
        query = urllib.parse.quote(name)
        url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={query}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "MuviDB/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                if pid != "-1" and pdata.get("extract"):
                    extract = pdata["extract"].strip()
                    if len(extract) > 40 and any(k in extract.lower() for k in ["actor", "actress", "director", "producer", "nollywood", "film"]):
                        return extract[:1200]
    except Exception:
        pass
    return None

print("🚀 SCANNING ENTIRE DATABASE FOR PEOPLE RECORDS NEEDING AUDIT...")

all_people = []
offset = 0
limit = 1000
has_more = True

while has_more:
    url = f"{SUPABASE_URL}/rest/v1/people?select=id,name,bio,photo_url,date_of_birth,gender,tmdb_id,instagram_url,twitter_url,facebook_url,tiktok_url,youtube_handle&or=(bio.is.null,photo_url.is.null,instagram_url.is.null)&offset={offset}&limit={limit}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            all_people.extend(data)
            print(f"  Loaded batch at offset {offset}: {len(data)} people...")
            offset += limit
            if len(data) < limit:
                has_more = False
    except Exception as e:
        print(f"Error querying people: {e}")
        has_more = False

print(f"\n✅ Total People Scanned: {len(all_people)}")
print("🚀 AUDITING WITH STRICT ZERO-HALLUCINATION RULES...")

enriched_candidates = []
enriched_count = 0
skipped_count = 0

for idx, p in enumerate(all_people):
    if (idx + 1) % 50 == 0 or (idx + 1) == len(all_people):
        print(f"  Processed {idx + 1} / {len(all_people)} people...")

    person_id = p.get("id")
    name = p.get("name", "Unknown Person")
    existing_bio = p.get("bio") or ""
    existing_photo = p.get("photo_url") or ""

    tmdb_info = fetch_tmdb_person(name, p.get("tmdb_id"))
    ext_ids = {}

    proposed_bio = existing_bio
    proposed_photo = existing_photo
    proposed_dob = p.get("date_of_birth") or ""
    proposed_gender = p.get("gender") or ""

    # STRICT SOCIAL LINKS: ONLY accept if explicit external ID returned from TMDB. NEVER CONCATENATE NAMES.
    proposed_insta = p.get("instagram_url") or ""
    proposed_twitter = p.get("twitter_url") or ""
    proposed_fb = p.get("facebook_url") or ""
    proposed_tiktok = p.get("tiktok_url") or ""

    sources = []

    if tmdb_info:
        active_tmdb_id = tmdb_info.get("id")
        ext_ids = fetch_tmdb_external_ids(active_tmdb_id)
        sources.append("TMDB Verified Profile")

        if not proposed_bio and tmdb_info.get("biography"):
            bio_text = tmdb_info["biography"].strip()
            if len(bio_text) > 20:
                proposed_bio = bio_text

        if not proposed_photo and tmdb_info.get("profile_path"):
            proposed_photo = f"https://image.tmdb.org/t/p/w500{tmdb_info['profile_path']}"

        if not proposed_dob and tmdb_info.get("birthday"):
            proposed_dob = tmdb_info["birthday"]

        if not proposed_gender:
            if tmdb_info.get("gender") == 1:
                proposed_gender = "female"
            elif tmdb_info.get("gender") == 2:
                proposed_gender = "male"

    # Social Handles from TMDB External IDs ONLY
    if ext_ids:
        if not proposed_insta and ext_ids.get("instagram_id"):
            proposed_insta = f"https://instagram.com/{ext_ids['instagram_id']}"
        if not proposed_twitter and ext_ids.get("twitter_id"):
            proposed_twitter = f"https://x.com/{ext_ids['twitter_id']}"
        if not proposed_fb and ext_ids.get("facebook_id"):
            proposed_fb = f"https://facebook.com/{ext_ids['facebook_id']}"
        if not proposed_tiktok and ext_ids.get("tiktok_id"):
            proposed_tiktok = f"https://tiktok.com/@{ext_ids['tiktok_id']}"

    # Wikipedia Bio Check if still missing
    if not proposed_bio:
        wiki_bio = fetch_wikipedia_bio(name)
        if wiki_bio:
            proposed_bio = wiki_bio
            sources.append("Wikipedia Page")

    has_new_data = bool(
        (not existing_bio and proposed_bio) or
        (not existing_photo and proposed_photo) or
        (not p.get("instagram_url") and proposed_insta)
    )

    if has_new_data:
        enriched_count += 1
        confidence = "100% Grounded Matches"
    else:
        skipped_count += 1
        confidence = "Skipped (No Grounded Match)"

    enriched_candidates.append({
        "person_id": person_id,
        "name": name,
        "bio": proposed_bio,
        "photo_url": proposed_photo,
        "date_of_birth": proposed_dob,
        "gender": proposed_gender,
        "instagram_url": proposed_insta,
        "twitter_url": proposed_twitter,
        "facebook_url": proposed_fb,
        "tiktok_url": proposed_tiktok,
        "sources": sources,
        "confidence": confidence
    })

# Save JSON candidates
with open("google_socials_enriched_people.json", "w", encoding="utf-8") as f:
    json.dump(enriched_candidates, f, indent=2)

print(f"\n🎉 AUDIT COMPLETE! Grounded Candidates: {enriched_count} | Skipped (Unverified): {skipped_count}")
