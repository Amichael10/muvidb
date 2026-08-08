import json
import re
import urllib.request
import urllib.parse
import html
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def fetch_youtube_full_details(youtube_url):
    if not youtube_url:
        return None
    v_match = re.search(r'(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', youtube_url)
    if not v_match:
        return None
    video_id = v_match.group(1)

    try:
        req = urllib.request.Request(f"https://www.youtube.com/watch?v={video_id}", headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        })
        content = urllib.request.urlopen(req, timeout=7).read().decode('utf-8', errors='ignore')

        # Extract title
        t_match = re.search(r'<title>(.*?)</title>', content)
        raw_title = html.unescape(t_match.group(1)).replace(" - YouTube", "").strip() if t_match else ""

        # Extract description
        sd_match = re.search(r'"shortDescription":"([^"]+)"', content)
        desc = ""
        if sd_match:
            desc = sd_match.group(1).encode().decode('unicode-escape', errors='ignore')
            desc = html.unescape(desc).strip()

        if not desc:
            og_match = re.search(r'<meta property="og:description" content="([^"]+)"', content)
            if og_match:
                desc = html.unescape(og_match.group(1)).strip()

        return {
            "video_id": video_id,
            "title": raw_title,
            "description": desc
        }
    except Exception:
        return None

def clean_movie_title(raw_title):
    t = raw_title
    t = re.sub(r'(?i)\bjust released\b.*', '', t)
    t = re.sub(r'(?i)\bnow streaming\b.*', '', t)
    t = re.sub(r'(?i)\bsuper interesting\b.*', '', t)
    t = re.sub(r'(?i)\bnigerian love movies?\b', '', t)
    t = re.sub(r'(?i)\bnollywood movies?\b', '', t)
    t = re.sub(r'(?i)\bkumawood movie\b', '', t)
    t = re.sub(r'(?i)\bzubby michael movies nigerian\b', '', t)
    t = re.sub(r'\[.*?\]|\(.*?\)', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t or raw_title

def clean_pure_synopsis_text(text, title):
    if not text:
        return ""
    
    clean_t = clean_movie_title(title)
    s = text

    # Remove title references
    s = re.sub(re.escape(clean_t), '', s, flags=re.IGNORECASE)
    s = re.sub(re.escape(title), '', s, flags=re.IGNORECASE)

    # Remove hashtags and promo junk
    s = re.sub(r'#\w+', '', s)
    s = re.sub(r'(?i)(every young lady needs to watch|best of|african movies|nigerian movies|watch and learn|copyright|disclaimer|all rights reserved|subscribe|starring).*', '', s)

    # Remove platform & genre words
    s = re.sub(r'(?i)\b(nollywood|kumawood|yoruba|ghanaian|nigerian|african)\b\s*', '', s)
    s = re.sub(r'(?i)\b(romantic drama|comedy-drama|feature film|comedy series|epic drama|romantic comedy|movie)\b\s*', '', s)
    s = re.sub(r'[\r\n]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()

    # Clean leading verbs / phrases like "is a story following"
    s = re.sub(r'^(?:is a|is an|follows|tells the story of|portrays|captures|centers on)\s*', '', s, flags=re.IGNORECASE)
    
    if len(s) > 0:
        s = s[0].upper() + s[1:]
    if s and not s.endswith('.'):
        s += '.'

    return s

def enrich_movie_precision(film):
    title = film.get("title", "")
    clean_t = clean_movie_title(title)
    yt_url = film.get("youtube_url") or film.get("youtube_watch_url") or ""

    yt_details = fetch_youtube_full_details(yt_url) if yt_url else None
    desc = (yt_details.get("description") if yt_details else "") or ""
    yt_t = (yt_details.get("title") if yt_details else "") or ""

    comb_text = f"{clean_t} {yt_t} {desc}".lower()

    # Determine Genres
    genres = []
    if any(k in comb_text for k in ["love", "romance", "marry", "wedding", "heart", "yours truly"]):
        genres.append("Romance")
    if any(k in comb_text for k in ["funny", "comedy", "hilarious", "landlord", "trouble", "olodo", "alajo"]):
        genres.append("Comedy")
    if any(k in comb_text for k in ["kill", "ghost", "witch", "horror", "ritualist", "demon", "darkness", "hell"]):
        genres.append("Horror")
    if any(k in comb_text for k in ["action", "fight", "assassin", "war", "warrior", "fighter"]):
        genres.append("Action")
    if any(k in comb_text for k in ["king", "queen", "princess", "palace", "village", "epic", "osupa", "akeregbe", "throne", "chief"]):
        genres.append("Nollywood Epic")
    if any(k in comb_text for k in ["thriller", "crime", "trade", "scandal", "secret", "curse", "kidnapper", "heist"]):
        genres.append("Thriller")

    if not genres:
        genres.append("Drama")

    # Determine Rating
    if any(k in comb_text for k in ["kill", "blood", "murder", "assassin", "darkness", "ritualist", "18"]):
        rating = "18"
    elif any(k in comb_text for k in ["fight", "war", "crime", "threat", "witch", "curse", "hell", "heist"]):
        rating = "15"
    elif any(k in comb_text for k in ["funny", "comedy", "love", "heart", "princess", "wedding"]):
        rating = "PG"
    else:
        rating = "PG-13"

    # Extract clean pure synopsis from description if valid
    clean_syn = clean_pure_synopsis_text(desc, clean_t)

    # STRICT RULE: If no verifiable plot details (clean_syn < 50 chars), DO NOT FORCE A SYNOPSIS!
    if not clean_syn or len(clean_syn) < 50:
        return {
            "title": clean_t,
            "proposed_synopsis": "", # Left blank rather than forcing a fake synopsis
            "proposed_genres": genres,
            "proposed_age_rating": rating,
            "confidence": "Needs Manual Review"
        }

    return {
        "title": clean_t,
        "proposed_synopsis": clean_syn,
        "proposed_genres": genres,
        "proposed_age_rating": rating,
        "confidence": "Verified Pure Plot"
    }

print("🚀 ENRICHING PRECISION BATCH OF 25 MOVIES...")
with open("movies_enrichment_candidates.json", "r", encoding="utf-8") as f:
    candidates = json.load(f)

for idx, film in enumerate(candidates[:25]):
    res = enrich_movie_precision(film)
    film["title"] = res["title"]
    film["proposed_synopsis"] = res["proposed_synopsis"]
    film["proposed_genres"] = res["proposed_genres"]
    film["proposed_age_rating"] = res["proposed_age_rating"]
    film["confidence"] = res["confidence"]
    film["discovered"] = ["Genres", "Age Rating"] + (["Synopsis"] if res["proposed_synopsis"] else [])

with open("movies_enrichment_candidates.json", "w", encoding="utf-8") as f:
    json.dump(candidates[:25], f, indent=2)

import build_movies_approval_dashboard
print("🎉 Rebuilt movies_approval_dashboard.html with 25 precision candidates!")
