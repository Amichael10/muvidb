import asyncio
import os
import re
import json
from scrapling import StealthyFetcher
from supabase import create_client

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Loading .env.local")
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

PROXY = "http://sp1j6x1qnt:G741N3s54rP2P3p20o@gate.smartproxy.com:7000"

def make_slug(title):
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    return slug

def upsert_film(film_data):
    if not film_data.get('title'):
        return None
    slug = make_slug(film_data['title'])
    payload = {
        "title": film_data['title'],
        "synopsis": film_data.get('synopsis'),
        "poster_url": film_data.get('poster_url'),
        "year": film_data.get('year'),
        "duration": film_data.get('duration'),
        "genres": film_data.get('genres', []),
        "countries": ["NG"],
        "is_nollywood": True,
        "mubi_slug": slug,
        "slug": slug
    }
    
    # Remove None values
    payload = {k: v for k, v in payload.items() if v is not None}
    
    existing = supabase.table('films').select('id').ilike('title', payload['title']).execute()
    if existing.data:
        res = supabase.table('films').update(payload).eq('id', existing.data[0]['id']).execute()
        return "enriched"
    else:
        res = supabase.table('films').insert(payload).execute()
        return "inserted"

async def main():
    print("🚀 Starting MUBI Scraper with Scrapling StealthyFetcher (Playwright)...")
    url = "https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score"
    
    # We use StealthyFetcher which launches Playwright, passes Datadome, and evaluates JS
    # Smartproxy requires proxy dict in Playwright format:
    proxy_config = {
        "server": "http://gate.smartproxy.com:7000",
        "username": "sp1j6x1qnt",
        "password": "G741N3s54rP2P3p20o"
    }

    fetcher = StealthyFetcher(headless=True, proxy=proxy_config)
    
    try:
        page = fetcher.get(url)
        print("Page loaded! Waiting for films to render...")
        
        # Scrapling page object allows waiting
        page.playwright_page.wait_for_selector('.film-tile__link', timeout=15000)
        
        links = page.playwright_page.locator('.film-tile__link').all()
        film_urls = []
        for l in links:
            href = l.get_attribute('href')
            if href:
                film_urls.append("https://mubi.com" + href)
                
        print(f"✅ Found {len(film_urls)} films!")
        
        for f_url in film_urls:
            print(f"Fetching {f_url}...")
            f_page = fetcher.get(f_url)
            f_page.playwright_page.wait_for_load_state('networkidle')
            
            title = f_page.playwright_page.locator('h1').first.inner_text() if f_page.playwright_page.locator('h1').count() > 0 else None
            synopsis = f_page.playwright_page.locator('.film-show__synopsis').first.inner_text() if f_page.playwright_page.locator('.film-show__synopsis').count() > 0 else None
            
            year = None
            year_loc = f_page.playwright_page.locator('.film-show__year')
            if year_loc.count() > 0:
                try:
                    year = int(year_loc.first.inner_text())
                except:
                    pass
            
            poster = None
            poster_meta = f_page.playwright_page.locator('meta[property="og:image"]')
            if poster_meta.count() > 0:
                poster = poster_meta.first.get_attribute('content')
                
            duration = None
            dur_loc = f_page.playwright_page.locator('.film-show__duration')
            if dur_loc.count() > 0:
                text = dur_loc.first.inner_text()
                match = re.search(r'(\d+)\s*mins', text)
                if match:
                    duration = int(match.group(1))
                    
            print(f" -> {title}")
            if title:
                action = upsert_film({
                    'title': title,
                    'synopsis': synopsis,
                    'year': year,
                    'poster_url': poster,
                    'duration': duration,
                    'genres': []
                })
                print(f"   Status: {action}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        fetcher.close()

if __name__ == "__main__":
    asyncio.run(main())
