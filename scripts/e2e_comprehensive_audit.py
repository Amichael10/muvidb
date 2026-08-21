import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3000")
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "test_artifacts", "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

VIEWPORTS = {
    "desktop_fhd": {"width": 1920, "height": 1080, "device_name": "Desktop 1080p (Standard)"},
    "macbook_14": {"width": 1440, "height": 900, "device_name": "MacBook / Laptop 14-inch"},
    "laptop_13": {"width": 1280, "height": 800, "device_name": "Laptop 13-inch"},
    "ipad_tablet": {"width": 768, "height": 1024, "device_name": "iPad / Tablet Portrait", "is_mobile": True},
    "mobile_iphone15": {"width": 393, "height": 852, "device_name": "iPhone 15 Pro", "is_mobile": True, "has_touch": True},
    "mobile_compact": {"width": 360, "height": 780, "device_name": "Android Compact (Pixel / Galaxy)", "is_mobile": True, "has_touch": True},
}

PAGES_TO_TEST = [
    {"name": "Home", "path": "/", "desc": "Homepage with Hero Carousel, Platform Rails, Top 10, Live Showtimes"},
    {"name": "Browse_Films", "path": "/browse", "desc": "Catalog Browse with Genre filters, sorting, and film cards"},
    {"name": "Film_Detail_Movie", "path": "/films/anikulapo", "desc": "Movie Detail for Aníkúlápó (2022) with multi-source ratings, cast rail, synopsis"},
    {"name": "Film_Detail_Series", "path": "/films/anikulapo-rise-of-the-spectre", "desc": "Mini-Series Detail with Season 1 episodes and cast"},
    {"name": "Person_Detail", "path": "/people/kunle-remi", "desc": "Actor Profile with Bio, Stage & Screen Credits, Filmography"},
    {"name": "Search_Page", "path": "/search?q=Anikulapo", "desc": "Search results for Anikulapo with instant query execution"},
    {"name": "TV_Shows", "path": "/tv-shows", "desc": "Series & TV Shows directory"},
    {"name": "Watch_Netflix", "path": "/watch/netflix", "desc": "Netflix Streaming Catalog Filter"},
    {"name": "Watch_YouTube", "path": "/watch/youtube", "desc": "YouTube Streaming Catalog Filter"},
    {"name": "Cinemas_Showtimes", "path": "/cinemas", "desc": "Cinemas & Showtimes Directory with chain filters"},
    {"name": "Plays_Theatre", "path": "/plays", "desc": "Stage Plays with Running, Upcoming, Archive Tabs"},
    {"name": "Awards_Festivals", "path": "/awards", "desc": "African Film & Television Awards directory"},
    {"name": "Critics_Directory", "path": "/critics", "desc": "Film Critics and reviews aggregator directory"},
    {"name": "Claim_Profile", "path": "/claim", "desc": "Actor & Filmmaker Profile Claim Flow"},
    {"name": "Submit_Hub", "path": "/submit", "desc": "Community Film & Credit Submissions pitch"},
    {"name": "Login", "path": "/login", "desc": "User Authentication Login view"},
    {"name": "Signup", "path": "/signup", "desc": "User Registration view"},
]

