import urllib.request
import json
import re

url = 'https://www.imdb.com/name/nm18080070/'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9'}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        print(f"Page fetched successfully ({len(html)} bytes).")
        
        # Save HTML for inspection
        with open('scripts/laura_imdb.html', 'w', encoding='utf-8') as f:
            f.write(html)
            
        match = re.search(r'<script type="application/json" id="__NEXT_DATA__">(.*?)</script>', html, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
            print("Extracted __NEXT_DATA__ JSON.")
            with open('scripts/laura_imdb_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
        else:
            print("No __NEXT_DATA__ found. Searching JSON-LD...")
            json_lds = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
            for i, jld in enumerate(json_lds):
                print(f"JSON-LD {i}: {jld[:300]}...")
except Exception as e:
    print(f"Error fetching page: {e}")
