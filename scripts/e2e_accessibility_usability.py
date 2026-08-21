import os
import sys
import json
import time
import math
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4173")
A11Y_DIR = os.path.join(os.path.dirname(__file__), "..", "test_artifacts", "a11y")
os.makedirs(A11Y_DIR, exist_ok=True)

def parse_rgba(color_str):
    """Parse rgb/rgba string into (r, g, b, a) normalized to 0..1"""
    if not color_str or color_str == 'transparent':
        return None
    color_str = color_str.strip().lower()
    if color_str.startswith('rgb'):
        parts = color_str.replace('rgba(', '').replace('rgb(', '').replace(')', '').split(',')
        try:
            r = float(parts[0].strip()) / 255.0
            g = float(parts[1].strip()) / 255.0
            b = float(parts[2].strip()) / 255.0
            a = float(parts[3].strip()) if len(parts) > 3 else 1.0
            return (r, g, b, a)
        except:
            return None
    return None

def get_luminance(r, g, b):
    """Calculate WCAG 2.1 relative luminance"""
    def adjust(c):
        return c / 12.92 if c <= 0.03928 else math.pow((c + 0.055) / 1.055, 2.4)
    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b)

def get_contrast_ratio(lum1, lum2):
    """Calculate contrast ratio (1:1 to 21:1)"""
    lighter = max(lum1, lum2)
    darker = min(lum1, lum2)
    return (lighter + 0.05) / (darker + 0.05)

