import json
import re
import urllib.request
import urllib.parse
import yt_dlp

def shortcode_to_media_id(shortcode: str) -> int:
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    media_id = 0
    for char in shortcode:
        media_id = media_id * 64 + alphabet.index(char)
    return media_id

def test_mobile_api(shortcode: str):
    media_id = shortcode_to_media_id(shortcode)
    url = f"https://i.instagram.com/api/v1/media/{media_id}/info/"
    print(f"Testing Mobile API for {shortcode} (ID: {media_id})...")
    req = urllib.request.Request(url, headers={
        "User-Agent": "Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_GB; 458223340)",
        "X-IG-App-ID": "936619743392459",
        "Accept": "*/*",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode('utf-8'))
            print("Mobile API Status: 200")
            item = data.get("items", [{}])[0]
            video_versions = item.get("video_versions", [])
            if video_versions:
                print("🎉 Found MP4 URL via Mobile API:", video_versions[0].get("url")[:100] + "...")
                return video_versions[0].get("url")
            else:
                print("No video_versions found in response")
    except Exception as e:
        print("Mobile API Error:", str(e))

def test_web_graphql(shortcode: str):
    print(f"Testing Web GraphQL for {shortcode}...")
    url = f"https://www.instagram.com/graphql/query/?query_hash=b3055c2c970542f3025da737d8b65c25&variables=%7B%22shortcode%22%3A%22{shortcode}%22%7D"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        "Accept": "*/*",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode('utf-8'))
            print("GraphQL Status: 200")
            media = data.get("data", {}).get("shortcode_media", {})
            vid = media.get("video_url")
            if vid:
                print("🎉 Found MP4 URL via GraphQL:", vid[:100] + "...")
                return vid
    except Exception as e:
        print("GraphQL Error:", str(e))

if __name__ == "__main__":
    code = "DEa52_0yD7E"
    test_mobile_api(code)
    test_web_graphql(code)
