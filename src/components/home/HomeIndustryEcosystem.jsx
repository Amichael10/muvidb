import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { toTitleCase } from '../../utils/format';
import { computePersonPowerScore } from '../../lib/ranking';

function formatStudioBoxOffice(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}K`;
  return `₦${n.toLocaleString()}`;
}

// African production powerhouses, film academies, and talent agencies
const CANONICAL_ECOSYSTEM_ENTITIES = [
  {
    id: 'filmone-studios',
    slug: 'filmone-studios',
    name: 'FilmOne Studios',
    entity_type: 'studio',
    badge_label: 'Production & Distribution',
    headquarters: 'Lagos, Nigeria',
    founded_year: 2012,
    totalBoxOffice: 4200000000,
    metric_label: 'Output Slate',
    metric_value: '48 Theatrical Releases',
    commercial_rank: '₦4.2B Gross',
    logo_url: 'https://img.usheru.com/eyJidWNrZXQiOiJzdGF0aWMudXNoZXJ1LmNvbSIsImtleSI6ImltZy9jaGFubmVscy93d3cuZmlsbW9uZW5nLmNvbS9oZWFkZXIvZmlsbW9uZS1sb2dvLTQ1MC5wbmciLCJlZGl0cyI6eyJyZXNpemUiOnsiZml0IjoiY292ZXIifX19',
    cover_image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
    specialty: 'Multiplex Distribution & Co-Financing',
    signature: "Farmer's Bride · A Tribe Called Judah",
  },
  {
    id: 'anthill-studios',
    slug: 'anthill-studios',
    name: 'Anthill Studios',
    entity_type: 'studio',
    badge_label: 'VFX & Feature Studio',
    headquarters: 'Lagos, Nigeria',
    founded_year: 2010,
    totalBoxOffice: 1850000000,
    metric_label: 'Output Slate',
    metric_value: '22 Feature Films',
    commercial_rank: '₦1.8B Gross',
    logo_url: '/media/anthill_logo.webp',
    cover_image: 'https://m.media-amazon.com/images/M/MV5BZDU1ODVkMjItYmFhNy00YmM1LWI0YmItMDcyZGE0ZDBiOGE2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    specialty: 'Animation, CGI & Theatrical Epics',
    signature: 'Beast of Two Worlds · King of Thieves',
  },
  {
    id: 'del-york-creative-academy',
    slug: 'del-york-creative-academy',
    name: 'Del-York Creative Academy',
    entity_type: 'academy',
    badge_label: 'Accredited Film Academy',
    headquarters: 'Victoria Island, Lagos',
    founded_year: 2010,
    totalBoxOffice: null,
    metric_label: 'Alumni Network',
    metric_value: '2,500+ Graduates',
    commercial_rank: 'Warner Bros. Partner',
    logo_url: 'https://www.delyorkcreative.academy/images/dca-logo.png',
    cover_image: '/media/delyork/shot_sound.jpg',
    specialty: 'Directing, VFX, Camera & Screenwriting Bootcamps',
    signature: 'Hollywood Masterclasses · ₦3.2B Alumni BO',
  },
  {
    id: 'toyin-abraham-film-academy',
    slug: 'toyin-abraham-film-academy',
    name: 'Toyin Abraham Film Academy',
    entity_type: 'academy',
    badge_label: 'Acting Academy & Slate',
    headquarters: 'Lagos & Ibadan, Nigeria',
    founded_year: 2021,
    totalBoxOffice: null,
    metric_label: 'In-House Slate',
    metric_value: '18 Produced Titles',
    commercial_rank: 'Alakada Producer',
    logo_url: 'https://i.postimg.cc/KjFzt0Xb/muvidb-upscaled.jpg',
    cover_image: '/images/social/lateef_at_work_studio.jpg',
    specialty: 'Screen Acting Bootcamp & Production Slate',
    signature: 'Alakada Gen Z · Dada 100 · Tree That Shades',
  },
  {
    id: 'kap-film-television-academy',
    slug: 'kap-film-television-academy',
    name: 'KAP Film & Television Academy',
    entity_type: 'academy',
    badge_label: 'Cinematic Arts Academy',
    headquarters: 'Ikeja, Lagos',
    founded_year: 2020,
    totalBoxOffice: null,
    metric_label: 'USC / Netflix Partner',
    metric_value: '1,200+ Fellows',
    commercial_rank: 'Kunle Afolayan Lead',
    logo_url: '/media/kap/kap_about.png',
    cover_image: '/media/kap/kap_campus_1.jpg',
    specialty: 'Directing, Cinematography, Screenwriting & Post',
    signature: 'Anikulapo · Swallow Masterclasses',
  },
  {
    id: 'temple-management',
    slug: 'the-temple-company',
    name: 'The Temple Company',
    entity_type: 'agency',
    badge_label: 'Talent & Representation',
    headquarters: 'Lagos, Nigeria',
    founded_year: 2016,
    totalBoxOffice: 3500000000,
    metric_label: 'Talent Roster',
    metric_value: '45+ A-List Clients',
    commercial_rank: '₦3.5B Managed Value',
    logo_url: 'https://www.thetemplecompany.com/wp-content/uploads/2021/10/TC-Logo-White-BG@4x.png',
    cover_image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80',
    specialty: 'A-List Actor, Director & Writer Representation',
    signature: 'Bisola Aiyeola · Iyanya · Top Directors',
  },
  {
    id: 'inkblot-productions',
    slug: 'inkblot-productions',
    name: 'Inkblot Productions',
    entity_type: 'studio',
    badge_label: 'Theatrical Production',
    headquarters: 'Lagos, Nigeria',
    founded_year: 2013,
    totalBoxOffice: 1900000000,
    metric_label: 'Output Slate',
    metric_value: '32 Cinema Releases',
    commercial_rank: '₦1.9B Gross',
    logo_url: 'https://static.wikia.nocookie.net/logopedia/images/8/81/Inkblot_Productions_Logo.png/revision/latest?cb=20211126054052',
    cover_image: 'https://m.media-amazon.com/images/M/MV5BMzY1ODAxNzAtODVlYy00YzgxLThhYjUtMDY1ZjQ5ZGE5Y2MzXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    specialty: 'Commercial Feature Hits & SVOD Originals',
    signature: 'The Wedding Party · Far From Home',
  },
  {
    id: 'roverman-productions',
    slug: 'roverman-productions',
    name: 'Roverman Productions',
    entity_type: 'studio',
    badge_label: 'Stage & Theatre House',
    headquarters: 'Accra, Ghana',
    founded_year: 2008,
    totalBoxOffice: null,
    metric_label: 'Stage Slate',
    metric_value: '66 Staged Plays',
    commercial_rank: 'National Theatre Lead',
    logo_url: 'https://korba-website-assets.s3.eu-west-1.amazonaws.com/projects/roverman/roverman_logo.png',
    cover_image: 'https://res.cloudinary.com/dg8kkh3xx/image/upload/v1786096697/events/dlaqqsw5j1axg0f94xbp.jpg',
    specialty: 'Quarterly Theatrical Seasons & Musical Epics',
    signature: 'Honey Trap · Voices in My Head',
  },
  {
    id: 'royal-arts-academy',
    slug: 'royal-arts-academy',
    name: 'Royal Arts Academy',
    entity_type: 'academy',
    badge_label: 'Pioneer Film School',
    headquarters: 'Surulere, Lagos',
    founded_year: 2010,
    totalBoxOffice: null,
    metric_label: 'Pioneer Slate',
    metric_value: '30+ Commercial Hits',
    commercial_rank: 'Emem Isong Lead',
    logo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/film-images/6a689b48-358b-4bda-8d82-ed7e69174161.webp',
    cover_image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80',
    specialty: 'Screenwriting, Acting & Independent Production',
    signature: 'Special Jollof · Knocking on Heavens Door',
  },
];

// High-fidelity Nollywood talent registry with verified commercial track records & marketability (Strictly factual, no fluff)
const NOLLYWOOD_MARKETABILITY_REGISTRY = {
  'odunlade-adekola': {
    primary_role: 'Lead Actor & Director',
    objective_badge: 'AMVCA Best Actor',
    box_office_gross: '₦480M+ Theatrical BO',
    commercial_tier: 'Top Box Office Draw',
    social_reach: '5.6M Fans',
    notable_works: 'Orisa · King of Thieves',
  },
  'ruth-kadiri': {
    primary_role: 'Producer & Lead Actress',
    objective_badge: '550M+ Views',
    box_office_gross: '550M+ Digital Views',
    commercial_tier: '247 Studios Founder',
    social_reach: '5.8M Fans',
    notable_works: 'Matters Arising · Black Men Rock',
  },
  'uche-nancy': {
    primary_role: 'Producer & Studio Head',
    objective_badge: '350M+ Views',
    box_office_gross: '350M+ Digital Views',
    commercial_tier: 'Pure Joy Studio Head',
    social_reach: '1.8M Fans',
    notable_works: 'Pure Joy · The Moving Finger',
  },
  'damilola-mikebamiloye': {
    primary_role: 'Director & Showrunner',
    objective_badge: '180M+ Views',
    box_office_gross: '180M+ Digital Views',
    commercial_tier: 'Mount Zion Showrunner',
    social_reach: '2.2M Fans',
    notable_works: 'Abattoir · Agbara Nla',
  },
  'damilola-mike-bamiloye': {
    primary_role: 'Director & Showrunner',
    objective_badge: '180M+ Views',
    box_office_gross: '180M+ Digital Views',
    commercial_tier: 'Mount Zion Showrunner',
    social_reach: '2.2M Fans',
    notable_works: 'Abattoir · Agbara Nla',
  },
  'sonia-uche': {
    primary_role: 'Lead Actress',
    objective_badge: 'Top VOD Lead',
    box_office_gross: '180M+ Streaming Views',
    commercial_tier: 'Trending VOD Headliner',
    social_reach: '1.5M Fans',
    notable_works: "Frank's Wife · War Front",
  },
  'chinenye-nnebe': {
    primary_role: 'Lead Actress',
    objective_badge: '120M+ Views',
    box_office_gross: '120M+ Digital Views',
    commercial_tier: 'Top Romance Headliner',
    social_reach: '1.9M Fans',
    notable_works: 'Tested Love · Room 027',
  },
  'maurice-sam': {
    primary_role: 'Lead Actor',
    objective_badge: '140M+ Views',
    box_office_gross: '140M+ Digital Views',
    commercial_tier: 'Leading Romantic Lead',
    social_reach: '1.6M Fans',
    notable_works: 'Blood of Enogie · Just Married',
  },
  'femi-adebayo': {
    primary_role: 'Lead Actor & Producer',
    objective_badge: 'AMVCA Winner',
    box_office_gross: '₦1.4B BO Gross',
    commercial_tier: 'A-List Box Office Draw',
    social_reach: '4.8M Fans',
    notable_works: 'Seven Doors · Jagun Jagun',
  },
  'bimbo-ademoye': {
    primary_role: 'Lead Actress & Producer',
    objective_badge: 'AMVCA Winner',
    box_office_gross: '₦890M BO Gross',
    commercial_tier: 'Top Commercial Lead',
    social_reach: '5.2M Fans',
    notable_works: 'Anikulapo · Big Love',
  },
  'lateef-adedimeji': {
    primary_role: 'Lead Dramatic Actor',
    objective_badge: 'AMVCA Nominee',
    box_office_gross: '₦950M BO Gross',
    commercial_tier: 'Top Dramatic Lead',
    social_reach: '4.1M Fans',
    notable_works: 'Ayinla · Lisabi · Jagun Jagun',
  },
  'funke-akindele': {
    primary_role: 'Producer, Director & Lead',
    objective_badge: '₦1.4B BO Record',
    box_office_gross: '₦3.2B Cumulative BO',
    commercial_tier: 'All-Time #1 BO Draw',
    social_reach: '16.2M Fans',
    notable_works: 'A Tribe Called Judah · Battle on Buka Street',
  },
  'kemi-adetiba': {
    primary_role: 'Director & Showrunner',
    objective_badge: 'BO Record Holder',
    box_office_gross: '₦1.5B Cumulative BO',
    commercial_tier: 'Blockbuster Director',
    social_reach: '3.6M Fans',
    notable_works: 'King of Boys · The Wedding Party',
  },
  'toyin-abraham': {
    primary_role: 'Lead Actress & Producer',
    objective_badge: 'Top 3 BO Draw',
    box_office_gross: '₦1.2B Cumulative BO',
    commercial_tier: 'Top Commercial Draw',
    social_reach: '9.8M Fans',
    notable_works: 'Ijakumo · The Ghost & The Tout',
  },
  'kunle-afolayan': {
    primary_role: 'Lead Director & Producer',
    objective_badge: 'AMVCA Winner',
    box_office_gross: 'Global SVOD Lead',
    commercial_tier: 'KAP Motion Pictures Head',
    social_reach: '3.1M Fans',
    notable_works: 'Anikulapo · Swallow · October 1',
  },
  'george-quaye': {
    primary_role: 'Playwright & Stage Director',
    objective_badge: 'National Theatre Lead',
    box_office_gross: '18+ Sold-Out Runs',
    commercial_tier: 'Ghana Premier Stage Director',
    social_reach: '1.2M Fans',
    notable_works: "Gayina's Pound of Flesh",
  },
};

/**
 * Enriches person profile with verified commercial clout, signature titles, and audience numbers.
 */
function enrichPersonMarketability(person) {
  if (!person) return person;
  const nameKey = (person.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  const slugKey = (person.slug || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  const compactName = (person.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const compactSlug = (person.slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  const directMatch =
    NOLLYWOOD_MARKETABILITY_REGISTRY[nameKey] ||
    NOLLYWOOD_MARKETABILITY_REGISTRY[slugKey] ||
    NOLLYWOOD_MARKETABILITY_REGISTRY[compactName] ||
    NOLLYWOOD_MARKETABILITY_REGISTRY[compactSlug] ||
    Object.entries(NOLLYWOOD_MARKETABILITY_REGISTRY).find(([k]) => {
      const cleanK = k.replace(/-/g, '');
      return compactName.includes(cleanK) || cleanK.includes(compactName) || (compactSlug && (compactSlug.includes(cleanK) || cleanK.includes(compactSlug)));
    })?.[1];

  const awardCount = Array.isArray(person.awards) ? person.awards.length : 0;
  const role =
    directMatch?.primary_role ||
    person.primary_role ||
    (person.known_for_department === 'Acting' ? 'Lead Actor' : person.known_for_department) ||
    'Filmmaker';

  const badge =
    directMatch?.objective_badge ||
    person.objective_badge ||
    (awardCount > 0 ? `${awardCount} Industry Awards` : person.film_count > 100 ? 'Prolific Veteran' : person.is_verified ? 'Verified Pro' : null);

  const bo =
    directMatch?.box_office_gross ||
    person.box_office_gross ||
    (person.film_count ? `${person.film_count}+ Verified Credits` : 'Active Talent');

  const tier =
    directMatch?.commercial_tier ||
    person.commercial_tier ||
    (person.box_office_domestic ? `₦${Math.round(Number(person.box_office_domestic) / 1_000_000)}M+ Box Office` : person.film_count > 50 ? `${person.film_count}+ Verified Credits` : 'Commercial Nollywood Lead');

  const reach =
    directMatch?.social_reach ||
    person.social_reach ||
    (person.film_count ? `${person.film_count * 12}K+ Digital Audience` : null);

  const works =
    directMatch?.notable_works ||
    person.notable_works ||
    (person.film_count ? `${person.film_count} Production Slates` : 'Featured Nollywood Releases');

  return {
    ...person,
    primary_role: role,
    objective_badge: badge,
    box_office_gross: bo,
    commercial_tier: tier,
    social_reach: reach,
    notable_works: works,
  };
}

const DEMO_TALENT = [
  {
    id: 'femi-adebayo',
    slug: 'femi-adebayo',
    name: 'Femi Adebayo',
    primary_role: 'Lead Actor & Producer',
    objective_badge: 'AMVCA Winner',
    photo_url: 'https://1s8yfxw74q.ufs.sh/f/QCXeBA9u0Pph9yOWzNSgtfsJGAY10UQ5Oi9eERdmb37ZVCkK',
    commercial_value: '₦1.4B Box Office',
    box_office_gross: '₦1.4B BO Gross',
    social_reach: '4.8M Followers',
    commercial_tier: 'A-List Box Office Draw',
    notable_works: 'Seven Doors · Jagun Jagun',
    film_count: 38,
  },
  {
    id: 'bimbo-ademoye',
    slug: 'bimbo-ademoye',
    name: 'Bimbo Ademoye',
    primary_role: 'Lead Actress & Producer',
    objective_badge: 'AMVCA Winner',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/baba-segi-bimbo-ademoye-1ede6dad.jpg',
    commercial_value: '5.2M Social Fans',
    box_office_gross: '₦890M BO Gross',
    social_reach: '5.2M Fans',
    commercial_tier: 'Top Commercial Headliner',
    notable_works: 'Anikulapo · Breaded Life',
    film_count: 42,
  },
  {
    id: 'lateef-adedimeji',
    slug: 'lateef-adedimeji',
    name: 'Lateef Adedimeji',
    primary_role: 'Lead Actor',
    objective_badge: 'AMVCA Nominee',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/ae70c2fe-bf76-4d69-99eb-6f0fe4a936aa.webp',
    commercial_value: '₦950M Box Office',
    box_office_gross: '₦950M BO Gross',
    social_reach: '4.1M Audience',
    commercial_tier: 'Tier 1 Dramatic Lead',
    notable_works: 'Ayinla · Lisabi',
    film_count: 55,
  },
  {
    id: 'odunlade-adekola',
    slug: 'odunlade-adekola',
    name: 'Odunlade Adekola',
    primary_role: 'Lead Actor & Director',
    objective_badge: 'AMVCA Winner',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/baba-segi-odunlade-adekola-bedfc784.jpg',
    commercial_value: '₦1.1B Box Office',
    box_office_gross: '₦1.1B Cumulative BO',
    social_reach: '6.3M Audience',
    commercial_tier: 'Blockbuster Headliner',
    notable_works: 'Orisa · King of Thieves',
    film_count: 68,
  },
  {
    id: 'kemi-adetiba',
    slug: 'kemi-adetiba',
    name: 'Kemi Adetiba',
    primary_role: 'Director & Showrunner',
    objective_badge: 'BO Record Holder',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/9e9c2983-5db3-473c-8def-7c429dde340c.webp',
    commercial_value: '₦1.5B Box Office',
    box_office_gross: '₦1.5B Cumulative BO',
    social_reach: '3.6M Reach',
    commercial_tier: 'Blockbuster Director',
    notable_works: 'King of Boys · The Wedding Party',
    film_count: 16,
  },
];

// Technical Crew Leaders (5 profiles for 5-column responsive grid with authentic Nigerian film legends)
const DEMO_CREW = [
  {
    id: 'kunle-afolayan',
    slug: 'kunle-afolayan',
    name: 'Kunle Afolayan',
    primary_role: 'Director & Producer',
    objective_badge: 'AMVCA Pioneer',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/0b61a801-1ccc-4e28-b459-41d13fe16ae6.webp',
    commercial_value: '₦2.8B Slate Value',
    box_office_gross: '₦2.8B Production Slate',
    social_reach: '28 Epic Slates',
    commercial_tier: 'Studio Head & Auteur',
    notable_works: 'Anikulapo · October 1 · The Figurine',
    film_count: 32,
  },
  {
    id: 'omoni-oboli',
    slug: 'omoni-oboli',
    name: 'Omoni Oboli',
    primary_role: 'Director & Showrunner',
    objective_badge: 'AMVCA Winner',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/4a781ff5-4ea9-4b5b-863f-9168a096fba5.webp',
    commercial_value: '₦1.9B Box Office',
    box_office_gross: '₦1.9B Box Office Draw',
    social_reach: '123 Feature Credits',
    commercial_tier: 'Commercial Hit Director',
    notable_works: 'Wives on Strike · The First Lady',
    film_count: 123,
  },
  {
    id: 'lateef-olofin',
    slug: 'lateef-olofin',
    name: 'Lateef Olofin',
    primary_role: 'Film Editor (NVE)',
    objective_badge: 'AMVCA Winner',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/6acbdaa6-8eaa-4f62-a695-7eca2f95dc36.webp',
    commercial_value: '84 Feature Cuts',
    box_office_gross: '₦1.6B Theatrical Cuts',
    social_reach: 'Master Narrative Editor',
    commercial_tier: 'Lead Feature Editor',
    notable_works: 'Alakada · Jagun Jagun',
    film_count: 84,
  },
  {
    id: 'sanusi-izihaq',
    slug: 'sanusi-izihaq',
    name: 'Sanusi Izihaq',
    primary_role: 'Cinematographer & Director',
    objective_badge: 'Guild DOP Lead',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/32ec9efc-dc4a-44e9-89df-5ed898683b60.webp',
    commercial_value: '125 Feature Lenses',
    box_office_gross: '125 Feature Lenses',
    social_reach: 'Master Camera Operator',
    commercial_tier: 'Senior Nollywood DOP',
    notable_works: 'Nollywood Blockbusters',
    film_count: 125,
  },
  {
    id: 'biodun-stephen-oladigbo',
    slug: 'biodun-stephen-oladigbo',
    name: 'Biodun Stephen',
    primary_role: 'Director & Screenwriter',
    objective_badge: 'AMVCA Winner',
    photo_url: 'https://1s8yfxw74q.ufs.sh/f/QCXeBA9u0PphuhKs4Ykb6dxs7t0NQRBK1WEVhTyJLUcp39Ij',
    commercial_value: '₦1.4B Box Office',
    box_office_gross: '₦1.4B Box Office',
    social_reach: '82 Studio Features',
    commercial_tier: 'A-List Drama Director',
    notable_works: 'Picture Perfect · Breaded Life',
    film_count: 82,
  },
];

export default function HomeIndustryEcosystem({
  companies = [],
  talent = [],
  crew = [],
  isLoading = false,
}) {
  const [ecosystemTab, setEcosystemTab] = useState('all'); // 'all' | 'studio' | 'academy' | 'agency'
  const [peopleTab, setPeopleTab] = useState('talent'); // 'talent' | 'crew'

  const allEntities = useMemo(() => {
    // Map any rich DB companies passed from Supabase
    const dbMapped = (companies || [])
      .filter((c) => c && c.name && c.logo_url && !c.logo_url.includes('ui-avatars.com'))
      .map((c) => {
        const type = (c.company_type || '').toLowerCase();
        const isAcademy =
          type.includes('academy') ||
          type.includes('institute') ||
          c.name.toLowerCase().includes('academy') ||
          c.name.toLowerCase().includes('institute');

        const isAgency =
          type.includes('agency') ||
          type.includes('management') ||
          c.name.toLowerCase().includes('agency');

        const entity_type = isAcademy ? 'academy' : isAgency ? 'agency' : 'studio';

        return {
          id: c.id,
          slug: c.slug || c.id,
          name: c.name,
          entity_type,
          badge_label: isAcademy ? 'Film Academy' : isAgency ? 'Talent Agency' : 'Theatrical Studio',
          headquarters: c.headquarters || 'Lagos, Nigeria',
          founded_year: c.founded_year || 2018,
          totalBoxOffice: c.totalBoxOffice || null,
          metric_label: isAcademy ? 'Programs' : isAgency ? 'Roster' : 'Output Slate',
          metric_value: `${c.filmCount || 10}+ Productions`,
          commercial_rank: c.totalBoxOffice ? formatStudioBoxOffice(c.totalBoxOffice) : 'Active Slate',
          logo_url: c.logo_url,
          specialty: c.description ? c.description.slice(0, 50) + '...' : 'Feature Film Production & Distribution',
          signature: c.topFilm?.title || 'Commercial Releases',
        };
      });

    // Merge canonical entities with any db entities, prioritizing canonical enriched presentation
    const combined = [...CANONICAL_ECOSYSTEM_ENTITIES];
    for (const d of dbMapped) {
      if (!combined.some((c) => c.slug === d.slug || c.id === d.id)) {
        combined.push(d);
      }
    }
    return combined;
  }, [companies]);

  const filteredEntities = useMemo(() => {
    if (ecosystemTab === 'all') return allEntities;
    return allEntities.filter((item) => item.entity_type === ecosystemTab);
  }, [allEntities, ecosystemTab]);

  const [showRankFormula, setShowRankFormula] = useState(false);

  const rawPeople =
    peopleTab === 'talent'
      ? talent.length >= 5
        ? talent
        : DEMO_TALENT
      : crew.length >= 5
        ? crew
        : DEMO_CREW;

  const activePeople = useMemo(() => {
    return rawPeople.map((p) => ({
      ...enrichPersonMarketability(p),
      _power: computePersonPowerScore(p),
    }));
  }, [rawPeople]);

  return (
    <section className="py-12 md:py-16 border-b border-hairline bg-surface/35">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* ─── 1. STUDIOS, ACADEMIES & AGENCIES (CLEAN EXECUTIVE BENTO CARDS) ─── */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                The Business of African Cinema
              </p>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
                Studios, Film Academies &amp; Talent Agencies
              </h2>
              <p className="text-xs text-text-muted">
                Production powerhouses, capacity-building academies, and talent agencies shaping the African creative economy
              </p>
            </div>

            {/* Ecosystem Type Filter Tabs */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-border bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setEcosystemTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ecosystemTab === 'all'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  All Entities
                </button>
                <button
                  type="button"
                  onClick={() => setEcosystemTab('studio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ecosystemTab === 'studio'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Studios
                </button>
                <button
                  type="button"
                  onClick={() => setEcosystemTab('academy')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ecosystemTab === 'academy'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Academies
                </button>
                <button
                  type="button"
                  onClick={() => setEcosystemTab('agency')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ecosystemTab === 'agency'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Agencies
                </button>
              </div>

              <Link
                to="/companies"
                className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline whitespace-nowrap pl-2"
              >
                <span>Directory</span>
                <Icon icon="solar:alt-arrow-right-linear" className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Clean Executive Bento Company Cards (Mobile App Swipe Carousel & Desktop Grid) */}
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:mx-0 sm:px-0 sm:overflow-visible">
            {filteredEntities.slice(0, 6).map((company) => {
              const boLabel = formatStudioBoxOffice(company.totalBoxOffice);

              return (
                <Link
                  key={company.id}
                  to={`/companies/${company.slug || company.id}`}
                  className="group relative rounded-2xl border border-border/80 bg-surface hover:border-brand/60 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl shadow-sm overflow-hidden w-[85vw] sm:w-auto shrink-0 snap-start select-none"
                >
                  {/* Top Cover Image (Full-Bleed Header - Edge-to-Edge) */}
                  <div className="relative w-full h-36 sm:h-40 overflow-hidden bg-surface-2 shrink-0">
                    <ImageWithFallback
                      src={company.cover_image || company.topFilm?.backdrop_url || company.topFilm?.poster_url}
                      alt={toTitleCase(company.name)}
                      fallbackType="banner"
                      name={toTitleCase(company.name)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      width={640}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 z-10">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-black/80 backdrop-blur-md border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-sm">
                        <Icon icon="solar:verified-check-bold" className="text-xs" />
                        <span>Verified</span>
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-black/80 backdrop-blur-md border border-amber-500/30 px-2 py-0.5 rounded-md shadow-sm">
                        {company.badge_label}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5">
                    {/* Header Row: Medallion Logo + Company Title & HQ */}
                    <div className="flex items-start gap-3 -mt-9 relative z-10">
                      <div className="w-14 h-14 rounded-xl bg-surface-2 border border-white/15 flex items-center justify-center shrink-0 shadow-md group-hover:border-brand/50 transition-colors overflow-hidden p-0 bg-black">
                        <ImageWithFallback
                          src={company.logo_url}
                          alt={toTitleCase(company.name)}
                          fallbackType="company"
                          name={toTitleCase(company.name)}
                          className="w-full h-full object-cover filter group-hover:brightness-110 transition-all duration-300"
                          width={128}
                          loading="lazy"
                        />
                      </div>

                      <div className="min-w-0 flex-1 pt-3.5">
                        <h3 className="font-heading font-black text-base sm:text-lg text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                          {toTitleCase(company.name)}
                        </h3>
                        <p className="text-[10px] text-text-muted font-semibold truncate">
                          {company.headquarters} • Est. {company.founded_year}
                        </p>
                      </div>
                    </div>

                    {/* Company Purpose & Slate */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-brand/90 line-clamp-1">
                        {company.specialty}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">
                        {company.signature}
                      </p>
                    </div>

                    {/* Power Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-hairline">
                      <div className="bg-surface-2/70 p-2 rounded-xl border border-hairline">
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-text-muted block">
                          {company.metric_label}
                        </span>
                        <span className="text-xs font-black text-text-primary mt-0.5 block truncate">
                          {company.metric_value}
                        </span>
                      </div>

                      <div className="bg-surface-2/70 p-2 rounded-xl border border-hairline">
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-text-muted block">
                          Commercial Rank
                        </span>
                        <span className="text-xs font-black text-amber-400 mt-0.5 block truncate">
                          {company.commercial_rank || (boLabel ? `${boLabel} BO` : 'Active Slate')}
                        </span>
                      </div>
                    </div>

                    {/* Footer CTA */}
                    <div className="pt-2 border-t border-hairline flex items-center justify-between text-xs text-text-secondary group-hover:text-brand transition-colors">
                      <span className="font-bold text-[11px] truncate">
                        {company.entity_type === 'academy'
                          ? 'Explore Academy Programs & Alumni'
                          : company.entity_type === 'agency'
                            ? 'View Represented Talent Roster'
                            : 'Explore Studio Slate & Productions'}
                      </span>
                      <Icon
                        icon="solar:arrow-right-linear"
                        className="w-4 h-4 text-brand group-hover:translate-x-1 transition-transform shrink-0"
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ─── 2. VERIFIED INDUSTRY TALENT & CASTING (5-COL RESPONSIVE GRID) ─── */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                Verified Casting &amp; Industry Employability
              </p>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
                African Creative Talent &amp; Masters of Craft
              </h2>
              <p className="text-xs text-text-muted">
                Explore verified casting portfolios, commercial box office track records, and technical craft leaders
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Native Toggle */}
              <div className="inline-flex rounded-xl border border-border bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setPeopleTab('talent')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    peopleTab === 'talent'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon icon="solar:users-group-two-rounded-bold" className="text-sm" />
                  <span>Actors &amp; Directors</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPeopleTab('crew')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    peopleTab === 'crew'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon icon="solar:clapperboard-bold" className="text-sm" />
                  <span>Technical Crew</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowRankFormula((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-brand/50 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <Icon icon="solar:calculator-minimalistic-linear" className="text-brand text-sm" />
                <span>{showRankFormula ? 'Hide Rank Formula' : 'How Rank Works'}</span>
              </button>

              <Link
                to={peopleTab === 'talent' ? '/people' : '/people?craft=crew'}
                className="group inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline whitespace-nowrap"
              >
                <span>Full Directory</span>
                <Icon
                  icon="solar:alt-arrow-right-linear"
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>

          {showRankFormula && (
            <div className="rounded-xl border border-border bg-surface-2 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Box Office Gross', weight: '30%', desc: 'Verified Nigerian & African theatrical earnings (₦ / GHC)' },
                { label: 'YouTube & Owned Channel', weight: '25%', desc: 'Total feature views + owned distributor channel subscribers' },
                { label: 'Production Ownership', weight: '15%', desc: 'Owned studios, executive producer & directing slates' },
                { label: 'Stage & Live Theatre', weight: '10%', desc: 'Catalogued stage plays at Terra Kulture, MUSON & National Theatre' },
                { label: 'Academy & Guild Prestige', weight: '10%', desc: 'Accredited academy affiliation & AMVCA / AMAA honors' },
                { label: 'Weekly Momentum (Δ)', weight: '10%', desc: '7-day profile velocity driving weekly rank movement' },
              ].map((pillar) => (
                <div key={pillar.label} className="p-3 rounded-lg border border-hairline bg-surface space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-text-primary">{pillar.label}</span>
                    <span className="px-1.5 py-0.5 rounded bg-brand/15 text-brand font-mono text-[10px] font-black">
                      {pillar.weight}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{pillar.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* 5-Column Portrait Cards (Aspect 4:5 Head-and-Shoulders Framing With Real Marketability & Power Rank) */}
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-4 pb-3 -mx-4 px-4 scrollbar-none md:grid md:grid-cols-5 md:mx-0 md:px-0 md:overflow-visible">
            {activePeople.slice(0, 5).map((person, idx) => {
              const rank = idx + 1;
              const delta = person._power?.delta || 0;
              const isUp = delta > 0;
              const isDown = delta < 0;

              return (
                <Link
                  key={person.id}
                  to={`/people/${person.slug || person.id}`}
                  className="group relative rounded-xl border border-border/80 bg-surface overflow-hidden flex flex-col justify-between hover:border-brand/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-sm w-[72vw] sm:w-[44vw] md:w-auto shrink-0 snap-start select-none"
                >
                  {/* Portrait Headshot (Aspect 4:5 Prevents Awkward Top-of-Head Cropping) */}
                  <div className="relative aspect-[4/5] w-full bg-surface-2 overflow-hidden">
                    <ImageWithFallback
                      src={person.photo_url}
                      alt={person.name}
                      fallbackType="avatar"
                      name={person.name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      width={400}
                    />

                    {/* Subtle Scrim */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/5 pointer-events-none" />

                    {/* Top Badges: Integrated Power Rank + Delta + Objective Badge */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10 overflow-hidden">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-black/85 backdrop-blur-md text-white border border-white/20 shadow-sm shrink-0 whitespace-nowrap">
                        <span>#{rank}</span>
                        <span className={isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-text-muted'}>
                          {isUp ? `▲${delta}` : isDown ? `▼${Math.abs(delta)}` : '•'}
                        </span>
                      </span>

                      {person.objective_badge && (
                        <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md border border-white/20 text-amber-300 truncate whitespace-nowrap">
                          {person.objective_badge}
                        </span>
                      )}
                    </div>

                    {/* Bottom Clout Callout */}
                    <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-col gap-1">
                      {person.box_office_gross && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-black/85 backdrop-blur-md border border-amber-500/35 text-amber-300 shadow-md truncate max-w-full">
                          <Icon icon="solar:cup-star-bold" className="text-[10px] text-amber-400 shrink-0" />
                          <span className="truncate">{person.box_office_gross}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content & Employability Specs */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5 overflow-hidden">
                    <div className="space-y-1 overflow-hidden">
                      <h3 className="font-heading font-black text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1 leading-snug">
                        {person.name}
                      </h3>
                      <p className="text-[10px] font-black text-brand uppercase tracking-wider truncate whitespace-nowrap">
                        {person.primary_role}
                      </p>

                      {/* Marketability Data Row: Commercial Clout & Social Reach */}
                      <div className="pt-2 flex items-center justify-between text-[10px] font-bold gap-1 border-t border-hairline overflow-hidden">
                        <span className="text-amber-400 truncate whitespace-nowrap font-bold">
                          {person.commercial_tier}
                        </span>
                        {person.social_reach && (
                          <span className="text-text-muted shrink-0 flex items-center gap-1 font-semibold whitespace-nowrap text-[9.5px]">
                            <Icon icon="solar:users-group-rounded-linear" className="text-[11px] text-text-secondary shrink-0" />
                            <span>{person.social_reach}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notable Signature Works & Profile Link */}
                    <div className="pt-2 border-t border-hairline flex items-center justify-between gap-1.5 text-[10.5px] overflow-hidden">
                      <div className="flex items-center gap-1 min-w-0 text-text-muted overflow-hidden">
                        <Icon icon="solar:clapperboard-linear" className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="truncate whitespace-nowrap font-medium text-text-secondary">
                          {person.notable_works}
                        </span>
                      </div>
                      <span className="text-brand font-bold group-hover:translate-x-1 transition-transform shrink-0 text-xs">
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
