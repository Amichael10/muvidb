import json
import sys
from scrapling import Fetcher

url = sys.argv[1]
fetcher = Fetcher()
page = fetcher.get(url)

print(json.dumps({"title": page.css("title")[0].text}))
