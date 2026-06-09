import json
import re

with open('mubi_dump.html', 'r', encoding='utf-8') as f:
    html = f.read()

match = re.search(r'<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>', html)
if match:
    data = json.loads(match.group(1))
    print("Found NEXT_DATA!")
    initial_state = data.get('props', {}).get('pageProps', {}).get('initialState', {})
    print("Initial state keys:", list(initial_state.keys()))
    
    if 'filmDiscovery' in initial_state:
        fd = initial_state['filmDiscovery']
        print("filmDiscovery keys:", list(fd.keys()))
        if 'filmDiscoveryResultsByUrl' in fd:
            res = fd['filmDiscoveryResultsByUrl']
            if res:
                first_key = list(res.keys())[0]
                print(f"Results for {first_key}:", len(res[first_key]))
                print("First film:", json.dumps(res[first_key][0], indent=2))
        else:
            print("No filmDiscoveryResultsByUrl")
    else:
        print("No filmDiscovery in initialState")
else:
    print("No NEXT_DATA matched.")
