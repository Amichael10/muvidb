import os
import sys
import json
import re
from scrapling import Fetcher
from dotenv import load_dotenv

load_dotenv(".env.local")

imdb_id = sys.argv[1]
url = f"https://www.imdb.com/title/{imdb_id}/fullcredits"

PROXY_USER = os.getenv("SMARTPROXY_USER", "smart-n84gqsupfojn")
PROXY_PASS = os.getenv("SMARTPROXY_PASS", "cumaxLcBt96dj0Wp")
PROXY_HOST = os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net")
PROXY_PORT = os.getenv("SMARTPROXY_PORT", "3120")
proxy_str = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"

try:
    fetcher = Fetcher(proxy=proxy_str)
    page = fetcher.get(url)
    
    credits = []
    
    # Cast
    cast_table = page.css("table.cast_list")
    if cast_table:
        for row in cast_table[0].css("tr"):
            cells = row.css("td")
            if len(cells) >= 4:
                actor_link = cells[1].css("a")
                char_link = cells[3].css("a")
                char_text = cells[3].text
                
                if actor_link:
                    actor_name = actor_link[0].text.strip()
                    href = actor_link[0].attrib.get("href", "")
                    match = re.search(r'/name/(nm\d+)/', href)
                    if match:
                        imdb_id_actor = match.group(1)
                        char_name = char_link[0].text.strip() if char_link else char_text.strip()
                        credits.append({
                            "imdbId": imdb_id_actor,
                            "name": actor_name,
                            "role": "actor",
                            "characterName": char_name
                        })
                        
    # Crew: headers are usually h4 with id
    headers = page.css("h4.dataHeaderWithBorder")
    for header in headers:
        role_text = header.text.split(" by")[0].strip()
        # Find the next table
        next_node = header.next_sibling
        while next_node:
            if hasattr(next_node, "tag") and next_node.tag == "table":
                for row in next_node.css("tr"):
                    cells = row.css("td")
                    if len(cells) >= 1:
                        crew_link = cells[0].css("a")
                        if crew_link:
                            crew_name = crew_link[0].text.strip()
                            href = crew_link[0].attrib.get("href", "")
                            match = re.search(r'/name/(nm\d+)/', href)
                            if match:
                                credits.append({
                                    "imdbId": match.group(1),
                                    "name": crew_name,
                                    "role": role_text
                                })
                break
            next_node = next_node.next_sibling
            
    print(json.dumps({"success": True, "credits": credits}))
    
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
