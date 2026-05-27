#!/usr/bin/env python3
import sys
import argparse
import json
from scrapling import StealthyFetcher

# Force UTF-8 output encoding for reliable text extraction on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

def main():
    parser = argparse.ArgumentParser(description="Lumi Scrapling Bridge")
    parser.add_argument("--url", required=True, help="Target URL to fetch")
    parser.add_argument("--wait", type=int, default=5000, help="Wait time in milliseconds after load")
    parser.add_argument("--timeout", type=int, default=30000, help="Timeout in milliseconds")
    parser.add_argument("--solve-cloudflare", action="store_true", help="Attempt to solve Cloudflare Turnstile")
    parser.add_argument("--selector", help="Wait for specific CSS selector before finishing")
    
    args = parser.parse_args()
    
    fetcher = StealthyFetcher()
    
    fetch_kwargs = {
        "timeout": args.timeout,
        "disable_resources": True,  # Speeds up loading massively by blocking heavy media/css/fonts
        "wait": args.wait,
    }
    
    if args.solve_cloudflare:
        fetch_kwargs["solve_cloudflare"] = True
        
    if args.selector:
        fetch_kwargs["wait_selector"] = args.selector
        fetch_kwargs["wait_selector_state"] = "visible"
        
    try:
        page = fetcher.fetch(args.url, **fetch_kwargs)
        
        # We output a structured JSON response to stdout so TypeScript can easily parse it
        result = {
            "status": page.status,
            "url": page.url,
            "text": page.get_all_text(),
        }
        
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
        
    except Exception as e:
        error_res = {
            "error": str(e),
            "status": 500
        }
        print(json.dumps(error_res), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