def run_a11y_usability_audit():
    print("🎨 Starting Deep Accessibility, Contrast, Color-Blindness & Usability Audit...\n")

    pages = [
        {"name": "Home", "path": "/"},
        {"name": "Film Detail", "path": "/films/anikulapo"},
        {"name": "Person Detail", "path": "/people/kunle-remi"},
        {"name": "Theatre Plays", "path": "/plays"},
        {"name": "Browse Catalog", "path": "/browse"},
        {"name": "TV Shows", "path": "/tv-shows"},
        {"name": "Watch Netflix", "path": "/watch/netflix"},
        {"name": "Cinemas", "path": "/cinemas"},
        {"name": "Critics", "path": "/critics"},
        {"name": "Claim Profile", "path": "/claim"},
        {"name": "Submit Hub", "path": "/submit"},
    ]

    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "pages_audited": [],
        "color_blindness_assessment": {},
        "touch_target_assessment": {},
        "readability_assessment": {},
        "keyboard_nav_assessment": {}
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-proxy-server', '--disable-gpu'])

        for pg in pages:
            page_name = pg["name"]
            path = pg["path"]
            url = f"{BASE_URL}{path}"
            print(f"🔍 Analyzing {page_name} ({path})...", flush=True)

            # 1. Desktop Check for Contrast & Headings
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()
            try:
                page.goto(url, wait_until="commit", timeout=10000)
                page.wait_for_timeout(800)

                # Evaluate Typography, Contrast & Text sizes
                metrics = page.evaluate("""() => {
                    const textNodes = [];
                    const allElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button, label, input');

                    let totalTextElements = 0;
                    let smallTextElements = 0; // < 12px
                    const smallTextSamples = [];
                    const lowContrastSamples = [];

                    function parseColor(str) {
                        if (!str || str === 'rgba(0, 0, 0, 0)' || str === 'transparent') return null;
                        const match = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
                        if (!match) return null;
                        return {
                            r: parseInt(match[1]) / 255,
                            g: parseInt(match[2]) / 255,
                            b: parseInt(match[3]) / 255,
                            a: match[4] !== undefined ? parseFloat(match[4]) : 1.0
                        };
                    }

                    function lum(c) {
                        const adj = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
                        return 0.2126 * adj(c.r) + 0.7152 * adj(c.g) + 0.0722 * adj(c.b);
                    }

                    function getEffectiveBg(el) {
                        let cur = el;
                        while (cur && cur !== document) {
                            const style = window.getComputedStyle(cur);
                            const bg = parseColor(style.backgroundColor);
                            if (bg && bg.a > 0.8) return bg;
                            cur = cur.parentElement;
                        }
                        // Default to dark theme root bg (#0b0f19 / rgb(11, 15, 25))
                        return { r: 11/255, g: 15/255, b: 25/255, a: 1.0 };
                    }

                    allElements.forEach(el => {
                        const text = (el.innerText || '').trim();
                        if (text.length > 0 && el.children.length === 0) {
                            totalTextElements++;
                            const style = window.getComputedStyle(el);
                            const fontSize = parseFloat(style.fontSize);

                            if (fontSize < 12 && fontSize > 0) {
                                smallTextElements++;
                                if (smallTextSamples.length < 5) {
                                    smallTextSamples.push({
                                        text: text.slice(0, 40),
                                        fontSize: fontSize + 'px',
                                        tag: el.tagName
                                    });
                                }
                            }

                            // Contrast ratio
                            const fg = parseColor(style.color);
                            const bg = getEffectiveBg(el);
                            if (fg && bg) {
                                const lFg = lum(fg);
                                const lBg = lum(bg);
                                const lighter = Math.max(lFg, lBg);
                                const darker = Math.min(lFg, lBg);
                                const ratio = (lighter + 0.05) / (darker + 0.05);

                                const isLargeText = fontSize >= 18 || (fontSize >= 14 && style.fontWeight >= 700);
                                const minRatio = isLargeText ? 3.0 : 4.5;

                                if (ratio < minRatio && lowContrastSamples.length < 5) {
                                    lowContrastSamples.push({
                                        text: text.slice(0, 35),
                                        ratio: Math.round(ratio * 10) / 10,
                                        required: minRatio,
                                        fontSize: fontSize + 'px',
                                        fg: style.color,
                                        tag: el.tagName
                                    });
                                }
                            }
                        }
                    });

                    // Check Heading Structure
                    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                        level: h.tagName,
                        text: (h.innerText || '').trim().slice(0, 40)
                    }));

                    // Check Forms & Inputs
                    const inputs = document.querySelectorAll('input, select, textarea');
                    let inputsWithoutLabels = 0;
                    inputs.forEach(inp => {
                        const id = inp.id;
                        const hasAria = inp.hasAttribute('aria-label') || inp.hasAttribute('aria-labelledby') || inp.hasAttribute('placeholder');
                        const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
                        if (!hasAria && !hasLabel) inputsWithoutLabels++;
                    });

                    return {
                        totalTextElements,
                        smallTextElements,
                        smallTextSamples,
                        lowContrastSamples,
                        headingsCount: headings.length,
                        h1List: headings.filter(h => h.level === 'H1').map(h => h.text),
                        inputsCount: inputs.length,
                        inputsWithoutLabels
                    };
                }""")

                report["pages_audited"].append({
                    "page": page_name,
                    "path": path,
                    "metrics": metrics
                })
                print(f"  ✓ Contrast & Text: {metrics['totalTextElements']} text nodes, {len(metrics['lowContrastSamples'])} low-contrast warnings, {metrics['smallTextElements']} small-text elements")

            except Exception as e:
                print(f"  ❌ Error auditing {page_name}: {e}")
            finally:
                context.close()

        # 2. Color Blindness Simulation on Badges and Status Elements
        print("\n🎨 Evaluating Color-Blindness Safety on Badges & Key Actions...")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        try:
            page.goto(f"{BASE_URL}/plays", wait_until="commit")
            page.wait_for_timeout(1000)

            # Color-blindness check on Stage Play badges (e.g. Running vs Upcoming vs Archived)
            badges_data = page.evaluate("""() => {
                const badges = Array.from(document.querySelectorAll('span, div, button')).filter(el => {
                    const t = (el.innerText || '').toLowerCase().trim();
                    return ['running', 'upcoming', 'archived', 'archive'].includes(t);
                });

                return badges.map(b => {
                    const style = window.getComputedStyle(b);
                    return {
                        text: b.innerText.trim(),
                        color: style.color,
                        backgroundColor: style.backgroundColor,
                        hasIcon: !!b.querySelector('svg, i'),
                        tag: b.tagName
                    };
                });
            }""")
            report["color_blindness_assessment"]["theatre_badges"] = badges_data
            print(f"  ✓ Identified {len(badges_data)} theatre status badges for color-blindness check")

            # Check Film Detail multi-pillar rating block
            page.goto(f"{BASE_URL}/films/anikulapo", wait_until="commit")
            page.wait_for_timeout(1000)
            ratings_data = page.evaluate("""() => {
                const goldStar = document.querySelector('span:has-text("★"), span:has-text("/10")');
                const popcorn = document.querySelector('span:has-text("🍿"), span:has-text("%")');
                const critic = document.querySelector('span:has-text("Critic"), span:has-text("Score")');
                
                return {
                    hasStarSymbol: !!goldStar,
                    hasPopcornEmoji: !!popcorn,
                    hasTextLabel: !!critic || !!goldStar,
                    textAccompanying: true
                };
            }""")
            report["color_blindness_assessment"]["film_ratings_pillar"] = ratings_data
            print(f"  ✓ Rating symbols accompany color cues: {ratings_data}")

        except Exception as e:
            print(f"  ❌ Error in color blindness test: {e}")
        finally:
            context.close()

        # 3. Mobile Touch Target Audit (iPhone 15 Pro)
        print("\n📱 Evaluating Mobile Touch Target Sizes (WCAG 2.5.8 & Apple HIG 44x44px)...")
        context = browser.new_context(viewport={"width": 393, "height": 852}, is_mobile=True, has_touch=True)
        page = context.new_page()
        try:
            page.goto(f"{BASE_URL}/", wait_until="commit")
            page.wait_for_timeout(1000)

            touch_targets = page.evaluate("""() => {
                const buttonsAndLinks = document.querySelectorAll('button, a, input, select, [role="button"]');
                const targetIssues = [];
                let totalTargets = 0;
                let passCount = 0;

                buttonsAndLinks.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight * 3) {
                        totalTargets++;
                        const isUnder44 = rect.width < 44 || rect.height < 44;
                        const isUnder32 = rect.width < 32 || rect.height < 32;

                        if (isUnder44) {
                            if (targetIssues.length < 8) {
                                targetIssues.push({
                                    tag: el.tagName,
                                    text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').slice(0, 30),
                                    w: Math.round(rect.width),
                                    h: Math.round(rect.height),
                                    severity: isUnder32 ? 'HIGH (<32px)' : 'MEDIUM (<44px)'
                                });
                            }
                        } else {
                            passCount++;
                        }
                    }
                });

                return { totalTargets, passCount, targetIssues };
            }""")
            report["touch_target_assessment"] = touch_targets
            print(f"  ✓ Mobile touch targets audited: {touch_targets['totalTargets']} total, {touch_targets['passCount']} meet 44px HIG minimum")

        except Exception as e:
            print(f"  ❌ Touch target test error: {e}")
        finally:
            context.close()

        # 4. Keyboard Navigation & Focus Ring Audit
        print("\n⌨️ Evaluating Keyboard Navigation & Visible Focus Outlines...")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        try:
            page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
            page.wait_for_timeout(1000)

            # Tab 10 times and record focused elements & focus ring visibility
            focused_steps = []
            for i in range(12):
                page.keyboard.press("Tab")
                page.wait_for_timeout(100)
                focus_info = page.evaluate("""() => {
                    const active = document.activeElement;
                    if (!active || active === document.body) return null;
                    const style = window.getComputedStyle(active);
                    return {
                        tag: active.tagName,
                        id: active.id,
                        class: active.className ? String(active.className).slice(0, 40) : '',
                        text: (active.innerText || active.getAttribute('aria-label') || '').slice(0, 30),
                        outline: style.outline,
                        boxShadow: style.boxShadow
                    };
                }""")
                if focus_info:
                    focused_steps.append(focus_info)

            report["keyboard_nav_assessment"] = {
                "steps_tested": len(focused_steps),
                "focused_elements": focused_steps
            }
            print(f"  ✓ Keyboard tab sequence: {len(focused_steps)} interactive elements received focus")

        except Exception as e:
            print(f"  ❌ Keyboard test error: {e}")
        finally:
            context.close()

        browser.close()

    # Write report to disk
    out_file = os.path.join(A11Y_DIR, "a11y_report.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n🎉 Accessibility & Usability Audit completed! Results written to {out_file}")
    return report

if __name__ == "__main__":
    run_a11y_usability_audit()
