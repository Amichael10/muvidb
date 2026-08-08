import os
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")
gemini_key = os.getenv("GEMINI_API_KEY")

print("Gemini Key present:", bool(gemini_key))

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
payload = {
    "contents": [{
        "parts": [{
            "text": "Say Hello MuviDB in 5 words."
        }]
    }]
}

headers = {"Content-Type": "application/json"}
req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        text = res['candidates'][0]['content']['parts'][0]['text']
        print("Gemini Response:", text)
except Exception as e:
    print("Gemini Test Error:", e)
