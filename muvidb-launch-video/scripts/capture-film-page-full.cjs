/** Full-height capture of the film page, used as the scrollable Scene 6 screen. */
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.MUVIDB_BASE_URL ?? "https://muvidb.com";
const out = path.join(__dirname, "..", "public", "captures", "alert", "film-page-scroll.png");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("muvidb_cookie_consent", "rejected");
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/film/house-of-gaa-3`, { waitUntil: "networkidle", timeout: 60000 }).catch(() =>
    page.goto(`${baseUrl}/film/house-of-gaa-3`, { waitUntil: "domcontentloaded", timeout: 60000 }),
  );
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('[role="dialog"]')) {
      if (/privacy|cookie/i.test(d.textContent ?? "")) d.remove();
    }
    // The sticky bottom nav and floating buttons would repeat down a full-page
    // shot, so they are dropped here and re-drawn by the composition instead.
    for (const el of document.querySelectorAll("nav, [class*='fixed']")) {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") el.remove();
    }
  });
  // Walk the page so lazy images load before the full-height shot.
  await page.evaluate(async () => {
    const step = 600;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2500);
  // Only the top of the page is ever on screen, and a 23,000px-tall PNG
  // will not render reliably in the compositor. Clip to the region the scene
  // scrolls through, which ends just past the "WATCH ON Netflix" control.
  await page.screenshot({
    path: out,
    fullPage: true,
    clip: { x: 0, y: 0, width: 390, height: 1560 },
  });
  const dims = await page.evaluate(() => ({ h: document.body.scrollHeight }));
  console.log("saved", out, "page height(css px):", dims.h);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
