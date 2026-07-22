/**
 * Send a test Telegram message using TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
 *
 *   npx tsx scripts/test_telegram.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) {
    console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local');
    console.error('1) @BotFather → /newbot → token');
    console.error('2) Message your bot, then GET https://api.telegram.org/bot<TOKEN>/getUpdates');
    process.exit(1);
  }

  const text = `✅ MuviDB Telegram test\nTime: ${new Date().toISOString()}\nIf you see this, scrape alerts will reach you.`;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const body = await res.json();
  if (!body.ok) {
    console.error('Telegram error:', body);
    process.exit(1);
  }
  console.log('Sent. Check Telegram.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
