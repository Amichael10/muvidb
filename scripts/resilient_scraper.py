import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import json
import re
import time
import requests
from bs4 import BeautifulSoup

sitemap_path = r"C:\Users\User\.gemini\antigravity\brain\3608c7a3-6ac6-40c8-9e37-f3bc44e75f57\scratch\sitemap.xml"
with open(sitemap_path, "r", encoding="utf-8") as f:
    sitemap_xml = f.read()

urls = re.findall(r"<loc>(https://www\.itsawrapng\.com/post/[^<]+)</loc>", sitemap_xml)
urls = list(dict.fromkeys(urls)) # unique

out_file = r"C:\Users\User\.gemini\antigravity\brain\3608c7a3-6ac6-40c8-9e37-f3bc44e75f57\scratch\all_dami_articles.json"
articles_by_url = {}
if os.path.exists(out_file):
    try:
        with open(out_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
            for a in existing:
                if a.get('url'):
                    articles_by_url[a['url']] = a
    except Exception:
        pass

print(f"Total URLs to check: {len(urls)} | Already scraped: {len(articles_by_url)}", flush=True)

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive'
})

for idx, url in enumerate(urls):
    if url in articles_by_url and articles_by_url[url].get('headline') and len(articles_by_url[url].get('paragraphs', [])) > 0:
        print(f"[{idx+1}/{len(urls)}] Cached: {articles_by_url[url]['headline'][:50]}", flush=True)
        continue

    print(f"[{idx+1}/{len(urls)}] Scraping {url}...", flush=True)
    success = False
    for attempt in range(3):
        try:
            res = session.get(url, timeout=20)
            if res.status_code == 200:
                html = res.text
                soup = BeautifulSoup(html, 'html.parser')

                json_ld_data = {}
                for s in soup.find_all('script', type='application/ld+json'):
                    try:
                        data = json.loads(s.string or '{}')
                        if data.get('@type') in ['BlogPosting', 'Article', 'NewsArticle']:
                            json_ld_data = data
                            break
                    except Exception:
                        pass

                headline = json_ld_data.get('headline') or ''
                description = json_ld_data.get('description') or ''
                date_published = json_ld_data.get('datePublished') or ''
                
                author = 'Dami Dawson'
                if isinstance(json_ld_data.get('author'), dict):
                    author = json_ld_data['author'].get('name', author)
                elif isinstance(json_ld_data.get('author'), list) and json_ld_data['author']:
                    author = json_ld_data['author'][0].get('name', author)

                if not headline:
                    og_title = soup.find('meta', property='og:title')
                    headline = og_title['content'] if og_title else ''
                if not description:
                    og_desc = soup.find('meta', property='og:description')
                    description = og_desc['content'] if og_desc else ''

                og_img = soup.find('meta', property='og:image')
                image_url = ''
                if isinstance(json_ld_data.get('image'), dict):
                    image_url = json_ld_data['image'].get('url', '')
                elif isinstance(json_ld_data.get('image'), str):
                    image_url = json_ld_data.get('image', '')
                elif og_img:
                    image_url = og_img.get('content', '')

                paragraphs = []
                for p in soup.find_all('p'):
                    t = p.get_text().strip()
                    if len(t) > 25 and not any(k in t.lower() for k in ['cookie', 'wix.com', 'subscribe to our mailing', 'all rights reserved']):
                        if t not in paragraphs:
                            paragraphs.append(t)

                article_obj = {
                    'url': url,
                    'headline': headline,
                    'description': description,
                    'date_published': date_published,
                    'author': author,
                    'image_url': image_url,
                    'paragraphs': paragraphs
                }
                articles_by_url[url] = article_obj
                print(f"    OK -> {headline[:60]} ({len(paragraphs)} paras)", flush=True)
                success = True
                break
            else:
                print(f"    Attempt {attempt+1} HTTP {res.status_code}", flush=True)
        except Exception as e:
            print(f"    Attempt {attempt+1} error: {e}", flush=True)
            time.sleep(1)

    # Save incremental snapshot
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(list(articles_by_url.values()), f, indent=2, ensure_ascii=False)

    time.sleep(0.5)

print(f"\nCompleted! Total scraped: {len(articles_by_url)} saved to {out_file}", flush=True)
