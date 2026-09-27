/**
 * Meta WhatsApp Cloud API Client for MuviDB
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export interface MetaWhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
}

export function getMetaWhatsAppConfig(): {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
} | null {
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
  const businessAccountId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();

  if (!phoneNumberId || !accessToken) {
    return null;
  }

  return { phoneNumberId, accessToken, businessAccountId };
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(getMetaWhatsAppConfig());
}

/**
 * Normalizes phone numbers to standard E.164 digits without '+' (e.g., 2348012345678)
 */
export function normalizeWhatsAppNumber(raw: string): string {
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Standard Nigerian 080... format
    cleaned = '234' + cleaned.substring(1);
  }
  return cleaned;
}

export interface SendWhatsAppTemplateOptions {
  to: string; // E.164 format digits, e.g. "2348012345678"
  templateName: string;
  languageCode?: string;
  headerImageUrl?: string;
  bodyParameters?: string[];
  buttonUrlPayload?: string;
}

export interface WhatsAppSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

/**
 * Sends a pre-approved template message via Meta Cloud API.
 * Template structure:
 * - Header: image (optional)
 * - Body: text with {{1}}, {{2}}, etc.
 * - Button: URL (optional)
 */
export async function sendMetaWhatsAppTemplate(
  opts: SendWhatsAppTemplateOptions
): Promise<WhatsAppSendResult> {
  const config = getMetaWhatsAppConfig();
  if (!config) {
    return { ok: false, error: 'Meta WhatsApp credentials (WHATSAPP_PHONE_NUMBER_ID / ACCESS_TOKEN) not configured' };
  }

  const recipient = normalizeWhatsAppNumber(opts.to);
  if (!recipient || recipient.length < 9) {
    return { ok: false, error: `Invalid recipient phone number: ${opts.to}` };
  }

  const components: any[] = [];

  // Header image (Poster/Backdrop)
  if (opts.headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: opts.headerImageUrl,
          },
        },
      ],
    });
  }

  // Body dynamic parameters (e.g., actor name, film title, platform)
  if (opts.bodyParameters && opts.bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: opts.bodyParameters.map((param) => ({
        type: 'text',
        text: String(param || ''),
      })),
    });
  }

  // Dynamic Button URL payload if button has dynamic slug/path
  if (opts.buttonUrlPayload) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [
        {
          type: 'text',
          text: opts.buttonUrlPayload,
        },
      ],
    });
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: opts.templateName,
      language: {
        code: opts.languageCode || 'en',
      },
      components: components.length > 0 ? components : undefined,
    },
  };

  try {
    const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      const errMsg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      console.error('[WhatsApp Cloud API] Error:', errMsg, data);
      return { ok: false, error: errMsg, details: data.error };
    }

    const messageId = data.messages?.[0]?.id;
    return { ok: true, messageId, details: data };
  } catch (err: any) {
    console.error('[WhatsApp Cloud API] Request Exception:', err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Fallback direct text message (can only be sent if within 24-hr customer service window
 * or for sandbox test phones).
 */
export async function sendMetaWhatsAppText(
  to: string,
  text: string
): Promise<WhatsAppSendResult> {
  const config = getMetaWhatsAppConfig();
  if (!config) {
    return { ok: false, error: 'Meta WhatsApp credentials not configured' };
  }

  const recipient = normalizeWhatsAppNumber(to);
  try {
    const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { preview_url: true, body: text },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message || `HTTP ${res.status}`, details: data.error };
    }

    return { ok: true, messageId: data.messages?.[0]?.id, details: data };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