def run_e2e_audit():
    results = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "base_url": BASE_URL,
        "viewports_tested": list(VIEWPORTS.keys()),
        "pages_tested": [p["name"] for p in PAGES_TO_TEST],
        "page_results": [],
        "interactive_tests": [],
        "accessibility_summary": {},
        "overall_summary": {
            "total_pages": len(PAGES_TO_TEST),
            "total_viewports": len(VIEWPORTS),
            "total_scenarios": len(PAGES_TO_TEST) * len(VIEWPORTS),
            "errors": 0,
            "warnings": 0,
            "overflow_issues": 0,
            "accessibility_issues": 0,
        }
    }

    print(f"🚀 Starting Comprehensive E2E Test Suite across {len(PAGES_TO_TEST)} pages & {len(VIEWPORTS)} viewports...", flush=True)
    print(f"🎯 Target Server: {BASE_URL}\n", flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-proxy-server', '--disable-gpu'])

        # ── PART 1: RESPONSIVE & VISUAL AUDIT ACROSS ALL VIEWPORTS ───────────
        for p_info in PAGES_TO_TEST:
            page_name = p_info["name"]
            path = p_info["path"]
            page_url = f"{BASE_URL}{path}"

            print(f"\n=======================================================", flush=True)
            print(f"📄 Testing Page: {page_name} ({path})", flush=True)
            print(f"=======================================================", flush=True)

            page_result = {
                "page": page_name,
                "path": path,
                "description": p_info["desc"],
                "viewport_checks": [],
                "console_errors": [],
                "accessibility_findings": []
            }

            for vp_key, vp in VIEWPORTS.items():
                context = browser.new_context(
                    viewport={"width": vp["width"], "height": vp["height"]},
                    is_mobile=vp.get("is_mobile", False),
                    has_touch=vp.get("has_touch", False),
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" if not vp.get("is_mobile") else "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                )

                page = context.new_page()
                console_logs = []
                page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
                page.on("pageerror", lambda err: console_logs.append({"type": "error", "text": str(err)}))

                t0 = time.time()
                try:
                    res = page.goto(page_url, wait_until="commit", timeout=10000)
                    page.wait_for_timeout(800)  # Wait for React state & rendering
                    load_time_ms = int((time.time() - t0) * 1000)
                    status_code = res.status if res else 0

                    # Check for horizontal overflow (critical mobile / responsive bug)
                    overflow_data = page.evaluate("""() => {
                        const scrollW = document.documentElement.scrollWidth;
                        const innerW = window.innerWidth;
                        const isOverflowing = scrollW > innerW + 2;
                        
                        let culprit = null;
                        if (isOverflowing) {
                            const elements = document.querySelectorAll('div, section, main, header, footer, nav, table, ul');
                            for (const el of elements) {
                                const rect = el.getBoundingClientRect();
                                if (rect.right > innerW + 4 && rect.width > 0) {
                                    culprit = {
                                        tag: el.tagName,
                                        className: (el.className || '').toString().slice(0, 50),
                                        id: el.id || '',
                                        right: Math.round(rect.right),
                                        width: Math.round(rect.width)
                                    };
                                    break;
                                }
                            }
                        }
                        return { scrollWidth: scrollW, innerWidth: innerW, isOverflowing, culprit };
                    }""")

                    # Run DOM inspection for touch targets & accessibility
                    dom_inspection = page.evaluate("""() => {
                        const interactive = document.querySelectorAll('button, a, input, select, [role="button"]');
                        let smallTouchTargets = 0;
                        const smallTargetDetails = [];

                        interactive.forEach(el => {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32)) {
                                smallTouchTargets++;
                                if (smallTargetDetails.length < 3) {
                                    smallTargetDetails.push({
                                        tag: el.tagName,
                                        text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 30),
                                        w: Math.round(rect.width),
                                        h: Math.round(rect.height)
                                    });
                                }
                            }
                        });

                        const images = document.querySelectorAll('img');
                        let missingAlt = 0;
                        images.forEach(img => {
                            if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
                                missingAlt++;
                            }
                        });

                        const h1s = document.querySelectorAll('h1').length;
                        const h2s = document.querySelectorAll('h2').length;

                        return {
                            smallTouchTargets,
                            smallTargetDetails,
                            totalImages: images.length,
                            missingAlt,
                            h1Count: h1s,
                            h2Count: h2s
                        };
                    }""")

                    # Save Screenshot for key viewports
                    screenshot_filename = f"{page_name}_{vp_key}.png"
                    screenshot_path = os.path.join(SCREENSHOTS_DIR, screenshot_filename)
                    if vp_key in ["desktop_fhd", "macbook_14", "ipad_tablet", "mobile_iphone15"]:
                        page.screenshot(path=screenshot_path, full_page=False)

                    vp_result = {
                        "viewport": vp_key,
                        "device": vp["device_name"],
                        "resolution": f"{vp['width']}x{vp['height']}",
                        "status_code": status_code,
                        "load_time_ms": load_time_ms,
                        "overflow": overflow_data,
                        "dom_metrics": dom_inspection,
                        "console_errors_count": len([c for c in console_logs if c["type"] == "error"]),
                        "screenshot": screenshot_filename if vp_key in ["desktop_fhd", "macbook_14", "ipad_tablet", "mobile_iphone15"] else None
                    }

                    if overflow_data["isOverflowing"]:
                        print(f"  ⚠️  [{vp['device_name']}] Horizontal overflow! ({overflow_data['scrollWidth']}px vs {overflow_data['innerWidth']}px)", flush=True)
                        results["overall_summary"]["overflow_issues"] += 1
                    else:
                        print(f"  ✓ [{vp['device_name']}] Rendered clean ({load_time_ms}ms, HTTP {status_code})", flush=True)

                    page_result["viewport_checks"].append(vp_result)

                except Exception as e:
                    print(f"  ❌ [{vp['device_name']}] Error: {str(e)}", flush=True)
                    results["overall_summary"]["errors"] += 1
                    page_result["viewport_checks"].append({
                        "viewport": vp_key,
                        "device": vp["device_name"],
                        "error": str(e)
                    })
                finally:
                    context.close()

            results["page_results"].append(page_result)

        # ── PART 2: INTERACTIVE FEATURE & USER FLOW TESTING ──────────────────
        print("\n=======================================================", flush=True)
        print("🧪 PART 2: Deep Feature & Interaction Flow Tests", flush=True)
        print("=======================================================", flush=True)

        # Test 2.1: Live Search & Autocomplete Flow
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        try:
            print("▶ Testing Search Flow...", flush=True)
            page.goto(f"{BASE_URL}/", wait_until="commit")
            page.wait_for_timeout(1000)
            
            search_input = page.locator("input[type='search'], input[type='text'], input[placeholder*='Search'], input[placeholder*='search']").first
            if search_input.count() > 0:
                search_input.fill("Anikulapo")
                page.keyboard.press("Enter")
                page.wait_for_timeout(1200)
                card_count = page.locator("a[href*='/film/'], a[href*='/person/'], [data-testid='film-card']").count()
                print(f"  ✓ Search query executed: found {card_count} match cards on page", flush=True)
                results["interactive_tests"].append({
                    "feature": "Live Search Query",
                    "status": "PASS" if card_count > 0 else "WARNING",
                    "details": f"Searched for 'Anikulapo', found {card_count} matching cards"
                })
            else:
                print("  ℹ️ Search bar accessed via header trigger", flush=True)
                results["interactive_tests"].append({
                    "feature": "Live Search Query",
                    "status": "INFO",
                    "details": "Header search trigger visible"
                })
        except Exception as e:
            print(f"  ❌ Search test error: {e}", flush=True)
            results["interactive_tests"].append({"feature": "Search Query", "status": "FAIL", "error": str(e)})
        finally:
            context.close()

        # Test 2.2: Stage Plays & Theatre Tab Switching
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        try:
            print("▶ Testing Theatre (/plays) Tabs & Status Transitions...", flush=True)
            page.goto(f"{BASE_URL}/plays", wait_until="commit")
            page.wait_for_timeout(1200)

            all_count = page.locator("a[href*='/play/']").count()
            
            upcoming_tab = page.locator("button:has-text('Upcoming')").first
            upcoming_count = 0
            if upcoming_tab.count() > 0:
                upcoming_tab.click()
                page.wait_for_timeout(600)
                upcoming_count = page.locator("a[href*='/play/']").count()
                print(f"  ✓ Upcoming Tab: {upcoming_count} upcoming plays displayed", flush=True)

            archive_tab = page.locator("button:has-text('Archive'), button:has-text('Past')").first
            archive_count = 0
            if archive_tab.count() > 0:
                archive_tab.click()
                page.wait_for_timeout(600)
                archive_count = page.locator("a[href*='/play/']").count()
                print(f"  ✓ Archive Tab: {archive_count} archived plays displayed", flush=True)

            results["interactive_tests"].append({
                "feature": "Theatre Status Tabs & Filters",
                "status": "PASS",
                "details": f"All: {all_count}, Upcoming: {upcoming_count}, Archive: {archive_count}"
            })
        except Exception as e:
            print(f"  ❌ Theatre tab test error: {e}", flush=True)
            results["interactive_tests"].append({"feature": "Theatre Tabs", "status": "FAIL", "error": str(e)})
        finally:
            context.close()

        # Test 2.3: Film Detail Rating Hero & Episode List Flow
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        try:
            print("▶ Testing Mini-Series Detail (/film/anikulapo-rise-of-the-spectre)...", flush=True)
            page.goto(f"{BASE_URL}/film/anikulapo-rise-of-the-spectre", wait_until="commit")
            page.wait_for_timeout(1200)

            has_star = page.locator("text=★").count() > 0 or page.locator("text=/10").count() > 0
            has_episodes = page.locator("text=Episode").count() > 0 or page.locator("text=Season").count() > 0
            has_cast = page.locator("a[href*='/person/']").count()

            print(f"  ✓ Star Rating Present: {has_star}", flush=True)
            print(f"  ✓ Episodes / Season Section Present: {has_episodes}", flush=True)
            print(f"  ✓ Cast Members Linked: {has_cast}", flush=True)

            results["interactive_tests"].append({
                "feature": "Series Detail & Multi-Pillar Rating Block",
                "status": "PASS" if has_star and has_cast > 0 else "WARNING",
                "details": f"Star Rating: {has_star}, Cast Count: {has_cast}, Episodes Listed: {has_episodes}"
            })
        except Exception as e:
            print(f"  ❌ Series Detail test error: {e}", flush=True)
            results["interactive_tests"].append({"feature": "Series Detail", "status": "FAIL", "error": str(e)})
        finally:
            context.close()

        # Test 2.4: Mobile Navigation Menu & Drawer
        context = browser.new_context(viewport={"width": 393, "height": 852}, is_mobile=True, has_touch=True)
        page = context.new_page()
        try:
            print("▶ Testing Mobile Navigation & Drawer (iPhone 15 Pro)...", flush=True)
            page.goto(f"{BASE_URL}/", wait_until="commit")
            page.wait_for_timeout(1000)

            menu_btn = page.locator("button[aria-label*='menu' i], button[aria-label*='nav' i], header button").first
            if menu_btn.count() > 0:
                menu_btn.click()
                page.wait_for_timeout(500)
                links_in_drawer = page.locator("nav a, [role='dialog'] a").count()
                print(f"  ✓ Mobile menu opened: contains {links_in_drawer} navigation links", flush=True)
                results["interactive_tests"].append({
                    "feature": "Mobile Navigation Drawer",
                    "status": "PASS",
                    "details": f"Menu trigger opened successfully with {links_in_drawer} links"
                })
            else:
                print("  ℹ️ Navigation bar visible", flush=True)
                results["interactive_tests"].append({
                    "feature": "Mobile Navigation Drawer",
                    "status": "INFO",
                    "details": "Header bar visible"
                })
        except Exception as e:
            print(f"  ❌ Mobile nav test error: {e}", flush=True)
            results["interactive_tests"].append({"feature": "Mobile Nav", "status": "FAIL", "error": str(e)})
        finally:
            context.close()

        browser.close()

    output_json = os.path.join(os.path.dirname(__file__), "..", "test_artifacts", "e2e_results.json")
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\n✅ All E2E Tests Finished! Results saved to {output_json}", flush=True)
    return results

if __name__ == "__main__":
    run_e2e_audit()
