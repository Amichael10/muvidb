/**
 * Register the Telegram webhook for the ops bot.
 *
 *   npx tsx scripts/set_telegram_webhook.ts
 *   npx tsx scripts/set_telegram_webhook.ts --delete
 *
 * Uses TELEGRAM_BOT_TOKEN from .env.local.
 * Optional TELEGRAM_WEBHOOK_SECRET (recommended) — also set the same value on Vercel.
 * Optional TELEGRAM_WEBHOOK_URL (default https://muvidb.com/api/telegram).
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN missing in .env.local');
    process.exit(1);
  }

  const deleteMode = process.argv.includes('--delete');
  if (deleteMode) {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    console.log(await res.json());
    return;
  }

  const url = (process.env.TELEGRAM_WEBHOOK_URL || 'https://muvidb.com/api/telegram').trim();
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

  const body: Record<string, unknown> = {
    url,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  };
  if (secret) body.secret_token = secret;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(json);
  if (!json.ok) process.exit(1);

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
  console.log('Webhook info:', info);

  if (!secret) {
    console.log('\nTip: set TELEGRAM_WEBHOOK_SECRET in .env.local + Vercel, then re-run this script.');
  } else {
    console.log('\nEnsure TELEGRAM_WEBHOOK_SECRET is also set on Vercel (Production).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
