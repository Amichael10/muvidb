import requests
import json
import re

PROXY = "http://sp1j6x1qnt:G741N3s54rP2P3p20o@gate.smartproxy.com:7000"
proxies = {
    "http": PROXY,
    "https": PROXY,
}

url = "https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
print(f"Fetching {url} via proxy...")
try:
    response = requests.get(url, proxies=proxies, headers=headers, timeout=15)
    print(f"Status Code: {response.status_code}")
    if "__NEXT_DATA__" in response.text:
        print("Found __NEXT_DATA__ in response!")
        # Extract title from text just to check
        match = re.search(r'<title>(.*?)</title>', response.text)
        if match:
            print("Title:", match.group(1))
    else:
        print("No __NEXT_DATA__ found. Cloudflare might have blocked it.")
except Exception as e:
    print(f"Error: {e}")
