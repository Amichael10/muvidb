/**
 * Shared React Email render — used by welcome + auth confirm emails.
 * Loaded only from api/data (Vercel bundles TSX correctly there).
 */
import React from 'react';
import { render } from '@react-email/render';
import MuviDbWelcomeEmail from '../../emails/MuviDbWelcomeEmail';
import type { MuviDbWelcomeEmailProps } from '../../emails/MuviDbWelcomeEmail';

export async function renderBrandedEmail(props: MuviDbWelcomeEmailProps): Promise<string> {
  return render(React.createElement(MuviDbWelcomeEmail, props));
}
