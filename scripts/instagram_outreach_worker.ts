/**
 * Instagram DM Automated Outreach Worker
 *
 * Safely executes targeted Instagram direct message outreach to emerging filmmakers,
 * crew, and actors with humanized keystrokes and strict safety intervals.
 *
 * Usage:
 *   npx tsx scripts/instagram_outreach_worker.ts
 *   npx tsx scripts/instagram_outreach_worker.ts --limit 10
 *   npx tsx scripts/instagram_outreach_worker.ts --dry-run
 */
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { supabase as serviceSupabase } from './lib/db.js';
import { getSessionPath, isSessionSaved } from './lib/ig_session_manager.js';
import { sendTelegramMessage } from '../api/_lib/telegram.js';
import { extractInstagramHandle } from '../api/_lib/outreach_generator.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

chromium.use(stealthPlugin());

interface WorkerArgs {
  limit: number;
  dryRun: boolean;
  minDelaySec: number;
  maxDelaySec: number;
}

function parseArgs(): WorkerArgs {
  const args = process.argv.slice(2);
  let limit = 25;
  let dryRun = false;
  let minDelaySec = 45;
  let maxDelaySec = 105;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 25;
      i++;
    } else if (args[i].startsWith('--limit=')) {
      limit = parseInt(args[i].split('=')[1], 10) || 25;
    }
  }

  return { limit, dryRun, minDelaySec, maxDelaySec };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function typeHumanLike(page: any, input: any, text: string) {
  await input.focus();
  for (const char of text) {
    await page.keyboard.type(char, { delay: randomBetween(35, 95) });
    if (char === '\n') {
      await page.waitForTimeout(randomBetween(120, 250));
    }
  }
}

async function findExactMessageButton(page: any, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const candidates = [
      page.getByRole('button', { name: 'Message', exact: true }),
      page.getByRole('link', { name: 'Message', exact: true }),
      page.locator('header div[role="button"]').filter({ hasText: /^\s*Message\s*$/ }),
    ];

    for (const candidate of candidates) {
      const count = await candidate.count();
      for (let index = 0; index < count; index++) {
        const element = candidate.nth(index);
        if (await element.isVisible().catch(() => false)) return element;
      }
    }

    await page.waitForTimeout(500);
  }

  return null;
}

async function findMessageInput(page: any) {
  const input = page.locator([
    'div[aria-label="Message"][contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
    'textarea[placeholder*="Message" i]',
  ].join(', ')).filter({ visible: true }).first();

  await input.waitFor({ state: 'visible', timeout: 20000 });
  return input;
}

