const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.MUVIDB_BASE_URL ?? "http://localhost:3001";
const outputDir = path.join(__dirname, "..", "public", "captures");

const desktopRoutes = [
  { name: "home-desktop.png", path: "/", wait: 2600 },
  {
    name: "detail-desktop.png",
    path: "/films/agesinkole-2-king-of-thieves-2",
    wait: 3000,
  },
  { name: "people-desktop.png", path: "/people", wait: 2600 },
  { name: "cinemas-desktop.png", path: "/cinemas", wait: 2600 },
  { name: "browse-desktop.png", path: "/browse", wait: 2600 },
];

const mobileRoutes = [
  { name: "home-mobile.png", path: "/", wait: 2600 },
  {
    name: "detail-mobile.png",
    path: "/films/agesinkole-2-king-of-thieves-2",
    wait: 3000,
  },
  { name: "people-mobile.png", path: "/people", wait: 2600 },
  { name: "cinemas-mobile.png", path: "/cinemas", wait: 2600 },
];

const ensureConsent = async (page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("muvidb_cookie_consent", "rejected");
  });
};

const hideTransientChrome = async (page) => {
  await page.evaluate(() => {
    window.localStorage.setItem("muvidb_cookie_consent", "rejected");

    for (const dialog of document.querySelectorAll('[role="dialog"]')) {
      const text = dialog.textContent ?? "";
      if (text.includes("We value your privacy")) {
        dialog.remove();
      }
    }
  });
};

const captureSet = async ({ browser, routes, viewport, deviceScaleFactor = 1 }) => {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile: viewport.width < 700,
    hasTouch: viewport.width < 700,
  });

  const page = await context.newPage();
  await ensureConsent(page);

  for (const route of routes) {
    const url = new URL(route.path, baseUrl).toString();
    const outfile = path.join(outputDir, route.name);

    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(route.wait);
    await hideTransientChrome(page);
    await page.screenshot({
      path: outfile,
      fullPage: false,
      animations: "disabled",
    });

    console.log(`${route.name} <- ${url}`);
  }

  await context.close();
};

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    await captureSet({
      browser,
      routes: desktopRoutes,
      viewport: { width: 1440, height: 960 },
    });

    await captureSet({
      browser,
      routes: mobileRoutes,
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
    });
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
