import json
import sys
from scrapling import StealthyFetcher

url = sys.argv[1]
# Run stealthy fetcher
fetcher = StealthyFetcher()
page = fetcher.get(url)
print("TITLE:", page.css("title")[0].text)
