import urllib.request
import re
import json

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

urls = [
    'https://guardian.ng/saturday-magazine/oloketuyi-why-bon-awards-held-against-all-odds/',
    'https://thenationonlineng.net/seun-oloketuyi-to-immortalise-lateef-jakande-in-biopic/',
    'https://leadership.ng/kwara-to-host-16th-best-of-nollywood-bon-awards/',
    'https://theeagleonline.com.ng/veteran-nollywood-actor-tunde-ola-yusuf-is-dead-seun-oloketuyi/',
    'https://tribuneonlineng.com/nollywood-producer-seun-oloketuyi-launches-book/',
    'https://punchng.com/nollywood-actor-tunde-ola-yusuf-is-dead/'
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            og = re.findall(r'<meta[^>]+property=[\'"]og:image[\'"][^>]+content=[\'"]([^\'"]+)[\'"]', html, re.I)
            if not og:
                og = re.findall(r'<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+property=[\'"]og:image[\'"]', html, re.I)
            title = re.findall(r'<title>([^<]+)</title>', html, re.I)
            print("URL:", url)
            print("Title:", title[0] if title else "N/A")
            print("OG Image:", og[0] if og else "None")
            print("---")
    except Exception as e:
        print("Error on", url, e)
