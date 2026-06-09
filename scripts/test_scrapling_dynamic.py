import os
import time
from scrapling import StealthyFetcher
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
load_dotenv(dotenv_path=dotenv_path)

SMARTPROXY_USER = os.environ.get('SMARTPROXY_USER')
SMARTPROXY_PASS = os.environ.get('SMARTPROXY_PASS')
SMARTPROXY_HOST = os.environ.get('SMARTPROXY_HOST', 'proxy.smartproxy.net')
SMARTPROXY_PORT = os.environ.get('SMARTPROXY_PORT', '3120')

PROXY = {
    "server": f"http://{SMARTPROXY_HOST}:{SMARTPROXY_PORT}",
    "username": SMARTPROXY_USER,
    "password": SMARTPROXY_PASS
}

def main():
    print("Starting StealthyFetcher...")
    try:
        # headless=True is default, but lets be explicit
        fetcher = StealthyFetcher(headless=True)
        url = "https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score"
        print(f"Navigating to {url}")
        
        # Scrapling StealthyFetcher passes proxies slightly differently sometimes
        # Let's try passing it to the browser config or the get method
        page = fetcher.get(url, proxy=f"http://{SMARTPROXY_USER}:{SMARTPROXY_PASS}@{SMARTPROXY_HOST}:{SMARTPROXY_PORT}")
        
        # Wait for films to load
        print("Waiting for network idle...")
        # Actually in Scrapling stealthy fetcher, wait_for_selector is available on the page object
        # page.page is the playwright page
        if hasattr(page, 'page'):
            page.page.wait_for_selector('a[href^="/en/films/"]', timeout=15000)
            
        links = page.css('a[href^="/en/films/"]')
        print(f"Found {len(links)} film links.")
        
        for link in links[:5]:
            print(link.attrib.get('href'))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
