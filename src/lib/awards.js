import { supabase } from './supabase';

/**
 * Ceremony & Festival catalogue for the Awards Directory and Details pages.
 * Enriched with location, categories, entry plans, submission timelines, and official portals.
 */
export const AWARD_ORGS = [
  {
    id: 'AMVCA',
    label: 'AMVCA',
    full: 'Africa Magic Viewers’ Choice Awards',
    tagline: 'Africa’s Biggest Film and Television Honours',
    category: 'academy',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (May)',
    founded: 2013,
    accent: '#FF5A1F',
    about:
      'Africa’s biggest film and television night — a prestigious blend of academy jury categories and continental audience voting that crowns the year’s most watched and critically celebrated work across African cinema and TV.',
    when:
      'Usually held in Lagos in May. Call for entries typically opens in January and runs into mid‑February for titles released in the previous calendar year.',
    submissions:
      'Filmmakers and TV producers submit online via the official Africa Magic portal with a full preview copy as screened or broadcast. Feature films require a cinema, TV, or streaming release in the eligibility window. Categories include indigenous-language awards alongside mainstream film and series prizes.',
    entryPlan: {
      fees: 'Free Entry',
      eligibility: 'Films, TV series, and shorts released or broadcast within the prior calendar year.',
      formats: 'Full HD / 4K digital screener (MP4/MOV) with English subtitles.',
      categoriesCount: '30+ Competitive Categories',
      platform: 'Official Africa Magic Portal',
    },
    submitUrl: 'https://www.africamagic.tv/amvca',
    submitLabel: 'AMVCA Submission Portal',
    tags: ['Lagos', 'Academy', 'TV & Cinema', 'Viewers Choice', 'Pan-African', 'Multichoice'],
  },
  {
    id: 'AMAA',
    label: 'AMAA',
    full: 'Africa Movie Academy Awards',
    tagline: 'The African Oscars — Academy Excellence in Craft & Cinema',
    category: 'academy',
    location: 'Lagos, Nigeria (Pan-African Host)',
    frequency: 'Annual (October / November)',
    founded: 2005,
    accent: '#C9A227',
    about:
      'Founded by Peace Anyiam-Osigwe, AMAA is the premier academy honouring cinematic craft across acting, directing, screenwriting, cinematography, sound, and technical categories across the entire African continent and the diaspora.',
    when:
      'The ceremony lands in the second half of the year (October/November), following an extensive nomination cycle that reviews the previous year’s theatrical and festival slate.',
    submissions:
      'Eligible titles are submitted by producers or distributors during the academy’s open call. Features, shorts, animations, and documentaries must meet theatrical or festival exhibition rules for the award year.',
    entryPlan: {
      fees: 'Free / Low Administrative Fee',
      eligibility: 'African and Diaspora feature films, documentaries, shorts, and animations released within 18 months of call.',
      formats: 'Secure online screener (Vimeo/FilmFreeway/Portal) with English subtitles.',
      categoriesCount: '26 Academy Categories',
      platform: 'AMAA Academy Portal & FilmFreeway',
    },
    submitUrl: 'https://ama-awards.com/',
    submitLabel: 'AMAA Official Portal',
    tags: ['Pan-African', 'Academy', 'Cinema', 'Craft', 'Directing', 'Diaspora'],
  },
  {
    id: 'AFRIFF',
    label: 'AFRIFF',
    full: 'Africa International Film Festival',
    tagline: 'Bridging African Cinema to the Global Industry',
    category: 'festival',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (November)',
    founded: 2010,
    accent: '#3B82F6',
    about:
      'Founded by Chioma Ude, AFRIFF is West Africa’s flagship international film festival and market, drawing international filmmakers, Hollywood executives, streaming buyers, masterclasses, and competitive Globe Awards.',
    when:
      'Held annually every November in Lagos, Nigeria. Submissions open early spring and close late summer.',
    submissions:
      'Open to African, Diaspora, and international feature films, short films, feature documentaries, student cinema, animations, and virtual reality narratives.',
    entryPlan: {
      fees: 'Tiered by Deadline (Early / Regular / Late)',
      eligibility: 'Completed within 24 months preceding the festival. Nigerian, African, and international premieres prioritized.',
      formats: 'DCP for screenings; password-protected online screener for jury evaluation.',
      categoriesCount: 'Globe Awards across 14 Categories',
      platform: 'FilmFreeway',
    },
    submitUrl: 'https://filmfreeway.com/AfricaInternationalFilmFestival',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Lagos', 'Film Festival', 'International', 'Market', 'Globe Awards', 'Masterclasses'],
  },
  {
    id: 'AIFF',
    label: 'AIFF',
    full: 'Abuja International Film Festival',
    tagline: 'West Africa’s Longest-Running Independent Festival',
    category: 'festival',
    location: 'Abuja, Nigeria',
    frequency: 'Annual (October / November)',
    founded: 2004,
    accent: '#059669',
    about:
      'One of West Africa’s longest-running international film festivals, founded in 2004 by Fidelis Duker, celebrating Nigerian, African, and international cinema across competitive feature, documentary, acting, and craft categories at Silverbird Cinemas Abuja.',
    when:
      'Annual festival held in October / November in Abuja, Nigeria, featuring screenings, masterclasses, and the Golden Jury Awards.',
    submissions:
      'Submissions open annually via FilmFreeway and the official AIFF portal for feature films, shorts, documentaries, animations, and student/experimental cinema.',
    entryPlan: {
      fees: 'Standard Festival Fee ($15 – $40 on FilmFreeway)',
      eligibility: 'Features, shorts, documentaries, student cinema completed in the last 2 years.',
      formats: 'MP4 / MOV screener with burnt-in or selectable English subtitles.',
      categoriesCount: '18 Competitive Categories',
      platform: 'FilmFreeway & AIFF Portal',
    },
    submitUrl: 'https://filmfreeway.com/AbujaInternationalFilmFestival',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Abuja', 'Film Festival', 'International', 'Golden Jury', 'Independent'],
  },
  {
    id: 'ZUFF',
    label: 'ZUMA',
    full: 'Zuma Film Festival',
    tagline: 'Nigeria’s National Film Festival by Nigerian Film Corporation',
    category: 'festival',
    location: 'Abuja, Nigeria',
    frequency: 'Annual (December)',
    founded: 2000,
    accent: '#EA580C',
    about:
      'Nigeria’s official national film festival, organized annually by the Nigerian Film Corporation (NFC), celebrating artistic excellence, cultural heritage, and indigenous storytelling across Africa and the diaspora.',
    when:
      'Annual national festival held in December in Abuja, hosted by the Nigerian Film Corporation.',
    submissions:
      'Open to Nigerian, African, and international entries across feature films, documentaries, student cinema, indigenous language films, animations, and shorts via FilmFreeway and the official NFC portal.',
    entryPlan: {
      fees: 'Free / Subsidized Entry',
      eligibility: 'African and international films; special focus on national co-productions and emerging talent.',
      formats: 'HD Screener / DCP.',
      categoriesCount: 'Zuma Awards in 15 Categories',
      platform: 'FilmFreeway & NFC Portal',
    },
    submitUrl: 'https://zumafilmfest.com/',
    submitLabel: 'Zuma Festival Portal',
    tags: ['Abuja', 'National Festival', 'NFC', 'Government', 'Cultural Heritage'],
  },
  {
    id: 'YOMAFA',
    label: 'YOMAFA',
    full: 'Yomafa Global Awards',
    tagline: 'Pan-African Audience Honours & Heritage Gala',
    category: 'academy',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (Season Cycle)',
    founded: 2008,
    accent: '#FAB80F',
    about:
      'Pan-African showbiz honours spanning film, music, media and culture — audience voting across dozens of categories each season, celebrating stars, veteran trailblazers, and fan-favorite cinema.',
    when:
      'Voting is live on yomafaglobal.com during the season cycle. Past seasons are archived with gala award presentations.',
    submissions:
      'Nominees are registered through the Yomafa platform during the open nomination window each season.',
    entryPlan: {
      fees: 'Nomination Registration',
      eligibility: 'Nollywood and Pan-African performers, movies, music, and media personalities active during the season.',
      formats: 'Digital nomination form and reel submission.',
      categoriesCount: '40+ Audience & Jury Categories',
      platform: 'Yomafa Official Platform',
    },
    submitUrl: 'https://yomafaglobal.com/',
    submitLabel: 'Yomafa Global Portal',
    tags: ['Lagos', 'Showbiz', 'Audience Voting', 'Music & Film', 'Cultural'],
  },
  {
    id: 'BON',
    label: 'BON',
    full: 'Best of Nollywood Awards',
    tagline: 'Celebrating The Very Best in English & Indigenous Nollywood',
    category: 'academy',
    location: 'Rotating Nigerian State Hosts',
    frequency: 'Annual (November / December)',
    founded: 2009,
    accent: '#10B981',
    about:
      'Founded by Seun Oloketuyi, Best of Nollywood (BON) is one of Nigeria’s premier film award bodies honoring technical craft, lead acting, and supporting performances across Indigenous (Yoruba, Hausa, Igbo) and English-language Nollywood cinema.',
    when:
      'Annual ceremony held late in the year (November/December). Honors theatrical, streaming, and television films released in the eligibility window.',
    submissions:
      'Producers submit physical and digital film screeners to the BON jury screening panel during the open call window.',
    entryPlan: {
      fees: 'Free Producer Entry',
      eligibility: 'Nigerian feature films released theatrically or on streaming in the award year.',
      formats: 'HD Digital screener or physical preview copy.',
      categoriesCount: '25+ Acting & Technical Prizes',
      platform: 'BON Secretariat',
    },
    submitUrl: 'https://www.instagram.com/bonawards/',
    submitLabel: 'BON Awards Channel',
    tags: ['Nollywood', 'Indigenous', 'Yoruba', 'Hausa', 'Igbo', 'Craft'],
  },
  {
    id: 'KILAF',
    label: 'KILAF',
    full: 'Kano Indigenous Languages of Africa Film Festival',
    tagline: 'Elevating Native African Language Cinema & Heritage',
    category: 'indigenous',
    location: 'Kano, Nigeria',
    frequency: 'Annual (November)',
    founded: 2018,
    accent: '#7C3AED',
    about:
      'An annual pan-African film market and festival in Kano, Nigeria, founded by Alhaji Abdul-Kareem Mohammed, dedicated to celebrating, marketing, and elevating cinematic storytelling produced in native African indigenous languages.',
    when:
      'Annual festival and market held in November in Kano, Nigeria, featuring continental film screenings, academic symposia, and grand awards.',
    submissions:
      'Open to African indigenous language features, shorts, documentaries, student films, and animations through FilmFreeway and the official KILAF portal.',
    entryPlan: {
      fees: 'Free / Low Fee',
      eligibility: 'Must be produced in an indigenous African language (with English subtitles).',
      formats: 'Full HD Screener / MP4 with English subtitles.',
      categoriesCount: '16 Language & Technical Prizes',
      platform: 'FilmFreeway & KILAF Portal',
    },
    submitUrl: 'https://kilaf.org/',
    submitLabel: 'KILAF Official Portal',
    tags: ['Kano', 'Indigenous', 'Hausa', 'Language Film', 'Market', 'Symposia'],
  },
  {
    id: 'KADIFF',
    label: 'KADIFF',
    full: 'Kaduna International Film Festival',
    tagline: 'Cinema for Social Change & Northern African Storytelling',
    category: 'festival',
    location: 'Kaduna, Nigeria',
    frequency: 'Annual (August)',
    founded: 2018,
    accent: '#0284C7',
    about:
      'An annual international film festival founded by Israel Kashim Audu in Kaduna, Nigeria, dedicated to using cinema as a tool for social change, celebrating African narratives, and fostering emerging and veteran filmmakers across the globe.',
    when:
      'Annual festival held in August in Kaduna, Nigeria, featuring masterclasses, screenings, and gala excellence awards.',
    submissions:
      'Open to international and African feature films, documentaries, short films, student cinema, animations, and indigenous language productions via FilmFreeway and the official festival website.',
    entryPlan: {
      fees: 'Standard Entry ($10 – $25)',
      eligibility: 'Narrative features, shorts, documentaries, student work produced within 2 years.',
      formats: 'HD screener with English subtitles.',
      categoriesCount: '15 Competitive Awards',
      platform: 'FilmFreeway',
    },
    submitUrl: 'https://www.kadunafilmfestival.com/',
    submitLabel: 'KADIFF Official Portal',
    tags: ['Kaduna', 'Film Festival', 'Social Change', 'Masterclasses', 'Northern Nigeria'],
  },
  {
    id: 'CCFF',
    label: 'CCFF',
    full: 'Coal City Film Festival',
    tagline: 'Celebrating Cinema in the Historic Cradle of Nollywood',
    category: 'festival',
    location: 'Enugu, Nigeria',
    frequency: 'Annual (March / April)',
    founded: 2021,
    accent: '#D97706',
    about:
      'An annual international film festival founded by filmmaker Uche Agbo in Enugu, Nigeria—the historic coal city and cradle of Nollywood—celebrating African and global cinema, cultural tourism, and industry legends.',
    when:
      'Annual festival held in March / April in Enugu, Nigeria, featuring city tours, screenings, masterclasses, and the Hall of Fame gala.',
    submissions:
      'Open to African and international feature films, documentaries, shorts, animations, and student cinema via FilmFreeway and the official CCFF portal.',
    entryPlan: {
      fees: 'Standard Entry Fee ($15 – $30)',
      eligibility: 'Features, shorts, documentaries, student projects from anywhere in the world.',
      formats: 'MP4 / MOV screener; DCP for theatrical showcases.',
      categoriesCount: '14 Festival Categories',
      platform: 'FilmFreeway',
    },
    submitUrl: 'https://coalcityfilmfestival.org/',
    submitLabel: 'CCFF Official Portal',
    tags: ['Enugu', 'Film Festival', 'Cradle of Nollywood', 'Eastern Nigeria', 'Tourism'],
  },
  {
    id: 'GOLDEN_STARS',
    label: 'Golden Stars',
    full: 'Golden Stars Awards',
    tagline: 'Honouring Outstanding Performance in Nollywood & Media',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (June / July)',
    founded: 2019,
    accent: '#F59E0B',
    about:
      'Annual African entertainment and industry honours recognizing excellence across acting, Nollywood performances, music, and media personalities in Lagos, Nigeria.',
    when:
      'Annual ceremony held mid-year in Lagos. Past winners include prominent Nollywood actors, producers, and entertainment leaders.',
    submissions:
      'Nominees are registered and accredited via the official Golden Stars Awards platform.',
    entryPlan: {
      fees: 'Accreditation / Entry by nomination',
      eligibility: 'Active Nigerian and African actors, creators, and cinema personalities.',
      formats: 'Digital portfolio / video reel.',
      categoriesCount: '20+ Acting & Media Prizes',
      platform: 'Golden Stars Portal',
    },
    submitUrl: 'https://goldenstarsaward.com/',
    submitLabel: 'Golden Stars Portal',
    tags: ['Lagos', 'Entertainment', 'Acting', 'Celebrity', 'Media'],
  },
  {
    id: 'LIFACC',
    label: 'LIFACC',
    full: 'Lagos International Film and Cinema Convention',
    tagline: 'The Business, Distribution & Infrastructure Honours',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (July)',
    founded: 2023,
    accent: '#14B8A6',
    about:
      'Industry-facing honours recognizing the business, exhibition, distribution, infrastructure, leadership, and regulatory work that powers African cinema.',
    when:
      'Held as part of the Lagos International Film and Cinema Convention in July in Lagos.',
    submissions:
      'LIFACC recognition categories are announced by the convention organisers and focus on measurable industry contribution rather than open public voting.',
    entryPlan: {
      fees: 'Convention Nomination',
      eligibility: 'Cinemas, distributors, technology companies, film executives, and industry pioneers.',
      formats: 'Corporate / exhibition metrics and portfolio.',
      categoriesCount: '12 Industry Achievement Awards',
      platform: 'LIFACC Secretariat',
    },
    submitUrl: 'https://lifacc.com/',
    submitLabel: 'LIFACC Official Portal',
    tags: ['Lagos', 'Cinema Business', 'Exhibition', 'Distribution', 'Convention'],
  },
  {
    id: 'WRIFF',
    label: 'WRIFF',
    full: 'Warien Rose International Film Festival',
    tagline: 'Great Stories, Global Impact & Social Justice',
    category: 'impact',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (October)',
    founded: 2020,
    accent: '#E11D48',
    about:
      'An annual international film festival in Lagos, Nigeria, founded under the Warien Rose Academy and Foundation by Prof. Doc. Efe Anaughe, championing "Great Stories, Global Impact" and celebrating films that spotlight social justice, cultural preservation, and transformative African narratives.',
    when:
      'Annual international film festival hosted in Lagos, Nigeria, featuring screenings, masterclasses, and social impact awards.',
    submissions:
      'Open to feature films, documentaries, shorts, and advocacy cinema via the Warien Rose Academy portal and FilmFreeway.',
    entryPlan: {
      fees: 'Standard Entry ($10 – $35)',
      eligibility: 'Impact features, documentaries, women-led cinema, student films.',
      formats: 'Digital screener with English subtitles.',
      categoriesCount: '15 Impact & Jury Awards',
      platform: 'FilmFreeway & WRIFF Portal',
    },
    submitUrl: 'https://www.warienroseacademy.com',
    submitLabel: 'Warien Rose Academy',
    tags: ['Lagos', 'Social Impact', 'Advocacy', 'Human Rights', 'Women in Film'],
  },
  {
    id: 'AFFIF',
    label: 'AFFIF',
    full: 'Africa Films For Impact Festival',
    tagline: 'Using Cinema as a Tool for Human Rights & Social Transformation',
    category: 'impact',
    location: 'Abuja, Nigeria',
    frequency: 'Annual (October / November)',
    founded: 2019,
    accent: '#0D9488',
    about:
      'An annual social impact film festival and fellowship organized by the Films For Impact Foundation in Abuja, Nigeria, dedicated to using cinema, human rights narratives, and advocacy as catalysts for positive social transformation.',
    when:
      'Annual festival held in October / November at Silverbird Cinemas in Abuja, Nigeria, featuring masterclasses, impact fellowships, and the Impact Awards.',
    submissions:
      'Open to narrative features, documentaries, shorts, animations, and student impact films via FilmFreeway and the official AFFIF website.',
    entryPlan: {
      fees: 'Free / Subsidized Impact Entry',
      eligibility: 'Advocacy and impact films covering SDGs, human rights, governance, and climate.',
      formats: 'HD Screener.',
      categoriesCount: '10 Impact Awards',
      platform: 'FilmFreeway & AFFIF Portal',
    },
    submitUrl: 'https://affif.org/',
    submitLabel: 'AFFIF Official Portal',
    tags: ['Abuja', 'Social Impact', 'Human Rights', 'Fellowships', 'Advocacy'],
  },
  {
    id: 'OAFP',
    label: 'OAFP',
    full: 'Odunlade Adekola Films Production Awards',
    tagline: 'Celebrating Grassroots Acting, Production Craft & Academy Cohorts',
    category: 'indigenous',
    location: 'Abeokuta, Ogun State, Nigeria',
    frequency: 'Annual (December)',
    founded: 2015,
    accent: '#6B21A8',
    about:
      'An annual film awards gala and academy convocation founded by Nollywood icon Odunlade Adekola in Abeokuta, Ogun State, established to celebrate, reward, and elevate actors, emerging talents, production crew, and veteran legends across Nigerian cinema.',
    when:
      'Annual awards gala and academy convocation held in December at the Olusegun Obasanjo Presidential Library (OOPL) and Cultural Centre in Abeokuta, Nigeria.',
    submissions:
      'Recognitions and merit awards are conferred across academy graduating cohorts, mainstream Nollywood performers, technical crew, and industry honorees by the OAFP jury.',
    entryPlan: {
      fees: 'Academy Nomination / Open Jury Selection',
      eligibility: 'OAFP academy graduates and nominated Nigerian cinema practitioners.',
      formats: 'Performance portfolio and film screener.',
      categoriesCount: '18 Merit Awards',
      platform: 'OAFP Secretariat',
    },
    submitUrl: 'https://www.instagram.com/odunomoadekola/',
    submitLabel: 'OAFP Official Channel',
    tags: ['Abeokuta', 'Yoruba Cinema', 'Acting Academy', 'Odunlade Adekola', 'Grassroots'],
  },
  {
    id: 'TINFF',
    label: 'TINFF',
    full: 'The Industry Nollywood Film Festival',
    tagline: 'Connecting Diaspora Filmmakers to Nigerian Cinema',
    category: 'festival',
    location: 'Toronto, Canada / Lagos, Nigeria',
    frequency: 'Annual (September)',
    founded: 2017,
    accent: '#E11D48',
    about:
      'A festival-and-awards platform that spotlights Nollywood and diaspora storytelling — less red‑carpet TV spectacle, more industry showcase with competitive categories for features, independent cinema, and emerging diaspora work.',
    when:
      'Festival editions and awards typically cluster mid‑year; exact dates shift by host city and edition.',
    submissions:
      'Films enter through the festival’s submission process on FilmFreeway. Accepted titles can screen in the programme and compete in TINFF award categories.',
    entryPlan: {
      fees: 'Standard Entry ($20 – $50)',
      eligibility: 'Nollywood, African, and international independent cinema.',
      formats: 'DCP / Online Screener.',
      categoriesCount: '20 Award Categories',
      platform: 'FilmFreeway',
    },
    submitUrl: 'https://filmfreeway.com/TINFF',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Diaspora', 'Toronto', 'International', 'Independent', 'Showcase'],
  },
  {
    id: 'NTFF',
    label: 'NTFF',
    full: 'Nollywood Travel Film Festival',
    tagline: 'Nigeria’s Biggest Transnational Film Festival Experience',
    category: 'festival',
    location: 'Global Tour (Toronto, Berlin, London, Oslo, Atlanta)',
    frequency: 'Annual Multi-City Tour',
    founded: 2017,
    accent: '#8B5CF6',
    about:
      'Founded by Mykel Parish Ajaere, NTFF is Nigeria’s largest travel film festival, touring world cultural hubs (Berlin, Toronto, London, Amsterdam, Atlanta) to showcase Nollywood premieres to global diaspora audiences.',
    when:
      'Tours multiple cities across the calendar year, holding special diaspora screening events and awards.',
    submissions:
      'Submissions open through FilmFreeway for premier Nigerian and African narrative films seeking international tour screenings.',
    entryPlan: {
      fees: 'Standard Tour Entry Fee ($25 – $50)',
      eligibility: 'Completed African narrative features with high theatrical quality.',
      formats: 'DCP for cinema projections.',
      categoriesCount: 'NTFF Global Honours',
      platform: 'FilmFreeway',
    },
    submitUrl: 'https://filmfreeway.com/NollywoodTravelFilmFestival',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Global Tour', 'Travel Festival', 'Diaspora', 'Berlin', 'Toronto', 'London'],
  },
  {
    id: 'ASIFF',
    label: 'ASIFF',
    full: 'African Smartphone International Film Festival',
    tagline: 'Africa’s Premier Mobile & Smartphone Cinema Showcase',
    category: 'festival',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (December)',
    founded: 2017,
    accent: '#06B6D4',
    about:
      'Founded in 2017 by Nigerian filmmaker Michael Osheku, ASIFF is Africa’s first and largest international smartphone film festival. The festival democratizes cinematic storytelling by showcasing groundbreaking narrative features, shorts, and documentaries created entirely using smartphones, mobile devices, and mobile AI.',
    when:
      'Annual 4-day international showcase held December 18–21 in Lagos, Nigeria. Features global film screenings, panel sessions, mobile tech expos, and awards gala.',
    submissions:
      'Open to African, diaspora, and global filmmakers. Entries must be filmed using mobile phones, tablets, or mobile action equipment across fiction, documentary, animation, and student categories.',
    entryPlan: {
      fees: 'Standard Entry ($15 – $35 via FilmFreeway)',
      eligibility: 'Films shot on mobile phones/tablets completed within the last 2 years. English subtitles required.',
      formats: 'HD / 4K MP4/MOV screener; ProRes/DCP for theatrical showcase.',
      categoriesCount: '16 Smartphone & Mobile Craft Categories',
      platform: 'FilmFreeway & ASIFF Portal',
    },
    submitUrl: 'https://filmfreeway.com/AfricanSmartphoneInternationalFilmFestival',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Lagos', 'Smartphone Film', 'Mobile Cinema', 'Innovation', 'FilmFreeway', 'AI & Mobile'],
  },
  {
    id: 'EKO_STAR',
    label: 'Eko Star',
    full: 'Eko Star Film & TV Awards',
    tagline: 'Spotlighting Women and Trailblazers in Nigerian Screen Industries',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Special Edition / Summit Linked',
    founded: 2021,
    accent: '#DB2777',
    about:
      'A Nigerian International Film Summit-linked recognition platform spotlighting women leaders, producers, directors, and executives across Nigerian film and television.',
    when:
      'Organized in conjunction with the Nigerian International Film Summit (NIFS) in Lagos.',
    submissions:
      'Awardee profiles are curated and published by the Nigerian International Film Summit committee.',
    entryPlan: {
      fees: 'Summit Nomination',
      eligibility: 'Women practitioners and trailblazers in African screen entertainment.',
      formats: 'Professional nomination portfolio.',
      categoriesCount: 'Special Recognition Honours',
      platform: 'NIFS Official Portal',
    },
    submitUrl: 'https://nifsummit.com/eko-star/awardees',
    submitLabel: 'Eko Star Awardees',
    tags: ['Lagos', 'Women in Film', 'NIFS', 'Leadership', 'Television & Cinema'],
  },
];

