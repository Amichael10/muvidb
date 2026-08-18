import os
import sys
import json
import re
from scrapling import Fetcher
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local")

url = "https://www.imdb.com/name/nm18080070/"

PROXY_USER = os.getenv("SMARTPROXY_USER", "smart-n84gqsupfojn")
PROXY_PASS = os.getenv("SMARTPROXY_PASS", "cumaxLcBt96dj0Wp")
PROXY_HOST = os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net")
PROXY_PORT = os.getenv("SMARTPROXY_PORT", "3120")
proxy_str = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"

print(f"Fetching {url} using SmartProxy...")

try:
    fetcher = Fetcher(proxy=proxy_str)
    page = fetcher.get(url)
    print(f"Page fetched. Status code: {page.status}")
    
    # Save text for inspection
    with open("scripts/laura_imdb_scrapling.html", "w", encoding="utf-8") as f:
        f.write(page.text)

    # Extract JSON-LD or Next Data
    match = re.search(r'<script type="application/json" id="__NEXT_DATA__">(.*?)</script>', page.text, re.DOTALL)
    if match:
        data = json.loads(match.group(1))
        print("✅ Extracted __NEXT_DATA__ JSON successfully!")
        with open("scripts/laura_imdb_nextdata.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    else:
        print("Searching JSON-LD...")
        json_lds = re.findall(r'<script type="application/ld\+json">(.*?)</script>', page.text, re.DOTALL)
        for i, jld in enumerate(json_lds):
            print(f"JSON-LD {i}: {jld[:500]}")

except Exception as e:
    print(f"Error: {e}")
