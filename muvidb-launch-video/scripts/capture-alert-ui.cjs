/**
 * Captures the real MuviDB screens used by the actor-alert demo.
 *
 * Runs against production by default so the frames are the shipped UI rather
 * than a local build that may be ahead of it. Override with MUVIDB_BASE_URL.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.MUVIDB_BASE_URL ?? "https://muvidb.com";
const outputDir = path.join(__dirname, "..", "public", "captures", "alert");

const PHONE = { width: 390, height: 844 };

const settle = async (page, ms) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(ms);
};

/** The consent dialog and any floating app chrome would otherwise sit over the UI. */
const clearChrome = async (page) => {
  await page.evaluate(() => {
    window.localStorage.setItem("muvidb_cookie_consent", "rejected");
    for (const dialog of document.querySelectorAll('[role="dialog"]')) {
      const text = dialog.textContent ?? "";
      if (/privacy|cookie/i.test(text)) dialog.remove();
    }
  });
  await page.waitForTimeout(400);
};

const run = async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("muvidb_cookie_consent", "rejected");
  });
  const page = await context.newPage();

  const shots = [
    { name: "actor-profile-top.png", url: "/people/femi-adebayo", wait: 4200, scrollTo: 0 },
    { name: "actor-profile-credits.png", url: "/people/femi-adebayo", wait: 4200, scrollTo: 900 },
    { name: "film-page-top.png", url: "/film/house-of-gaa-3", wait: 4200, scrollTo: 0 },
    { name: "film-page-watch.png", url: "/film/house-of-gaa-3", wait: 4200, scrollTo: 620 },
  ];

  for (const shot of shots) {
    const target = `${baseUrl}${shot.url}`;
    process.stdout.write(`-> ${target} (${shot.name}) `);
    try {
      await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
    } catch {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await clearChrome(page);
    await page.waitForTimeout(shot.wait);
    if (shot.scrollTo) {
      await page.evaluate((y) => window.scrollTo(0, y), shot.scrollTo);
      await page.waitForTimeout(1400);
    } else {
      await settle(page, 300);
    }
    await page.screenshot({ path: path.join(outputDir, shot.name) });
    console.log("ok");
  }

  await browser.close();
  console.log(`\nSaved to ${outputDir}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
