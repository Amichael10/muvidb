import os
import json
import urllib.request
import urllib.parse
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

def fetch_sample_films():
    url = f"{SUPABASE_URL}/rest/v1/films?select=id,title,year,synopsis,genres,youtube_watch_url,trailer_youtube_id,source_video_id&or=(synopsis.is.null,synopsis.eq.)&limit=3"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def get_gemini_synopsis_genre_rating(title, year="", yt_title="", yt_desc=""):
    prompt = f"""You are an expert film editor for MuviDB.
Task: Write a clean, high-quality, professional synopsis for this movie, and determine its single best matching genre and age rating.

USER INSTRUCTION:
"write me a muvidb worthy synopsis for this movie and tell me the genre and age rating for it"

STRICT RULES:
- Synopsis: 2 to 4 engaging, professional sentences summarizing plot and conflict. No promotional junk, YouTube channel tags, hashtags, actor names, or links.
- Genre: Choose the single best match from [Drama, Romance, Action, Comedy, Horror, Nollywood Epic, Thriller, Family, Crime, Sci-Fi, Documentary].
- Age Rating: Choose from [18+, 16+, 13+, PG, G].
- If you are NOT sure or have zero plot context, leave synopsis empty "".

MOVIE CONTEXT:
Title: {title}
Year: {year}
YouTube Title: {yt_title}
Raw YouTube Description: {yt_desc[:1000]}

Respond ONLY in valid JSON format:
{{
  "synopsis": "...",
  "genre": "...",
  "age_rating": "..."
}}
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            text = data['candidates'][0]['content']['parts'][0]['text']
            return json.loads(text)
    except Exception as e:
        print("Gemini API call failed:", e)
        return {"synopsis": "", "genre": "Drama", "age_rating": "13+"}

print("Fetching sample films...")
films = fetch_sample_films()
for f in films:
    print(f"\n--- Processing: {f['title']} ({f.get('year')}) ---")
    res = get_gemini_synopsis_genre_rating(f['title'], f.get('year') or "")
    print("Synopsis:", res.get("synopsis"))
    print("Genre:", res.get("genre"))
    print("Age Rating:", res.get("age_rating"))
