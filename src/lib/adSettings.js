/**
 * Unified Ad & Sponsored Banner Settings Controller
 * Allows configuring, adding, editing, and toggling school ads and event banners on/off across MuviDB.
 */

const STORAGE_KEY = 'muvidb_custom_ad_campaigns';
const TOGGLE_KEY = 'muvidb_ad_settings';

export const DEFAULT_CAMPAIGNS = [
  {
    id: 'delyork-cohort',
    title: 'Del-York Creative Academy: Master Modern Filmmaking & 3D VFX',
    eyebrow: "Africa's Premier Creative Academy",
    badge: 'Warner Bros. Discovery Partner',
    description: 'Intensive filmmaking, 3D VFX, directing & screen acting bootcamps in Victoria Island, Lagos. Hands-on soundstage and studio camera lab placement with verified Hollywood and Nollywood masters.',
    ctaText: 'Apply for 2026 Cohort',
    ctaUrl: 'https://www.delyorkcreative.academy/',
    mediaType: 'video',
    mediaUrl: '/media/delyork_promo.mp4',
    posterUrl: '/media/delyork/shot_cinematography.jpg',
    format: 'rectangle', // 'rectangle' | 'panorama' | 'square'
    location: 'Victoria Island Campus, Lagos & Online Hybrid',
    tags: ['Directing & Producing', '3D VFX & Animation', 'Cinematography', 'Screen Acting'],
    isActive: false,
    accentColor: '#F97316',
  },
  {
    id: 'oafp-gala',
    title: 'The OAFP Honors 2026: Pioneers & Guild Legends',
    eyebrow: 'Official Nollywood Guild Gala',
    badge: 'Sunday, Dec 1st, 2026',
    description: 'Celebrating 30+ Years of African Cinema Legends, Executive Pioneers & Master Directing Honors at the Grand Ballroom, Eko Hotels, Lagos.',
    ctaText: 'Reserve VIP Seat',
    ctaUrl: 'https://oafp-awards.example.com',
    mediaType: 'image',
    mediaUrl: '/media/kap/kap_campus_1.jpg',
    posterUrl: '/media/kap/kap_campus_1.jpg',
    format: 'panorama',
    location: 'Grand Ballroom, Eko Hotels, Lagos',
    tags: ['24 Guild Honors', 'Studio Heads & Veterans', 'Presidential Banquet'],
    isActive: false,
    accentColor: '#F59E0B',
  },
  {
    id: 'kap-academy',
    title: 'KAP Film & Television Academy: Cinematic Arts & Post-Production Labs',
    eyebrow: 'Cinematic Arts & Post-Production Labs',
    badge: 'USC & Netflix Partner',
    description: 'Master film directing, sound engineering, editing, and screenwriting under Kunle Afolayan with accredited global curriculum and scholarship placements.',
    ctaText: 'Explore KAP Admissions',
    ctaUrl: 'https://kapfilmandtelevisionacademy.com',
    mediaType: 'image',
    mediaUrl: '/media/kap/kap_class_2.jpg',
    posterUrl: '/media/kap/kap_class_2.jpg',
    format: 'rectangle',
    location: 'Ikeja, Lagos, Nigeria',
    tags: ['Directing & Producing', 'Sound Design', 'Screenwriting', 'Post-Production'],
    isActive: false,
    accentColor: '#3B82F6',
  },
];

export function getCampaigns() {
  if (typeof window === 'undefined') return DEFAULT_CAMPAIGNS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CAMPAIGNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CAMPAIGNS;
    return parsed;
  } catch {
    return DEFAULT_CAMPAIGNS;
  }
}

export function saveCampaigns(campaigns) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
    window.dispatchEvent(new CustomEvent('muvidb_ad_settings_change', { detail: campaigns }));
  } catch (err) {
    console.warn('[adSettings] Failed to save campaigns to localStorage:', err);
  }
}

export function toggleCampaign(id, isActive) {
  const current = getCampaigns();
  const updated = current.map((c) => (c.id === id ? { ...c, isActive: Boolean(isActive) } : c));
  saveCampaigns(updated);
  return updated;
}

export function updateCampaign(updatedCampaign) {
  const current = getCampaigns();
  const exists = current.some((c) => c.id === updatedCampaign.id);
  const updated = exists
    ? current.map((c) => (c.id === updatedCampaign.id ? { ...c, ...updatedCampaign } : c))
    : [...current, updatedCampaign];
  saveCampaigns(updated);
  return updated;
}

export function deleteCampaign(id) {
  const current = getCampaigns();
  const updated = current.filter((c) => c.id !== id);
  saveCampaigns(updated);
  return updated;
}

// Backward compatibility helper
export function getAdSettings() {
  const campaigns = getCampaigns();
  const settings = {};
  campaigns.forEach((c) => {
    settings[c.id] = c.isActive;
  });
  // Also support legacy aliases
  const delyork = campaigns.find((c) => c.id.includes('delyork'));
  const oafp = campaigns.find((c) => c.id.includes('oafp'));
  if (delyork) settings.delyork = delyork.isActive;
  if (oafp) settings.oafp = oafp.isActive;
  return settings;
}

export function setAdSetting(key, enabled) {
  const campaigns = getCampaigns();
  const updated = campaigns.map((c) => {
    if (c.id === key || (key === 'delyork' && c.id.includes('delyork')) || (key === 'oafp' && c.id.includes('oafp'))) {
      return { ...c, isActive: Boolean(enabled) };
    }
    return c;
  });
  saveCampaigns(updated);
}
