import json
import urllib.request
import urllib.parse
import os
import re
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

SUPABASE_URL = "https://pkenrmorywmuvnzfoylp.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_fXxu9pH8yK8s6xEvEJWNgw_T3Nbbvdo"

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json"
}

ALLOWED_GENRES = [
    "Drama", "Romance", "Action", "Comedy", "Horror",
    "Nollywood Epic", "Thriller", "Family", "Crime", "Sci-Fi", "Documentary"
]

ALLOWED_RATINGS = ["18+", "16+", "13+", "PG", "G"]

def extract_youtube_url(film):
    if film.get("youtube_watch_url"):
        return film["youtube_watch_url"]
    if film.get("trailer_youtube_id"):
        return f"https://www.youtube.com/watch?v={film['trailer_youtube_id']}"
    if film.get("source_video_id"):
        return f"https://www.youtube.com/watch?v={film['source_video_id']}"
    return ""

def fetch_youtube_metadata(youtube_url):
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

def get_gemini_enrichment(title, year="", yt_title="", yt_desc=""):
    """
    Calls Gemini API with the user's exact query:
    'write me a muvidb worthy synopsis for this movie and tell me the genre and age rating for it'
    Does NOT fabricate generic templates if no info is available.
    """
    if not GEMINI_KEY:
        return {"synopsis": "", "genre": "Drama", "age_rating": "13+"}

    prompt = f"""You are an expert film editor for MuviDB, the premier African and Nollywood movie database.
Your goal is to provide high-accuracy metadata for the film below.

USER REQUIREMENT:
"write me a muvidb worthy synopsis for this movie and tell me the genre and age rating for it"

STRICT INSTRUCTIONS:
1. SYNOPSIS: Write a clean, high-quality, professional 2-4 sentence synopsis describing the plot and central conflict.
   - Do NOT include hashtags, promotional text, YouTube URLs, channel names, actor lists, or 'subscribe' messages.
   - If you have NO plot information or context and cannot provide a factual summary, leave synopsis as an empty string "". DO NOT FABRICATE OR GUESS.
2. GENRE: Identify the single best matching genre from this exact list:
   [Drama, Romance, Action, Comedy, Horror, Nollywood Epic, Thriller, Family, Crime, Sci-Fi, Documentary]
3. AGE RATING: Suggest the appropriate maturity/age rating from this exact list:
   [18+, 16+, 13+, PG, G]

FILM DATA:
Title: {title}
Year: {year}
YouTube Title: {yt_title}
Raw Description: {yt_desc[:1200]}

Respond STRICTLY with a valid JSON object:
{{
  "synopsis": "The clean MuviDB synopsis here or empty string if unknown",
  "genre": "Drama",
  "age_rating": "16+"
}}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            raw_text = data['candidates'][0]['content']['parts'][0]['text']
            parsed = json.loads(raw_text)
            
            # Map genre
            g_raw = parsed.get("genre", "Drama").strip()
            genre = g_raw if g_raw in ALLOWED_GENRES else "Drama"
            
            # Map rating
            r_raw = parsed.get("age_rating", "13+").strip()
            rating = r_raw if r_raw in ALLOWED_RATINGS else "13+"

            return {
                "synopsis": parsed.get("synopsis", "").strip(),
                "genre": genre,
                "age_rating": rating
            }
    except Exception as e:
        print(f"  Gemini error for '{title}':", e)
        return {"synopsis": "", "genre": "Drama", "age_rating": "13+"}

print("🚀 SCANNING ENTIRE DATABASE FOR MOVIES NEEDING SYNOPSES, GENRES & AGE RATINGS...")

all_films = []
offset = 0
limit = 1000
has_more = True

while has_more:
    url = f"{SUPABASE_URL}/rest/v1/films?select=id,title,year,synopsis,genres,maturity_rating,poster_url,youtube_watch_url,trailer_youtube_id,source_video_id&or=(synopsis.is.null,synopsis.eq.,genres.is.null,maturity_rating.is.null)&offset={offset}&limit={limit}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            all_films.extend(data)
            print(f"  Loaded batch at offset {offset}: {len(data)} movies...")
            offset += limit
            if len(data) < limit:
                has_more = False
    except Exception as e:
        print(f"Error querying films: {e}")
        has_more = False

print(f"\n✅ Total Movies Scanned: {len(all_films)}")
print("🚀 RUNNING GEMINI SYNOPSIS & RATING GENERATOR...")

candidates = []

for idx, film in enumerate(all_films):
    if (idx + 1) % 25 == 0 or (idx + 1) == len(all_films):
        print(f"  Processed {idx + 1} / {len(all_films)} movies...")

    title = film.get("title", "Untitled Film")
    existing_synopsis = film.get("synopsis") or ""
    existing_genres = film.get("genres") or []
    existing_rating = film.get("maturity_rating") or ""
    yt_url = extract_youtube_url(film)

    yt_title, author = fetch_youtube_metadata(yt_url)

    if existing_synopsis and existing_genres and existing_rating:
        proposed_synopsis = existing_synopsis
        proposed_genres = existing_genres
        proposed_rating = existing_rating
        confidence = "Existing Verified Data"
    else:
        enrichment = get_gemini_enrichment(title, film.get("year") or "", yt_title)
        proposed_synopsis = existing_synopsis or enrichment["synopsis"]
        proposed_genres = existing_genres if existing_genres else [enrichment["genre"]]
        proposed_rating = existing_rating or enrichment["age_rating"]
        confidence = "Gemini Grounded" if proposed_synopsis else "Requires Review / Empty"

    candidates.append({
        "film_id": film.get("id"),
        "title": title,
        "year": film.get("year") or "N/A",
        "poster_url": film.get("poster_url") or "",
        "youtube_url": yt_url,
        "already_have": [f for f in ["Synopsis" if existing_synopsis else None, "Genres" if existing_genres else None, "Age Rating" if existing_rating else None] if f],
        "discovered": [f for f in ["Synopsis" if not existing_synopsis and proposed_synopsis else None, "Genres" if not existing_genres else None, "Age Rating" if not existing_rating else None] if f],
        "proposed_synopsis": proposed_synopsis,
        "proposed_genres": proposed_genres,
        "proposed_age_rating": proposed_rating,
        "confidence": confidence
    })

# Save JSON candidates
with open("movies_enrichment_candidates.json", "w", encoding="utf-8") as f:
    json.dump(candidates, f, indent=2)

print(f"\n🎉 SAVED {len(candidates)} MOVIE CANDIDATES TO movies_enrichment_candidates.json!")
