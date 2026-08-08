import urllib.request
import re
import json

url = 'https://www.imdb.com/name/nm5392468/'
req = urllib.request.Request(
    url,
    headers={
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        title_match = re.search(r'<title>(.*?)</title>', html)
        print('TITLE:', title_match.group(1) if title_match else 'None')

        json_ld_match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
        if json_ld_match:
            data = json.loads(json_ld_match.group(1))
            print('NAME:', data.get('name'))
            print('BIO:', data.get('description'))
            print('IMAGE:', data.get('image'))
            print('KNOWN FOR:', json.dumps(data.get('knownFor', []), indent=2))
        else:
            print('No JSON-LD found')
except Exception as e:
    print('ERROR:', e)
