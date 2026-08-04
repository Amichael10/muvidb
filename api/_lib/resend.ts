import { Resend } from 'resend';

let client: Resend | null = null;

/** Lazy Resend client — never throws at import time (keeps cold starts safe). */
export function getResend(): Resend | null {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export function resendConfigured() {
  return Boolean((process.env.RESEND_API_KEY || '').trim());
}