async function runWorker() {
  const { limit, dryRun, minDelaySec, maxDelaySec } = parseArgs();

  console.log('========================================================');
  console.log('🚀 MUVIDB INSTAGRAM OUTREACH WORKER');
  console.log('========================================================');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Simulating only)' : '⚡ LIVE SENDER'}`);
  console.log(`Batch Limit: ${limit}`);
  console.log(`Delay Range: ${minDelaySec}s - ${maxDelaySec}s between DMs`);
  console.log('--------------------------------------------------------');

  const sessionPath = getSessionPath();
  if (!isSessionSaved() && !dryRun) {
    console.error('❌ No active Instagram session found!');
    console.error('👉 Please run `npm run ig:login` first to authenticate your scout account.');
    process.exit(1);
  }

  // 1. Fetch queued outreach items
  const { data: queue, error: fetchErr } = await serviceSupabase
    .from('artist_outreach')
    .select(`
      id,
      person_id,
      status,
      last_message,
      notes,
      people:person_id (
        id,
        name,
        slug,
        instagram_url,
        known_for_department
      )
    `)
    .eq('status', 'queued')
    .limit(limit);

  if (fetchErr) {
    if (fetchErr.code === '42501' || fetchErr.message?.includes('permission denied')) {
      console.error('❌ Supabase Permission Denied: CLI scripts require SUPABASE_SERVICE_ROLE_KEY in .env.local to query artist_outreach.');
      console.error('👉 Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your .env.local file.');
    } else {
      console.error('❌ Error fetching queued candidates:', fetchErr);
    }
    process.exit(1);
  }

  if (!queue || queue.length === 0) {
    console.log('ℹ️ No items currently queued for outreach.');
    console.log('Generate candidates in the Admin Outreach Studio or run a batch generation.');
    return;
  }

  console.log(`📋 Loaded ${queue.length} queued recipient(s).`);

  let sentCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const processedNames: string[] = [];

  let browser: any = null;
  let page: any = null;

  try {
    if (!dryRun) {
      console.log('🌐 Launching stealth browser context...');
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const context = await browser.newContext({
        storageState: sessionPath,
        viewport: { width: 1280, height: 800 },
      });

      page = await context.newPage();
      await page.goto('https://www.instagram.com/', { waitUntil: 'commit', timeout: 15000 }).catch(() => {});
      await page.waitForSelector('main, header, div[role="main"]', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(3000);

      // Verify we are logged in
      const currentUrl = page.url();
      if (currentUrl.includes('/accounts/login/')) {
        throw new Error('Session expired or invalidated. Please run `npm run ig:login` again.');
      }
    }

    for (let i = 0; i < queue.length; i++) {
      const item: any = queue[i];
      const person = item.people;
      const personName = person?.name || 'Unknown';
      const igUrl = person?.instagram_url || '';
      const messageText = item.last_message;

      // Extract handle
      const rawHandle = extractInstagramHandle(igUrl);
      const handle = rawHandle.replace(/^@/, '').trim();
      console.log(`\n--------------------------------------------------------`);
      console.log(`[${i + 1}/${queue.length}] Processing: ${personName} (@${handle})`);

      if (!handle || !messageText) {
        console.warn(`⚠️ Missing handle or pitch text for ${personName}, skipping.`);
        if (!dryRun) {
          await serviceSupabase
            .from('artist_outreach')
            .update({ status: 'skipped', notes: 'Missing handle or message text' })
            .eq('id', item.id);
        }
        skipCount++;
        continue;
      }

      if (dryRun) {
        console.log(`📝 [SIMULATION] Target: https://www.instagram.com/${handle}/`);
        console.log(`💬 Message Preview:\n${messageText}`);
        sentCount++;
        processedNames.push(personName);
        continue;
      }

      try {
        console.log(`🔎 Navigating to profile: https://www.instagram.com/${handle}/`);
        await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'commit', timeout: 30000 });
        await page.waitForSelector('body', { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(randomBetween(2500, 4500));

        // Check if user not found or unavailable
        const pageContent = await page.content();
        if (
          pageContent.includes("Sorry, this page isn't available") ||
          pageContent.includes("The link you followed may be broken")
        ) {
          console.warn(`⚠️ Profile for @${handle} is unavailable or private/suspended.`);
          await serviceSupabase
            .from('artist_outreach')
            .update({ status: 'skipped', notes: 'IG Profile unavailable/broken' })
            .eq('id', item.id);
          skipCount++;
          continue;
        }

        // Look for "Message" button
        // Instagram uses button with text "Message" or role button with "Message"
        const messageBtn = await findExactMessageButton(page);

        if (!messageBtn) {
          // Direct navigation to direct message if button isn't visible
          console.log('ℹ️ Message button not immediately visible, checking direct fallback...');
          // Check for options button or private profile
          const isPrivate = pageContent.includes('This account is private');
          if (isPrivate) {
            console.log('🔒 Account is private. Attempting follow/message interaction.');
          }
        }

        if (messageBtn) {
          await messageBtn.click();
          await Promise.race([
            page.waitForURL(/\/direct\//, { timeout: 20000 }),
            page.locator('[contenteditable="true"][role="textbox"], textarea[placeholder*="Message" i]')
              .first()
              .waitFor({ state: 'visible', timeout: 20000 }),
          ]).catch(() => {});
          await page.waitForTimeout(randomBetween(1500, 2500));
        } else {
          // Fallback direct URL format: https://www.instagram.com/direct/t/ (needs profile ID)
          console.warn(`⚠️ Could not find Message button for @${handle}.`);
          await serviceSupabase
            .from('artist_outreach')
            .update({ status: 'skipped', notes: 'No message button on profile' })
            .eq('id', item.id);
          skipCount++;
          continue;
        }

        // Check for "Not Now" on notifications dialog if it appears
        const notNowBtn = await page.$('button:has-text("Not Now")');
        if (notNowBtn) {
          await notNowBtn.click();
          await page.waitForTimeout(1000);
        }

        // Locate DM message input box
        const inputElem = await findMessageInput(page).catch(() => null);

        if (!inputElem) {
          throw new Error(`Message button did not open a DM composer (URL: ${page.url()})`);
        }

        console.log(`✍️ Typing personalized pitch (${messageText.length} chars)...`);
        await typeHumanLike(page, inputElem, messageText);
        await page.waitForTimeout(randomBetween(1000, 2000));

        // Hit Enter or click Send
        console.log('📤 Sending DM...');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(randomBetween(2500, 4000));

        // Check for Action Block alerts
        const afterSendContent = await page.content();
        if (
          afterSendContent.includes('Action Blocked') ||
          afterSendContent.includes('Try Again Later') ||
          afterSendContent.includes('suspicious activity')
        ) {
          console.error('🚨 INSTAGRAM ACTION BLOCK DETECTED! HALTING WORKER TO PROTECT ACCOUNT.');
          await serviceSupabase
            .from('artist_outreach')
            .update({ status: 'queued', notes: 'Halted: Action Block Detected' })
            .eq('id', item.id);
          failCount++;
          break;
        }

        // Update DB status to 'sent'
        await serviceSupabase
          .from('artist_outreach')
          .update({
            status: 'sent',
            contacted_at: new Date().toISOString(),
            notes: `Sent via Scout Bot to @${handle}`,
          })
          .eq('id', item.id);

        sentCount++;
        processedNames.push(personName);
        console.log(`✅ DM sent successfully to ${personName} (@${handle})!`);

        // Randomized human pause before next message
        if (i < queue.length - 1) {
          const delaySec = randomBetween(minDelaySec, maxDelaySec);
          console.log(`⏳ Cooling down for ${delaySec}s before next contact...`);
          await sleep(delaySec * 1000);
        }
      } catch (itemErr: any) {
        console.error(`❌ Failed to send DM to ${personName}:`, itemErr?.message || itemErr);
        await serviceSupabase
          .from('artist_outreach')
          .update({
            status: 'queued',
            notes: `Send error: ${itemErr?.message || 'Unknown'}`,
          })
          .eq('id', item.id);
        failCount++;
      }
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  // Summary & Telegram notification
  const summary = `📊 *Instagram Outreach Batch Completed*
• Mode: ${dryRun ? 'Dry Run' : 'Live'}
• Sent: ${sentCount}
• Skipped: ${skipCount}
• Failed: ${failCount}
• People: ${processedNames.slice(0, 5).join(', ')}${processedNames.length > 5 ? ` and ${processedNames.length - 5} more` : ''}`;

  console.log('\n========================================================');
  console.log(summary);
  console.log('========================================================');

  if (!dryRun && sentCount > 0) {
    try {
      await sendTelegramMessage(summary);
    } catch (tgErr) {
      console.warn('Telegram notification failed:', tgErr);
    }
  }
}

runWorker().catch((err) => {
  console.error('Fatal worker error:', err);
  process.exit(1);
});
