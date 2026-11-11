/**
 * vCard 3.0 Generator and Exporter for Lumi Mirror.
 * Generates standards-compliant .vcf files that natively import into
 * Apple iOS Contacts, Google/Android Contacts, and Outlook.
 */

export interface VCardPayload {
  name: string;
  roles?: string | string[];
  organization?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  bio?: string;
  avatarUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
}

function escapeVCardValue(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function generateVCardString(payload: VCardPayload): string {
  const nameParts = (payload.name || 'Creator').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  
  const rolesString = Array.isArray(payload.roles)
    ? payload.roles.filter(Boolean).join(' • ')
    : payload.roles || 'Filmmaker';

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`,
    `FN:${escapeVCardValue(payload.name || 'Creator')}`,
    `TITLE:${escapeVCardValue(rolesString)}`,
    `ORG:${escapeVCardValue(payload.organization || 'Nollywood / African Cinema & Theatre')}`,
  ];

  if (payload.email) {
    lines.push(`EMAIL;TYPE=INTERNET,WORK,PREF:${payload.email.trim()}`);
  }

  const telNumber = payload.whatsapp || payload.phone;
  if (telNumber) {
    const cleanNumber = telNumber.replace(/[^\d+]/g, '');
    lines.push(`TEL;TYPE=CELL,VOICE,PREF:${cleanNumber}`);
  }

  if (payload.website) {
    lines.push(`URL:${payload.website.trim()}`);
  }

  if (payload.instagramUrl) {
    lines.push(`X-SOCIALPROFILE;type=instagram:${payload.instagramUrl.trim()}`);
  }

  if (payload.twitterUrl) {
    lines.push(`X-SOCIALPROFILE;type=twitter:${payload.twitterUrl.trim()}`);
  }

  if (payload.youtubeUrl) {
    lines.push(`X-SOCIALPROFILE;type=youtube:${payload.youtubeUrl.trim()}`);
  }

  if (payload.bio) {
    const noteText = `${payload.bio}\n\nVerified Lumi Profile: ${payload.website || ''}`.trim();
    lines.push(`NOTE:${escapeVCardValue(noteText)}`);
  }

  lines.push('END:VCARD');

  return lines.join('\r\n');
}

export function downloadVCard(payload: VCardPayload, customFilename?: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const vcardContent = generateVCardString(payload);
    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const safeName = (payload.name || 'creator')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const filename = customFilename || `${safeName}_lumi_contact.vcf`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('Failed to download vCard:', err);
    return false;
  }
}
