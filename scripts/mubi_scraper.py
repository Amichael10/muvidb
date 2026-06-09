import os
import time
import json
import re
from scrapling import Fetcher
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
load_dotenv(dotenv_path=dotenv_path)

SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase environment variables not found.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Use smartproxy credentials from .env.local
SMARTPROXY_USER = os.environ.get('SMARTPROXY_USER')
SMARTPROXY_PASS = os.environ.get('SMARTPROXY_PASS')
SMARTPROXY_HOST = os.environ.get('SMARTPROXY_HOST', 'proxy.smartproxy.net')
SMARTPROXY_PORT = os.environ.get('SMARTPROXY_PORT', '3120')
PROXY = f"http://{SMARTPROXY_USER}:{SMARTPROXY_PASS}@{SMARTPROXY_HOST}:{SMARTPROXY_PORT}"

def make_slug(title: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')

def upsert_film(film_data: dict) -> dict:
    title = film_data.get('title')
    slug = make_slug(title) if title else None
    
    if not title or not slug:
        return {'action': 'error', 'error': 'No title'}

    # Find existing
    response = supabase.table('films').select('id').ilike('title', title).maybe_single().execute()
    existing = response.data

    payload = {
        'title': title,
        'synopsis': film_data.get('synopsis'),
        'poster_url': film_data.get('poster_url'),
        'year': film_data.get('year'),
        'countries': ['NG'], # Hardcoded as we are targeting Nollywood
        'is_nollywood': True,
        'genres': film_data.get('genres'),
        'mubi_slug': slug,
        'slug': slug
    }

    # Remove Nones
    payload = {k: v for k, v in payload.items() if v is not None}

    if existing:
        supabase.table('films').update(payload).eq('id', existing['id']).execute()
        return {'action': 'enriched', 'id': existing['id']}
    else:
        try:
            inserted = supabase.table('films').insert(payload).execute()
            return {'action': 'inserted', 'id': inserted.data[0]['id']}
        except Exception as e:
            return {'action': 'error', 'error': str(e)}

def main():
    print("Initializing MUBI Nollywood Scraper with Scrapling + SmartProxy...")
    fetcher = Fetcher(auto_match=False)
    
    base_url = "https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score"
    print(f"Navigating to {base_url}")
    
    page = fetcher.get(base_url, proxy=PROXY)
    
    with open("mubi_debug.html", "w", encoding="utf-8") as f:
        f.write(page.text)
    
    film_links = page.css('a[href^="/en/films/"]')
    urls = []
    for link in film_links:
        href = link.attrib.get('href')
        if href and href not in urls:
            urls.append(href)
            
    print(f"Found {len(urls)} movies on the page.")
    
    stats = {'inserted': 0, 'enriched': 0, 'errors': 0}
    
    for url in urls:
        full_url = f"https://mubi.com{url}"
        print(f"Fetching {full_url}...")
        
        try:
            detail_page = fetcher.get(full_url, proxy=PROXY)
            # Give it a second to render
            time.sleep(2)
            
            # Use Next.js JSON data instead of pure DOM scraping if available
            next_data_script = detail_page.css_first('#__NEXT_DATA__')
            
            if next_data_script:
                data = json.loads(next_data_script.text)
                # Parse MUBI's JSON payload to extract robust details
                # structure: props -> pageProps -> film (usually)
                try:
                    film_info = data['props']['pageProps']['initialState']['film']['film']
                    title = film_info.get('title')
                    synopsis = film_info.get('synopsis') or film_info.get('editorial_synopsis')
                    year = film_info.get('year')
                    poster_url = film_info.get('still_url') or film_info.get('promoted_still_url')
                    
                    duration = film_info.get('duration') # Need to map correctly if MUBI uses a different key
                    
                    film_data = {
                        'title': title,
                        'synopsis': synopsis,
                        'year': year,
                        'duration': duration,
                        'poster_url': poster_url,
                        'genres': None # Can parse if available in the JSON
                    }
                    
                    res = upsert_film(film_data)
                    print(f"  -> {title}: {res['action']}")
                    stats[res['action']] += 1
                except KeyError:
                    print("  -> Could not parse __NEXT_DATA__ structure")
                    stats['errors'] += 1
            else:
                # Fallback DOM scraping
                title_el = detail_page.css_first('h1')
                title = title_el.text.strip() if title_el else None
                
                if not title:
                    print("  -> No title found, skipping")
                    stats['errors'] += 1
                    continue
                    
                synopsis_el = detail_page.css_first('.film-show__synopsis')
                synopsis = synopsis_el.text.strip() if synopsis_el else None
                
                poster_el = detail_page.css_first('meta[property="og:image"]')
                poster_url = poster_el.attrib.get('content') if poster_el else None
                
                film_data = {
                    'title': title,
                    'synopsis': synopsis,
                    'year': None,
                    'duration': None,
                    'poster_url': poster_url,
                    'genres': None
                }
                
                res = upsert_film(film_data)
                print(f"  -> {title}: {res['action']}")
                stats[res['action']] += 1
                
        except Exception as e:
            print(f"  -> Error fetching {url}: {e}")
            stats['errors'] += 1
            
        time.sleep(2) # be polite

    print("\nMUBI Scrape Complete!")
    print(f"Inserted: {stats['inserted']}")
    print(f"Enriched: {stats['enriched']}")
    print(f"Errors: {stats['errors']}")

if __name__ == "__main__":
    main()
