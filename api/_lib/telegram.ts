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

export type TelegramVideoOpts = {
  video: string;
  caption?: string;
  chatId?: string;
  replyMarkup?: { inline_keyboard: TelegramInlineButton[][] };
};

export async function sendTelegramVideo(
  videoOrOpts: string | TelegramVideoOpts,
  caption?: string,
  replyMarkup?: { inline_keyboard: TelegramInlineButton[][] },
  chatId?: string,
): Promise<{ ok: boolean; error?: string; messageId?: number; fileId?: string }> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const defaultChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !defaultChatId) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' };
  }

  const opts: TelegramVideoOpts =
    typeof videoOrOpts === 'string'
      ? { video: videoOrOpts, caption, replyMarkup, chatId }
      : videoOrOpts;

  const targetChatId = (opts.chatId || defaultChatId).trim();
  if (!targetChatId) return { ok: false, error: 'chat id missing' };

  try {
    const body: Record<string, unknown> = {
      chat_id: targetChatId,
      video: opts.video,
      supports_streaming: true,
    };
    if (opts.caption) body.caption = opts.caption.slice(0, 1024);
    if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      // If Telegram's servers cannot directly fetch the external CDN URL, fetch buffer and upload directly
      if (typeof opts.video === 'string' && opts.video.startsWith('http')) {
        try {
          const vidFetch = await fetch(opts.video, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.instagram.com/',
            },
          });
          if (vidFetch.ok) {
            const arrayBuffer = await vidFetch.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
            const formData = new FormData();
            formData.append('chat_id', targetChatId);
            formData.append('video', blob, 'video.mp4');
            formData.append('supports_streaming', 'true');
            if (opts.caption) formData.append('caption', opts.caption.slice(0, 1024));
            if (opts.replyMarkup) formData.append('reply_markup', JSON.stringify(opts.replyMarkup));

            const uploadRes = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
              method: 'POST',
              body: formData,
            });
            const uploadJson = await uploadRes.json().catch(() => ({}));
            if (uploadRes.ok && uploadJson.ok) {
              return {
                ok: true,
                messageId: uploadJson.result?.message_id,
                fileId: uploadJson.result?.video?.file_id,
              };
            }
          }
        } catch (uploadErr) {
          console.warn('[sendTelegramVideo] Upload fallback error:', uploadErr);
        }
      }

      if (opts.caption) {
        return sendTelegramMessage({
          text: opts.caption,
          chatId: targetChatId,
          replyMarkup: opts.replyMarkup,
        });
      }
      return { ok: false, error: json?.description || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      messageId: json.result?.message_id,
      fileId: json.result?.video?.file_id,
    };
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

export async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token || !fileId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && json.result?.file_path) {
      return `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
    }
    return null;
  } catch {
    return null;
  }
}

