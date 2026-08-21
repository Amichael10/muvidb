import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3000")
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "test_artifacts", "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

PAGES = [
    ("/", "Home"),
    ("/browse", "Browse"),
    ("/films/anikulapo", "FilmDetail_Movie"),
    ("/films/anikulapo-rise-of-the-spectre", "FilmDetail_Series"),
    ("/people/kunle-remi", "PersonDetail"),
    ("/search?q=Anikulapo", "Search"),
    ("/tv-shows", "TVShows"),
    ("/watch/netflix", "Watch_Netflix"),
    ("/cinemas", "Cinemas"),
    ("/plays", "Theatre"),
    ("/awards", "Awards"),
    ("/critics", "Critics"),
    ("/claim", "Claim"),
    ("/login", "Login"),
    ("/signup", "Signup")
]

DEVICES = [
    ("Desktop_FHD", 1920, 1080, False),
    ("MacBook_14", 1440, 900, False),
    ("iPad_Tablet", 768, 1024, True),
    ("iPhone_15_Pro", 393, 852, True),
    ("Compact_Android", 360, 780, True)
]

def main():
    print(f"=== Starting Fast E2E Audit on {BASE_URL} ===", flush=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-proxy-server', '--disable-gpu'])
        
        for dev_name, width, height, is_mobile in DEVICES:
            print(f"\n--- Testing Device: {dev_name} ({width}x{height}) ---", flush=True)
            context = browser.new_context(
                viewport={"width": width, "height": height},
                is_mobile=is_mobile,
                has_touch=is_mobile
            )
            page = context.new_page()
            
            for path, name in PAGES:
                url = f"{BASE_URL}{path}"
                t0 = time.time()
                try:
                    res = page.goto(url, wait_until="commit", timeout=25000)
                    page.wait_for_timeout(500)
                    duration_ms = int((time.time() - t0) * 1000)
                    
                    # Check horizontal overflow
                    is_overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 2")
                    
                    # Save screenshot
                    img_name = f"{name}_{dev_name}.png"
                    img_path = os.path.join(SCREENSHOTS_DIR, img_name)
                    page.screenshot(path=img_path, full_page=False)
                    
                    status_flag = "⚠️ OVERFLOW" if is_overflow else "✓ OK"
                    print(f"  [{status_flag}] {name:20} -> {duration_ms}ms ({res.status if res else 'N/A'}) -> {img_name}", flush=True)
                    
                except Exception as e:
                    print(f"  ❌ FAIL {name:20} -> Error: {e}", flush=True)
            
            context.close()
        
        browser.close()
        print("\n=== Fast E2E Audit Complete! ===", flush=True)

if __name__ == "__main__":
    main()
