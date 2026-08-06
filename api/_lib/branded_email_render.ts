/**
 * Shared React Email render — used by welcome + auth confirm emails.
 */
import React from 'react';
import { render } from '@react-email/render';
import MuviDbWelcomeEmail, { type MuviDbWelcomeEmailProps } from '../../emails/MuviDbWelcomeEmail';

export type { MuviDbWelcomeEmailProps };

export async function renderBrandedEmail(props: MuviDbWelcomeEmailProps): Promise<string> {
  return render(React.createElement(MuviDbWelcomeEmail, props));
}
