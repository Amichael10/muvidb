import os
import json
import re
from scrapling import StealthyFetcher

url = "https://www.imdb.com/name/nm18080070/"
print("Fetching IMDb with StealthyFetcher...")

try:
    fetcher = StealthyFetcher()
    page = fetcher.fetch(url)
    print(f"Status Code: {page.status}")
    print(f"Page Title: {page.title}")

    with open("scripts/laura_stealth.html", "w", encoding="utf-8") as f:
        f.write(page.text)

    # Extract JSON-LD
    json_lds = page.css('script[type="application/ld+json"]')
    for i, jld in enumerate(json_lds):
        print(f"JSON-LD {i}: {jld.text}")

    # Extract text from page
    print("\nPage text preview:")
    print(page.text[:1500])

except Exception as e:
    print(f"Error: {e}")
