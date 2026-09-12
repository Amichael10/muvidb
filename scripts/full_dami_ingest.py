import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import json
import re
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import dotenv

dotenv.load_dotenv('.env.local')
dotenv.load_dotenv('.env')

supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
tmdb_key = os.getenv('TMDB_API_KEY') or os.getenv('VITE_TMDB_API_KEY')
tmdb_token = os.getenv('TMDB_BEARER_TOKEN') or os.getenv('VITE_TMDB_ACCESS_TOKEN')

# Create resilient session with retries
session = requests.Session()
retries = Retry(total=5, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
session.mount('https://', HTTPAdapter(max_retries=retries))

db_headers = {
    'apikey': supabase_key,
    'Authorization': f'Bearer {supabase_key}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation'
}

tmdb_headers = {'Authorization': f'Bearer {tmdb_token}'} if tmdb_token else {}

CRITIC_ID = 'abe0f198-5b70-47fb-b5e4-b08a93bdef6d'
CRITIC_NAME = 'Dami Dawson'
CRITIC_TITLE = 'Film Critic'
CRITIC_AVATAR = 'https://static.wixstatic.com/media/f87a6d_4dd9e45b448549e1a4b6bfb6251af0d4~mv2.png'

with open(r"C:\Users\User\.gemini\antigravity\brain\3608c7a3-6ac6-40c8-9e37-f3bc44e75f57\scratch\all_dami_articles.json", "r", encoding="utf-8") as f:
    articles = json.load(f)

print(f"Loaded {len(articles)} articles from It's A Wrap Nigeria.")

review_mappings = [
    {
        'url_slug': 'aba-blues-a-beautiful-idea-lost-in-execution',
        'film_search': 'Aba Blues',
        'fallback_year': 2024,
        'rating': 2.5,
        'quote': "In Aba Blues, director Jack’enneth attempts to explore a deeply familiar premise of interrupted love and the lingering weight of what could have been, but its promising emotional core gets lost in narrative execution."
    },
    {
        'url_slug': 'a-father-s-secret-a-familiar-story-told-with-some-intention',
        'film_search': "A Father's Secret",
        'fallback_year': 2024,
        'rating': 3.0,
        'quote': "There is something deceptively simple about A Father’s Secret; it is a familiar domestic tale told with genuine intention, where a good film is hiding right inside a conventional structure."
    },
    {
        'url_slug': 'ordinary-people-extraordinary-overreach-moses-inwang-s-three-hats-couldn-t-hold-the-weight',
        'film_search': 'Ordinary People',
        'fallback_year': 2024,
        'rating': 2.5,
        'quote': "Moses Inwang’s ambitious three-hat juggling act aims high with sprawling dramatic intent, but the sheer thematic overreach strains the narrative weight."
    },
    {
        'url_slug': 'agesinkole-2-a-kingdom-worth-saving-a-story-still-finding-its-feet',
        'film_search': 'Agesinkole 2',
        'film_alt_search': 'King of Thieves',
        'fallback_year': 2024,
        'rating': 3.0,
        'quote': "Agesinkole 2 offers an epic Yoruba kingdom worth saving, though the unfolding sequel narrative takes its time finding its kinetic storytelling feet."
    },
    {
        'url_slug': 'mother-s-love-clear-vision-strong-themes-and-an-execution-that-leaves-room-for-more',
        'film_search': "Mother's Love",
        'fallback_year': 2024,
        'rating': 3.0,
        'quote': "Mother's Love brings a clear directorial vision and strong emotional themes, delivering earnest performances while leaving room for sharper dramatic execution."
    },
    {
        'url_slug': 'behind-the-scenes-a-beautifully-layered-drama-that-needed-sharper-consequences',
        'film_search': 'Behind the Scenes',
        'fallback_year': 2024,
        'rating': 3.5,
        'quote': "A beautifully layered industry drama that navigates the intricate nuances of filmmaking life, only yearning for sharper narrative consequences in its final act."
    },
    {
        'url_slug': 'mothers-of-chibok-the-story-we-moved-on-from-but-they-never-did',
        'film_search': 'Mothers of Chibok',
        'fallback_year': 2024,
        'rating': 4.0,
        'quote': "A profoundly moving and unflinching documentary account that forces audiences to confront the enduring human grief and resilience of families who could never simply move on."
    },
    {
        'url_slug': 'alive-till-dawn-bold-necessary-but-still-finding-its-horror-voice',
        'film_search': 'Alive Till Dawn',
        'fallback_year': 2024,
        'rating': 3.0,
        'quote': "A bold and necessary venture into Nollywood horror territory, packed with atmospheric ambition while continuing to hone its distinctive genre voice."
    },
    {
        'url_slug': 'the-boy-who-gave-is-a-bold-exercise-in-patient-storytelling',
        'film_search': 'The Boy Who Gave',
        'fallback_year': 2024,
        'rating': 3.5,
        'quote': "A refreshing, patient exercise in contemplative cinema that trusts its audience and lets character interiority drive its quiet emotional power."
    },
    {
        'url_slug': 'evi-when-ambition-meets-authenticity-and-landed-fairly-well',
        'film_search': 'Evi',
        'fallback_year': 2024,
        'rating': 3.5,
        'quote': "When raw ambition meets cultural authenticity, Evi strikes an earnest chord, landing its story with grounded performances and evocative direction."
    },
    {
        'url_slug': 'headless-a-bold-nollywood-thriller-that-couldn-t-hold-it-s-nerve',
        'film_search': 'Headless',
        'fallback_year': 2024,
        'rating': 2.5,
        'quote': "Headless bursts out of the gate as a stylish, high-stakes thriller, but struggles to sustain its narrative tension and hold its nerve through the climax."
    },
    {
        'url_slug': 'the-return-of-arinzo-a-sequel-that-came-back-without-its-soul',
        'film_search': 'The Return of Arinzo',
        'film_alt_search': 'Arinzo',
        'fallback_year': 2024,
        'rating': 2.0,
        'quote': "The Return of Arinzo revives a recognizable world but returns without the visceral tension and authentic soul that made the original compelling."
    },
    {
        'url_slug': 'the-return-of-omotara-johnson-a-franchise-that-forgot-how-to-be-dangerous',
        'film_search': 'The Return of Omotara Johnson',
        'film_alt_search': 'Omotara Johnson',
        'fallback_year': 2024,
        'rating': 2.5,
        'quote': "Bukky Wright's return revives a storied classic persona, yet feels softened around the edges, forgetting the danger and bite that originally defined the franchise."
    },
    {
        'url_slug': 'why-you-should-see-to-adaego-with-love',
        'film_search': 'To Adaego With Love',
        'fallback_year': 2024,
        'rating': 3.5,
        'quote': "A heartfelt romantic drama exploring forgiveness and relationship intricacies, marked by genuine chemistry and honest writing."
    },
    {
        'url_slug': 'mercy-aigbe-s-everything-is-new-again-lacked-all-the-emotions',
        'film_search': 'Everything Is New Again',
        'fallback_year': 2024,
        'rating': 2.0,
        'quote': "Despite an ensemble cast and glossy production values, Everything Is New Again misses the vital emotional depth and connective tissue required of its melodrama."
    },
    {
        'url_slug': 'niyi-akinmolayan-s-colours-of-fire-a-visually-ambitious-narratively-uneven-foray',
        'film_search': 'Colours of Fire',
        'fallback_year': 2024,
        'rating': 3.0,
        'quote': "Niyi Akinmolayan crafts a visually arresting spectacle with bold production design, even if its narrative pacing proves uneven across its expansive runtime."
    },
    {
        'url_slug': 'drenched-in-survival-onobiren-and-the-quiet-violence-of-becoming',
        'film_search': 'Onobiren',
        'film_alt_search': "Onobiren: A Woman's Story",
        'fallback_year': 2024,
        'rating': 3.5,
        'quote': "Drenched in survival instincts, Onobiren unpacks the quiet societal pressures on womanhood with tender, grounded nuance and commendable conviction."
    },
    {
        'url_slug': 'a-fairytale-still-needs-logic-the-beauty-and-frustration-of-call-of-my-life',
        'film_search': 'The Call of My Life',
        'film_alt_search': 'Call of My Life',
        'fallback_year': 2024,
        'rating': 3.0,
        'quote': "Blessing Uzzi’s Call of My Life exhibits undeniable visual charm and fairy-tale romance, though its dramatic credibility occasionally stumbles over internal logic."
    },
    {
        'url_slug': 'the-shadow-that-belongs-to-everyone-why-my-father-s-shadow-is-the-most-important-nigerian-film-of-t',
        'film_search': "My Father's Shadow",
        'fallback_year': 2024,
        'rating': 4.0,
        'quote': "A remarkable, vital piece of Nigerian cinema that explores familial fracture and legacy with unmatched emotional poignancy and directorial clarity."
    },
    {
        'url_slug': 'timiniegbuson',
        'film_search': 'Love and New Notes',
        'film_alt_search': 'Love & New Notes',
        'fallback_year': 2024,
        'rating': 3.5,
        'quote': "Timini Egbuson anchors Love & New Notes with charismatic flair, infusing the contemporary romantic drama with infectious energy and stylish charm."
    },
    {
        'url_slug': 'four-years-later-blood-sisters-returned-without-its-greatest-strength',
        'film_search': 'Blood Sisters',
        'fallback_year': 2022,
        'rating': 3.0,
        'quote': "Returning to the pulse-pounding world of Blood Sisters reveals the enduring appeal of its high-stakes premise, even when navigating the absence of its original pacing tightrope."
    },
    {
        'url_slug': 'netflix-wanted-more-anikulapo-the-story-may-not-have-needed-it',
        'film_search': 'Anikulapo',
        'film_alt_search': 'Anikulapo: Rise of the Spectre',
        'fallback_year': 2022,
        'rating': 3.0,
        'quote': "Kunle Afolayan’s mystical world remains visually alluring and steeped in cultural folklore, even when stretching the mythic scope across serialized television."
    }
]

def search_supabase_film(title):
    try:
        # Exact match
        res = session.get(f"{supabase_url}/rest/v1/films", params={'title': f'eq.{title}', 'select': 'id,title,slug,poster_url,year'}, headers=db_headers, timeout=10)
        if res.status_code == 200 and res.json():
            return res.json()[0]
        
        # ILIKE match
        res_ilike = session.get(f"{supabase_url}/rest/v1/films", params={'title': f'ilike.{title}', 'select': 'id,title,slug,poster_url,year'}, headers=db_headers, timeout=10)
        if res_ilike.status_code == 200 and res_ilike.json():
            return res_ilike.json()[0]

        # Slug match
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        res_slug = session.get(f"{supabase_url}/rest/v1/films", params={'slug': f'eq.{slug}', 'select': 'id,title,slug,poster_url,year'}, headers=db_headers, timeout=10)
        if res_slug.status_code == 200 and res_slug.json():
            return res_slug.json()[0]

        # Contains pattern
        res_cont = session.get(f"{supabase_url}/rest/v1/films", params={'title': f'ilike.*{title}*', 'select': 'id,title,slug,poster_url,year', 'limit': '1'}, headers=db_headers, timeout=10)
        if res_cont.status_code == 200 and res_cont.json():
            return res_cont.json()[0]

    except Exception as e:
        print(f"  DB search error: {e}")
    return None

def fetch_tmdb_movie(title):
    params = {'query': title}
    if not tmdb_token and tmdb_key:
        params['api_key'] = tmdb_key
    
    try:
        res = session.get('https://api.themoviedb.org/3/search/movie', headers=tmdb_headers, params=params, timeout=10)
        if res.status_code == 200:
            results = res.json().get('results', [])
            if results:
                m = results[0]
                movie_id = m['id']
                det_res = session.get(f'https://api.themoviedb.org/3/movie/{movie_id}', headers=tmdb_headers, params={'api_key': tmdb_key} if not tmdb_token else {}, timeout=10)
                det = det_res.json() if det_res.status_code == 200 else m
                return det
    except Exception as e:
        print(f"  TMDB error for '{title}': {e}")
    return None

def create_film_in_supabase(title, tmdb_data, fallback_year, fallback_poster, fallback_desc):
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    
    poster_url = None
    if tmdb_data and tmdb_data.get('poster_path'):
        poster_url = f"https://image.tmdb.org/t/p/w500{tmdb_data['poster_path']}"
    elif fallback_poster:
        poster_url = fallback_poster

    backdrop_url = None
    if tmdb_data and tmdb_data.get('backdrop_path'):
        backdrop_url = f"https://image.tmdb.org/t/p/original{tmdb_data['backdrop_path']}"

    synopsis = None
    if tmdb_data and tmdb_data.get('overview'):
        synopsis = tmdb_data['overview']
    elif fallback_desc:
        synopsis = fallback_desc

    year = fallback_year
    if tmdb_data and tmdb_data.get('release_date'):
        try:
            year = int(tmdb_data['release_date'][:4])
        except Exception:
            pass

    genres = []
    if tmdb_data and tmdb_data.get('genres'):
        genres = [g['name'] for g in tmdb_data['genres']]

    runtime = tmdb_data.get('runtime') if tmdb_data else None

    payload = {
        'title': title,
        'slug': slug,
        'year': year,
        'synopsis': synopsis,
        'poster_url': poster_url,
        'backdrop_url': backdrop_url,
        'genres': genres,
        'runtime_minutes': runtime,
        'tmdb_id': str(tmdb_data['id']) if tmdb_data and tmdb_data.get('id') else None,
        'tmdb_rating': tmdb_data.get('vote_average') if tmdb_data else None,
        'is_nollywood': True,
        'is_published': True,
        'language': 'English'
    }

    try:
        res = session.post(f"{supabase_url}/rest/v1/films", json=payload, headers=db_headers, timeout=10)
        if res.status_code in [200, 201]:
            created = res.json()
            print(f"  ✨ Created full film in DB: '{title}' (ID: {created[0]['id']})")
            return created[0]
        else:
            print(f"  ❌ Error creating film '{title}': {res.status_code} {res.text}")
    except Exception as e:
        print(f"  ❌ Exception creating film: {e}")
    return None

ingested_count = 0
articles_by_slug = {a['url'].split('/')[-1]: a for a in articles}

print("\n========================================================")
print("🚀 STARTING DAMI DAWSON CRITIC REVIEWS INGESTION PIPELINE")
print("========================================================\n")

results_summary = []

for m in review_mappings:
    slug = m['url_slug']
    article = articles_by_slug.get(slug)
    full_url = article['url'] if article else f"https://www.itsawrapng.com/post/{slug}"
    
    print(f"\n🎬 Processing Review: '{m['film_search']}'")
    print(f"   URL: {full_url}")

    # 1. Look up film in Supabase
    film = search_supabase_film(m['film_search'])
    if not film and m.get('film_alt_search'):
        film = search_supabase_film(m['film_alt_search'])

    if film:
        print(f"   ✅ Matched existing Film in DB: '{film['title']}' (ID: {film['id']}, Year: {film.get('year')})")
    else:
        print(f"   ⚡ Film not in DB. Searching TMDB for full hydration...")
        tmdb_data = fetch_tmdb_movie(m['film_search'])
        if not tmdb_data and m.get('film_alt_search'):
            tmdb_data = fetch_tmdb_movie(m['film_alt_search'])
        
        fallback_poster = article.get('image_url') if article else None
        fallback_desc = article.get('description') if article else None
        
        film = create_film_in_supabase(
            m['film_search'], 
            tmdb_data, 
            m.get('fallback_year', 2024), 
            fallback_poster, 
            fallback_desc
        )

    if not film or not film.get('id'):
        print(f"   ⚠️ Could not resolve or create film record for '{m['film_search']}'. Skipping review.")
        continue

    film_id = film['id']
    review_url = full_url

    # Check if review already exists for this film_id + critic_id
    chk_res = session.get(f"{supabase_url}/rest/v1/critic_reviews", params={'film_id': f'eq.{film_id}', 'critic_id': f'eq.{CRITIC_ID}'}, headers=db_headers, timeout=10)
    existing_rev = chk_res.json() if chk_res.status_code == 200 else []

    review_payload = {
        'film_id': film_id,
        'critic_id': CRITIC_ID,
        'critic_name': CRITIC_NAME,
        'critic_title': CRITIC_TITLE,
        'avatar_url': CRITIC_AVATAR,
        'quote': m['quote'],
        'rating': m['rating'],
        'review_url': review_url,
        'is_featured': True,
        'is_anonymous': False
    }

    status_str = ""
    if existing_rev:
        rev_id = existing_rev[0]['id']
        up_res = session.patch(f"{supabase_url}/rest/v1/critic_reviews", params={'id': f'eq.{rev_id}'}, json=review_payload, headers=db_headers, timeout=10)
        if up_res.status_code in [200, 204]:
            print(f"   🔄 Updated existing review for film '{film['title']}' ({m['rating']}★)")
            ingested_count += 1
            status_str = "Updated"
        else:
            print(f"   ❌ Error updating review: {up_res.status_code} {up_res.text}")
    else:
        ins_res = session.post(f"{supabase_url}/rest/v1/critic_reviews", json=review_payload, headers=db_headers, timeout=10)
        if ins_res.status_code in [200, 201]:
            print(f"   🌟 Successfully inserted new review for film '{film['title']}' ({m['rating']}★)")
            ingested_count += 1
            status_str = "Inserted"
        else:
            print(f"   ❌ Error inserting review: {ins_res.status_code} {ins_res.text}")

    if status_str:
        results_summary.append({
            'film_title': film['title'],
            'film_id': film['id'],
            'rating': m['rating'],
            'quote': m['quote'],
            'url': review_url,
            'status': status_str
        })
    time.sleep(0.2)

print(f"\n========================================================")
print(f"🎉 INGESTION COMPLETE: {ingested_count} / {len(review_mappings)} Dami Dawson film reviews successfully stored in DB!")
print(f"========================================================")

out_summary = r"C:\Users\User\.gemini\antigravity\brain\3608c7a3-6ac6-40c8-9e37-f3bc44e75f57\scratch\dami_dawson_ingested_reviews.json"
with open(out_summary, "w", encoding="utf-8") as f:
    json.dump(results_summary, f, indent=2, ensure_ascii=False)
print(f"Saved ingestion report to {out_summary}")
