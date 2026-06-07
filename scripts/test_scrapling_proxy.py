import os
import sys
import json
from scrapling import Fetcher
from dotenv import load_dotenv

load_dotenv(".env.local")

url = sys.argv[1]

PROXY_USER = os.getenv("SMARTPROXY_USER", "smart-n84gqsupfojn")
PROXY_PASS = os.getenv("SMARTPROXY_PASS", "cumaxLcBt96dj0Wp")
PROXY_HOST = os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net")
PROXY_PORT = os.getenv("SMARTPROXY_PORT", "3120")

proxy_str = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"

fetcher = Fetcher()
# For fetcher, how to set proxy? Scrapling docs say storage config or adaptive
try:
    page = fetcher.get(url, proxy=proxy_str)
except Exception as e:
    # If fetcher doesn't have proxy arg, use Fetcher(proxies=...)
    try:
        fetcher = Fetcher(proxy=proxy_str)
        page = fetcher.get(url)
    except Exception as e2:
        print("Error:", e2)
        sys.exit(1)

try:
    print(json.dumps({"title": page.css("title")[0].text}))
except Exception as e:
    print("Failed to get title", e)
