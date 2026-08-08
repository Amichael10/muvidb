import urllib.request
import urllib.parse
import re

query = 'site:imdb.com/name/nm5392468'
url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)

req = urllib.request.Request(
    url,
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        links = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        titles = re.findall(r'<a class="result__a"[^>]*>(.*?)</a>', html, re.DOTALL)
        print('TITLES:', titles)
        print('SNIPPETS:', links)
except Exception as e:
    print('ERROR:', e)
