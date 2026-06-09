import asyncio
import os
import re
from playwright.async_api import async_playwright
from supabase import create_client

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    
    payload = {k: v for k, v in payload.items() if v is not None}
    
    existing = supabase.table('films').select('id').ilike('title', payload['title']).execute()
    if existing.data:
        res = supabase.table('films').update(payload).eq('id', existing.data[0]['id']).execute()
        return "enriched"
    else:
        res = supabase.table('films').insert(payload).execute()
        return "inserted"

async def main():
    print("🚀 Starting MUBI Scraper with pure Playwright + Smartproxy...")
    url = "https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            proxy={
                "server": "http://gate.smartproxy.com:7000",
                "username": "sp1j6x1qnt",
                "password": "G741N3s54rP2P3p20o"
            }
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        try:
            print(f"Navigating to {url}...")
            await page.goto(url, wait_until="networkidle", timeout=60000)
            
            # Check for Datadome
            title = await page.title()
            if "Just a moment" in title or "Access Denied" in title:
                print("🚨 Blocked by Datadome/Cloudflare. Captcha required!")
                await browser.close()
                return

            print("Page loaded! Waiting for films to render...")
            await page.wait_for_selector('.film-tile__link', timeout=15000)
            
            links = await page.locator('.film-tile__link').all()
            film_urls = []
            for l in links:
                href = await l.get_attribute('href')
                if href:
                    film_urls.append("https://mubi.com" + href)
                    
            print(f"✅ Found {len(film_urls)} films!")
            
            for f_url in film_urls:
                print(f"Fetching {f_url}...")
                f_page = await context.new_page()
                try:
                    await f_page.goto(f_url, wait_until="domcontentloaded", timeout=30000)
                    
                    title = await f_page.locator('h1').first.inner_text() if await f_page.locator('h1').count() > 0 else None
                    synopsis = await f_page.locator('.film-show__synopsis').first.inner_text() if await f_page.locator('.film-show__synopsis').count() > 0 else None
                    
                    year = None
                    if await f_page.locator('.film-show__year').count() > 0:
                        try:
                            year = int(await f_page.locator('.film-show__year').first.inner_text())
                        except:
                            pass
                    
                    poster = None
                    if await f_page.locator('meta[property="og:image"]').count() > 0:
                        poster = await f_page.locator('meta[property="og:image"]').first.get_attribute('content')
                        
                    duration = None
                    if await f_page.locator('.film-show__duration').count() > 0:
                        text = await f_page.locator('.film-show__duration').first.inner_text()
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
                    print(f"Error on {f_url}: {e}")
                finally:
                    await f_page.close()
                    
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