export function getAwardOrg(id) {
  if (!id) return null;
  const match =
    AWARD_ORGS.find((o) => o.id.toLowerCase() === String(id).toLowerCase()) ||
    AWARD_ORGS.find((o) => o.label.toLowerCase() === String(id).toLowerCase()) ||
    AWARD_ORGS.find((o) => o.full.toLowerCase().includes(String(id).toLowerCase()));
  if (match) return match;

  return {
    id,
    label: id,
    full: id,
    tagline: 'African Cinema Honours & Recognition',
    category: 'academy',
    location: 'Nigeria / Africa',
    frequency: 'Annual',
    founded: null,
    accent: 'var(--color-brand)',
    about: 'A recognized film, television, or cultural awards body in the MuviDB catalogue.',
    when: 'Dates and ceremony timelines vary by edition.',
    submissions: 'Submissions are administered by the organising body each season.',
    entryPlan: {
      fees: 'Check with organisers',
      eligibility: 'African and international film productions.',
      formats: 'Digital screener.',
      categoriesCount: 'Multiple Categories',
      platform: 'Official Portal',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['African Cinema', 'Honours'],
  };
}

export function normOrg(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Other';
  const upper = s.toUpperCase();
  if (upper.includes('YOMAFA') || upper.includes('YOMAFA GLOBAL')) return 'YOMAFA';
  if (upper.includes('AMVCA') || upper.includes('AFRICA MAGIC')) return 'AMVCA';
  if (upper.includes('AMAA') || upper.includes('AFRICA MOVIE ACADEMY')) return 'AMAA';
  if (upper.includes('AFRIFF') || upper.includes('AFRICA INTERNATIONAL FILM')) return 'AFRIFF';
  if (upper.includes('TINFF') || upper.includes('INDUSTRY NOLLYWOOD')) return 'TINFF';
  if (upper.includes('NTFF') || upper.includes('NOLLYWOOD TRAVEL') || upper.includes('TRAVEL FILM FESTIVAL')) return 'NTFF';
  if (upper.includes('AIFF') || upper.includes('ABUJA INTERNATIONAL') || upper.includes('ABUJA FILM')) return 'AIFF';
  if (upper.includes('ZUMA') || upper.includes('ZUFF')) return 'ZUFF';
  if (upper.includes('KILAF') || upper.includes('KANO INDIGENOUS')) return 'KILAF';
  if (upper.includes('KADIFF') || upper.includes('KADUNA INTERNATIONAL') || upper.includes('KADUNA FILM')) return 'KADIFF';
  if (upper.includes('CCFF') || upper.includes('COAL CITY')) return 'CCFF';
  if (upper.includes('WRIFF') || upper.includes('WARIEN ROSE') || upper.includes('WARIEN')) return 'WRIFF';
  if (upper.includes('AFFIF') || upper.includes('FILMS FOR IMPACT') || upper.includes('AFRICA FILMS FOR IMPACT')) return 'AFFIF';
  if (upper.includes('OAFP') || upper.includes('ODUNLADE ADEKOLA') || upper.includes('ODUNLADE')) return 'OAFP';
  if (upper.includes('GOLDEN STAR') || upper.includes('GOLDENSTARS')) return 'GOLDEN_STARS';
  if (upper.includes('BON') || upper.includes('BEST OF NOLLYWOOD')) return 'BON';
  if (upper.includes('LIFACC') || upper.includes('LAGOS INTERNATIONAL FILM AND CINEMA')) return 'LIFACC';
  if (upper.includes('ASIFF') || upper.includes('SMARTPHONE') || upper.includes('SMARTFILM')) return 'ASIFF';
  if (upper.includes('EKO STAR')) return 'EKO_STAR';
  return s;
}

async function pageTable(table, cols) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(cols)
      .not('awards', 'eq', '[]')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Flatten people.awards + films.awards into ceremony-ready rows.
 */
export async function loadAwardsCatalog() {
  const [people, films, companies, cinemas] = await Promise.all([
    pageTable('people', 'id, name, slug, photo_url, awards'),
    pageTable('films', 'id, title, slug, poster_url, year, awards'),
    pageTable('companies', 'id, name, slug, logo_url, awards'),
    pageTable('cinemas', 'id, name, city, state, logo_url, awards'),
  ]);

  const filmById = new Map(films.map((f) => [f.id, f]));
  const rows = [];
  const seen = new Set();
  const personSlots = new Set();

  const slotKey = (org, year, season, category, work) =>
    [org, year, season, category, work || ''].join('|').toLowerCase();
  const rowKey = (org, year, season, category, work, who) =>
    `${slotKey(org, year, season, category, work)}|${who || ''}`.toLowerCase();

  const filmPayload = (film, fallbackTitle) =>
    film
      ? {
          id: film.id,
          title: film.title,
          slug: film.slug,
          poster_url: film.poster_url,
          year: film.year,
        }
      : fallbackTitle
        ? { id: null, title: fallbackTitle, slug: null, poster_url: null, year: null }
        : null;

  const companyPayload = (company) =>
    company
      ? {
          id: company.id,
          name: company.name,
          slug: company.slug,
          logo_url: company.logo_url,
        }
      : null;

  const cinemaPayload = (cinema) =>
    cinema
      ? {
          id: cinema.id,
          name: cinema.name,
          city: cinema.city,
          state: cinema.state,
          logo_url: cinema.logo_url,
        }
      : null;

  for (const person of people) {
    const awards = Array.isArray(person.awards) ? person.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || a.title || '').trim() || null;
      const film = a.film_id ? filmById.get(a.film_id) : null;
      const k = rowKey(org, year, season, category, work, person.id);
      if (seen.has(k)) continue;
      seen.add(k);
      personSlots.add(slotKey(org, year, season, category, work));
      rows.push({
        org,
        year,
        season,
        category,
        work,
        won: !!a.won,
        person: {
          id: person.id,
          name: person.name,
          slug: person.slug,
          photo_url: person.photo_url,
        },
        film: film ? filmPayload(film) : filmPayload(null, work),
      });
    }
  }

  for (const film of films) {
    const awards = Array.isArray(film.awards) ? film.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || film.title || '').trim() || film.title;
      const recipients = Array.isArray(a.recipients) ? a.recipients.filter(Boolean) : [];
      const slot = slotKey(org, year, season, category, work);

      if (recipients.length === 0) {
        const k = rowKey(org, year, season, category, work, `film:${film.id}`);
        if (seen.has(k) || personSlots.has(slot)) continue;
        seen.add(k);
        rows.push({
          org,
          year,
          season,
          category,
          work,
          won: !!a.won,
          person: null,
          film: filmPayload(film),
        });
        continue;
      }

      if (personSlots.has(slot)) continue;

      for (const name of recipients) {
        const k = rowKey(org, year, season, category, work, `name:${name}`);
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push({
          org,
          year,
          season,
          category,
          work,
          won: !!a.won,
          person: { id: null, name, slug: null, photo_url: null },
          film: filmPayload(film),
        });
      }
    }
  }

  for (const company of companies) {
    const awards = Array.isArray(company.awards) ? company.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || a.title || company.name || '').trim() || null;
      const k = rowKey(org, year, season, category, work, `company:${company.id}`);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({
        org,
        year,
        season,
        category,
        work,
        won: !!a.won,
        person: null,
        film: null,
        company: companyPayload(company),
        cinema: null,
      });
    }
  }

  for (const cinema of cinemas) {
    const awards = Array.isArray(cinema.awards) ? cinema.awards : [];
    for (const a of awards) {
      const org = normOrg(a.organization);
      const year = Number(a.year) || null;
      const season = a.season != null && a.season !== '' ? Number(a.season) : null;
      const category = String(a.category || a.title || 'Award').trim();
      const work = String(a.work || a.title || cinema.name || '').trim() || null;
      const k = rowKey(org, year, season, category, work, `cinema:${cinema.id}`);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({
        org,
        year,
        season,
        category,
        work,
        won: !!a.won,
        person: null,
        film: null,
        company: null,
        cinema: cinemaPayload(cinema),
      });
    }
  }

  // Hydrate missing film posters
  const missingIds = [
    ...new Set(
      rows
        .filter((r) => r.film?.id && !r.film.poster_url && !filmById.has(r.film.id))
        .map((r) => r.film.id)
    ),
  ];
  if (missingIds.length) {
    const { data: extra } = await supabase
      .from('films')
      .select('id, title, slug, poster_url, year')
      .in('id', missingIds);
    for (const f of extra || []) filmById.set(f.id, f);
    for (const r of rows) {
      if (r.film?.id && filmById.has(r.film.id)) {
        const f = filmById.get(r.film.id);
        r.film = {
          id: f.id,
          title: f.title,
          slug: f.slug,
          poster_url: f.poster_url,
          year: f.year,
        };
      }
    }
  }

  const recordedOrgs = [...new Set(rows.map((r) => r.org))];
  const allOrgIds = [...new Set([...AWARD_ORGS.map((o) => o.id), ...recordedOrgs])];

  const orgs = allOrgIds.sort((a, b) => {
    const ai = AWARD_ORGS.findIndex((o) => o.id === a);
    const bi = AWARD_ORGS.findIndex((o) => o.id === b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });

  const years = [...new Set(rows.map((r) => r.year).filter(Boolean))].sort((a, b) => b - a);

  return {
    rows,
    orgs,
    years,
    stats: {
      people: people.length,
      films: films.length,
      companies: companies.length,
      cinemas: cinemas.length,
      entries: rows.length,
    },
  };
}

/** Group flat rows into org → year → category → { winners, nominees }. */
export function groupAwards(rows, { org, year } = {}) {
  let list = rows;
  if (org) list = list.filter((r) => r.org === org);
  if (year) list = list.filter((r) => r.year === year);

  const byCategory = new Map();
  for (const r of list) {
    const cat = r.category || 'Award';
    if (!byCategory.has(cat)) byCategory.set(cat, { category: cat, winners: [], nominees: [] });
    const bucket = byCategory.get(cat);
    if (r.won) bucket.winners.push(r);
    else bucket.nominees.push(r);
  }

  return [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category));
}
