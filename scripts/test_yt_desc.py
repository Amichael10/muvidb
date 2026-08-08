import urllib.request
import re
import html

def fetch_youtube_description(video_url):
    if not video_url or 'youtube.com' not in video_url and 'youtu.be' not in video_url:
        return None
    try:
        req = urllib.request.Request(video_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        })
        content = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
        
        # Method 1: og:description
        og_match = re.search(r'<meta property="og:description" content="([^"]+)"', content)
        if og_match:
            desc = html.unescape(og_match.group(1))
            if desc and len(desc) > 30 and "Enjoy the videos and music you love" not in desc:
                return desc

        # Method 2: shortDescription in ytInitialData
        sd_match = re.search(r'"shortDescription":"([^"]+)"', content)
        if sd_match:
            desc = sd_match.group(1).encode().decode('unicode-escape', errors='ignore')
            desc = html.unescape(desc)
            if desc and len(desc) > 30:
                return desc

    except Exception as e:
        print(f"Error fetching {video_url}: {e}")
    return None

test_urls = [
    "https://www.youtube.com/watch?v=boFdIPblLu4",
    "https://www.youtube.com/watch?v=0XAN5Qgnr8I",
    "https://www.youtube.com/watch?v=ad_DfJ4S_18"
]

for u in test_urls:
    print(f"\n--- {u} ---")
    desc = fetch_youtube_description(u)
    print(desc[:300] if desc else "No description found.")
