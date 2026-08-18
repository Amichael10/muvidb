import urllib.request
import json

url = 'https://graphql.imdb.com/'
query = """
query GetNameDetail {
  name(id: "nm18080070") {
    id
    nameText { text }
    bio { text { plainText } }
    filmography {
      edges {
        node {
          title {
            id
            titleText { text }
            releaseYear { year }
          }
          category { text }
        }
      }
    }
  }
}
"""

req = urllib.request.Request(
    url,
    data=json.dumps({'query': query}).encode('utf-8'),
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
    }
)

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("GQL RESPONSE:")
        print(json.dumps(res, indent=2))
except Exception as e:
    print('GQL ERROR:', e)
