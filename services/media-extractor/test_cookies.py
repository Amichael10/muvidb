import os
import yt_dlp

def test_ytdlp_with_cookies(url, cookie_str=None):
    opts = {
        'quiet': False,
        'format': 'best',
        'skip_download': True,
    }
    if cookie_str:
        opts['http_headers'] = {
            'Cookie': cookie_str,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            print("Title:", info.get("title"))
            print("Video URL:", info.get("url") or info.get("formats", [{}])[-1].get("url"))
    except Exception as e:
        print("Error:", e)

test_ytdlp_with_cookies('https://www.instagram.com/reel/DEa52_0yD7E/')
