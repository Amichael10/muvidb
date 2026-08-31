# MuviDB free desktop social clipper

The Social Studio clipper can process YouTube video on the admin computer. This
uses the computer's residential connection and browser session, avoiding the
YouTube bot checks that affect Vercel and Render datacenter addresses.

## Start it on Windows

From the MuviDB project folder:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local-social-clipper.ps1
```

Keep the window open, then use **YouTube / Video Clip Studio** normally. The
browser sends only the YouTube URL and crop instructions to `127.0.0.1`. The
rendered MP4 is uploaded directly from the browser to MuviDB's temporary Google
Drive folder. Video bytes never pass through Vercel or Supabase.

The first start creates `.local-clipper-venv` and installs the Python packages.
FFmpeg must be available on the computer. The script prints the Windows install
command if it is missing.

By default yt-dlp reads the signed-in Chrome session. To use Edge instead:

```powershell
$env:YT_COOKIES_FROM_BROWSER='edge'
powershell -ExecutionPolicy Bypass -File scripts/start-local-social-clipper.ps1
```

Temporary local MP4 files are deleted after the browser uploads them. Abandoned
files are automatically removed after two hours.
