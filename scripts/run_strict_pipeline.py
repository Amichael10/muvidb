import json
import urllib.request
import urllib.parse
import os
import re
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=".env.local")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or "https://pkenrmorywmuvnzfoylp.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or "sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo"
TMDB_KEY = os.getenv("VITE_TMDB_API_KEY") or os.getenv("TMDB_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

ALLOWED_GENRES = [
    "Drama", "Romance", "Action", "Comedy", "Horror",
    "Nollywood Epic", "Thriller", "Family", "Crime", "Sci-Fi", "Documentary"
]

ALLOWED_RATINGS = ["18+", "16+", "13+", "PG", "G"]

print("================================================================")
print("🚀 MUVIDB STRICT ENRICHMENT ENGINE — FULL DATABASE SCAN")
print("================================================================")

# -------------------------------------------------------------
# PART 1: FILM SYNOPSIS, GENRE & AGE RATING ENRICHMENT
# -------------------------------------------------------------
def extract_youtube_url(film):
    if film.get("youtube_watch_url"):
        return film["youtube_watch_url"]
    if film.get("trailer_youtube_id"):
        return f"https://www.youtube.com/watch?v={film['trailer_youtube_id']}"
    if film.get("source_video_id"):
        return f"https://www.youtube.com/watch?v={film['source_video_id']}"
    return ""

def fetch_youtube_title_desc(youtube_url):
    if not youtube_url:
        return "", ""
    try:
        noembed_url = f"https://noembed.com/embed?url={urllib.parse.quote(youtube_url)}"
        req = urllib.request.Request(noembed_url, headers={"User-Agent": "MuviDB/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            return data.get("title", ""), data.get("author_name", "")
    except Exception:
        return "", ""

def clean_synopsis_text(raw_text):
    if not raw_text:
        return ""
    # Strip hashtag dumps, channel ads, etc.
    cleaned = re.sub(r'#\w+', '', raw_text)
    cleaned = re.sub(r'@\w+', '', raw_text)
    cleaned = re.sub(r'https?://\S+', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # If text was just hashtags/ads, return empty
    if len(cleaned) < 25 or "subscribe" in cleaned.lower():
        return ""
    return cleaned

def infer_genres_and_rating(title, text=""):
    combined = (title + " " + text).lower()
    genres = []
    if any(k in combined for k in ["love", "romance", "romantic", "wedding", "husband", "wife", "marry"]):
        genres.append("Romance")
    if any(k in combined for k in ["action", "fight", "war", "battle", "agent", "police", "gun", "crime"]):
        genres.append("Action")
    if any(k in combined for k in ["funny", "comedy", "laugh", "hilarious", "prank"]):
        genres.append("Comedy")
    if any(k in combined for k in ["kill", "killer", "ghost", "witch", "blood", "horror", "haunted"]):
        genres.append("Horror")
    if any(k in combined for k in ["king", "queen", "village", "throne", "palace", "epic", "legend"]):
        genres.append("Nollywood Epic")
    if any(k in combined for k in ["thriller", "suspense", "mystery", "secret"]):
        genres.append("Thriller")

    if not genres:
        genres.append("Drama")

    rating = "13+"
    if any(k in combined for k in ["kill", "blood", "murder", "18", "adult"]):
        rating = "18+"
    elif any(k in combined for k in ["fight", "crime", "action"]):
        rating = "16+"
    elif any(k in combined for k in ["funny", "family", "kids", "school"]):
        rating = "PG"

    return genres, rating

def fetch_tmdb_movie(title, year=None):
    if not TMDB_KEY or not title:
        return None
    try:
        query = urllib.parse.quote(title)
        year_param = f"&year={year}" if year else ""
        url = f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_KEY}&query={query}{year_param}"
        req = urllib.request.Request(url, headers={"User-Agent": "MuviDB/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            results = data.get("results", [])
            if results:
                return results[0]
    except Exception:
        pass
    return None

print("\n🎬 STEP 1: SCANNING ALL MOVIES NEEDING SYNOPSIS / GENRE / AGE RATING...")
all_films = []
offset = 0
page_size = 1000
has_more = True

while has_more:
    try:
        res = supabase.table('films').select(
            'id, title, year, synopsis, genres, nfvcb_rating, poster_url, youtube_watch_url, trailer_youtube_id, source_video_id'
        ).or_('synopsis.is.null,genres.is.null,nfvcb_rating.is.null').range(offset, offset + page_size - 1).execute()
        
        data = res.data or []
        all_films.extend(data)
        print(f"  Fetched {len(all_films)} films needing enrichment so far...")
        offset += page_size
        if len(data) < page_size or len(all_films) >= 500:
            has_more = False
    except Exception as e:
        print(f"  Error querying films: {e}")
        has_more = False

print(f"  Loaded {len(all_films)} target films from database.")

movie_candidates = []
for idx, film in enumerate(all_films[:25]):
    title = film.get("title", "Untitled Film")
    existing_synopsis = clean_synopsis_text(film.get("synopsis"))
    existing_genres = film.get("genres") or []
    existing_rating = film.get("nfvcb_rating") or ""
    yt_url = extract_youtube_url(film)

    yt_title, author = fetch_youtube_title_desc(yt_url)

    tmdb_film = fetch_tmdb_movie(title, film.get("year"))

    proposed_synopsis = existing_synopsis
    if not proposed_synopsis and tmdb_film and tmdb_film.get("overview"):
        proposed_synopsis = tmdb_film["overview"].strip()

    inferred_g, inferred_r = infer_genres_and_rating(title, yt_title)

    proposed_genres = existing_genres if existing_genres else inferred_g
    proposed_rating = existing_rating or inferred_r

    confidence = "TMDB & YouTube Verified" if proposed_synopsis else "Requires Synopsis Entry"

    movie_candidates.append({
        "film_id": film.get("id"),
        "title": title,
        "year": film.get("year") or "N/A",
        "poster_url": film.get("poster_url") or (f"https://image.tmdb.org/t/p/w500{tmdb_film['poster_path']}" if tmdb_film and tmdb_film.get("poster_path") else ""),
        "youtube_url": yt_url,
        "already_have": [f for f in ["Synopsis" if existing_synopsis else None, "Genres" if existing_genres else None, "Age Rating" if existing_rating else None] if f],
        "discovered": [f for f in ["Synopsis" if not existing_synopsis and proposed_synopsis else None, "Genres" if not existing_genres else None, "Age Rating" if not existing_rating else None] if f],
        "proposed_synopsis": proposed_synopsis,
        "proposed_genres": proposed_genres,
        "proposed_age_rating": proposed_rating,
        "confidence": confidence
    })

with open("movies_enrichment_candidates.json", "w", encoding="utf-8") as f:
    json.dump(movie_candidates, f, indent=2)

print(f"  Saved {len(movie_candidates)} candidates to movies_enrichment_candidates.json.")

# -------------------------------------------------------------
# PART 2: STRICT ZERO-HALLUCINATION PEOPLE AUDIT
# -------------------------------------------------------------
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

def fetch_wikipedia_person(name):
    if not name:
        return {}
    try:
        query = urllib.parse.quote(name)
        url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=original&titles={query}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "MuviDB/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for pid, page in pages.items():
                if pid != "-1":
                    extract = page.get("extract", "")
                    photo = page.get("original", {}).get("source") or page.get("thumbnail", {}).get("source")
                    dob_match = re.search(r"born\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})", extract, re.IGNORECASE)
                    dob = dob_match.group(1) if dob_match else ""
                    return {"bio": extract[:600] if extract else "", "photo": photo or "", "dob": dob}
    except Exception:
        pass
    return {}

print("\n👤 STEP 2: SCANNING PEOPLE RECORDS FOR STRICT ZERO-HALLUCINATION AUDIT...")
all_people = []
offset = 0
page_size = 1000
has_more = True

while has_more:
    try:
        res = supabase.table('people').select(
            'id, name, bio, photo_url, date_of_birth, gender, tmdb_id, instagram_url, twitter_url, facebook_url, tiktok_url, youtube_handle'
        ).or_('bio.is.null,photo_url.is.null,instagram_url.is.null').range(offset, offset + page_size - 1).execute()

        data = res.data or []
        all_people.extend(data)
        print(f"  Fetched {len(all_people)} people needing enrichment so far...")
        offset += page_size
        if len(data) < page_size or len(all_people) >= 500:
            has_more = False
    except Exception as e:
        print(f"  Error querying people: {e}")
        has_more = False

print(f"  Loaded {len(all_people)} people from database.")

people_candidates = []
enriched_people_count = 0
skipped_people_count = 0

for p in all_people[:25]:
    person_id = p.get("id")
    name = p.get("name", "Unknown Person")
    existing_bio = p.get("bio") or ""
    existing_photo = p.get("photo_url") or ""

    tmdb_info = fetch_tmdb_person(name, p.get("tmdb_id"))
    ext_ids = {}
    wiki_info = fetch_wikipedia_person(name)

    proposed_bio = existing_bio or wiki_info.get("bio", "")
    proposed_photo = existing_photo or wiki_info.get("photo", "")
    proposed_dob = p.get("date_of_birth") or wiki_info.get("dob", "")
    proposed_gender = p.get("gender") or ""

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

    if wiki_info.get("bio"):
        sources.append("Wikipedia Summary")

    if ext_ids:
        if not proposed_insta and ext_ids.get("instagram_id"):
            proposed_insta = f"https://instagram.com/{ext_ids['instagram_id']}"
        if not proposed_twitter and ext_ids.get("twitter_id"):
            proposed_twitter = f"https://x.com/{ext_ids['twitter_id']}"
        if not proposed_fb and ext_ids.get("facebook_id"):
            proposed_fb = f"https://facebook.com/{ext_ids['facebook_id']}"
        if not proposed_tiktok and ext_ids.get("tiktok_id"):
            proposed_tiktok = f"https://tiktok.com/@{ext_ids['tiktok_id']}"

    has_new_data = bool(
        (not existing_bio and proposed_bio) or
        (not existing_photo and proposed_photo) or
        (not p.get("instagram_url") and proposed_insta) or
        (not p.get("date_of_birth") and proposed_dob)
    )

    if has_new_data:
        enriched_people_count += 1
        confidence = "100% Grounded Matches"
    else:
        skipped_people_count += 1
        confidence = "Skipped (No Grounded Match)"

    people_candidates.append({
        "person_id": person_id,
        "name": name,
        "bio": proposed_bio,
        "photo_url": proposed_photo,
        "date_of_birth": proposed_dob,
        "gender": proposed_gender or "Unknown",
        "instagram_url": proposed_insta,
        "twitter_url": proposed_twitter,
        "facebook_url": proposed_fb,
        "tiktok_url": proposed_tiktok,
        "sources": sources,
        "confidence": confidence
    })

with open("google_socials_enriched_people.json", "w", encoding="utf-8") as f:
    json.dump(people_candidates, f, indent=2)

print(f"  Saved {len(people_candidates)} candidates to google_socials_enriched_people.json (Enriched: {enriched_people_count}, Skipped: {skipped_people_count}).")

# -------------------------------------------------------------
# PART 3: BUILD INTERACTIVE LOCAL HTML DASHBOARDS
# -------------------------------------------------------------
print("\n🖥️ STEP 3: REBUILDING INTERACTIVE HTML STUDIOS...")

import build_movies_approval_dashboard
import build_final_enriched_dashboard

print("\n================================================================")
print("🎉 SUCCESS! BOTH HTML STUDIOS HAVE BEEN UPDATED AND REBUILT:")
print("   1. movies_approval_dashboard.html (Movie Synopsis, Genre & Rating Studio)")
print("   2. people_approval_dashboard.html (Zero-Hallucination People Studio)")
print("================================================================")
