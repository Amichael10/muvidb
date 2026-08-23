/**
 * Send a Telegram message via Bot API.
 * Requires TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in env.
 */

export type TelegramInlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type TelegramSendOpts = {
  text: string;
  chatId?: string;
  replyMarkup?: { inline_keyboard: TelegramInlineButton[][] };
  disablePreview?: boolean;
};

export async function sendTelegramMessage(
  textOrOpts: string | TelegramSendOpts,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const defaultChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !defaultChatId) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' };
  }

  const opts: TelegramSendOpts =
    typeof textOrOpts === 'string' ? { text: textOrOpts } : textOrOpts;
  const chatId = (opts.chatId || defaultChatId).trim();
  if (!chatId) return { ok: false, error: 'chat id missing' };

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: opts.text.slice(0, 3900),
      disable_web_page_preview: opts.disablePreview !== false,
    };
    if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      return { ok: false, error: json?.description || `HTTP ${res.status}` };
    }
    return { ok: true, messageId: json.result?.message_id };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export type TelegramPhotoOpts = {
  photo: string;
  caption?: string;
  chatId?: string;
  replyMarkup?: { inline_keyboard: TelegramInlineButton[][] };
};

export async function sendTelegramPhoto(
  photoOrOpts: string | TelegramPhotoOpts,
  caption?: string,
  replyMarkup?: { inline_keyboard: TelegramInlineButton[][] },
  chatId?: string,
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const defaultChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !defaultChatId) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' };
  }

  const opts: TelegramPhotoOpts =
    typeof photoOrOpts === 'string'
      ? { photo: photoOrOpts, caption, replyMarkup, chatId }
      : photoOrOpts;

  const targetChatId = (opts.chatId || defaultChatId).trim();
  if (!targetChatId) return { ok: false, error: 'chat id missing' };

  try {
    const body: Record<string, unknown> = {
      chat_id: targetChatId,
      photo: opts.photo,
    };
    if (opts.caption) body.caption = opts.caption.slice(0, 1024);
    if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      // If photo failed (e.g. invalid URL), fallback to message
      if (opts.caption) {
        return sendTelegramMessage({
          text: opts.caption,
          chatId: targetChatId,
          replyMarkup: opts.replyMarkup,
        });
      }
      return { ok: false, error: json?.description || `HTTP ${res.status}` };
    }
    return { ok: true, messageId: json.result?.message_id };
  } catch (e: any) {
    if (opts.caption) {
      return sendTelegramMessage({
        text: opts.caption,
        chatId: targetChatId,
        replyMarkup: opts.replyMarkup,
      });
    }
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: (text || 'OK').slice(0, 180),
        show_alert: false,
      }),
    });
  } catch {
    /* ignore */
  }
}

export function telegramConfigured() {
  return Boolean(
    (process.env.TELEGRAM_BOT_TOKEN || '').trim()
    && (process.env.TELEGRAM_CHAT_ID || '').trim(),
  );
}

/** Only this chat may run ops commands (private chat with you). */
export function isAllowedOpsChat(chatId: string | number | undefined | null): boolean {
  const allowed = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!allowed || chatId == null) return false;
  return String(chatId).trim() === allowed;
}
