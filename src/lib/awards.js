import { supabase } from './supabase.js';

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
    id: 'BINFF',
    label: 'BINFF',
    full: 'Brampton International Nollywood Film Festival',
    tagline: 'Spotlighting Nollywood and African Diaspora Cinema in Canada',
    category: 'festival',
    location: 'Brampton, Ontario, Canada / Nigeria',
    frequency: 'Annual (September)',
    founded: 2021,
    accent: '#D97706',
    about:
      'The Brampton International Nollywood Film Festival (BINFF) is an annual Canadian film festival and sister platform to TINFF, dedicated to showcasing Nollywood, African cinema, and global multicultural films. Founded to build strong cultural and industry bridges between Canada and the Nigerian film industry, BINFF celebrates outstanding achievements in feature films, shorts, television, web series, and technical craft.',
    when:
      'Held annually in September in Brampton, Ontario, Canada, featuring international screenings, industry panels, workshops, and the grand Gala Awards ceremony.',
    submissions:
      'Filmmakers submit via FilmFreeway and the official BINFF portal across categories including Best Film Nollywood, Best Director, Best Actor/Actress, Best Television/Web Series, and Technical Craft.',
    entryPlan: {
      fees: 'Standard Festival Fee ($25 – $55 on FilmFreeway)',
      eligibility: 'Nollywood, African, Canadian, and international feature films, shorts, documentaries, and web series.',
      formats: 'HD / 4K Digital screener via FilmFreeway / Vimeo.',
      categoriesCount: '25+ Film, Television & Craft Categories',
      platform: 'FilmFreeway & BINFF Official Portal',
    },
    submitUrl: 'https://www.binff.net/',
    submitLabel: 'BINFF Official Portal',
    tags: ['Brampton', 'Canada', 'Nollywood', 'Diaspora', 'Festival', 'TINFF Sister Festival', 'Web Series', 'African Cinema'],
  },
  {
    id: 'DIYMA',
    label: 'DIYMA',
    full: 'Distinct Indigenous Yoruba Movie Awards',
    tagline: 'Recognizing Exceptional Craft & Performances in Yoruba Cinema',
    category: 'indigenous',
    location: 'Lagos / Oyo, Nigeria',
    frequency: 'Annual',
    founded: 2020,
    accent: '#EA580C',
    about:
      'An annual awards platform dedicated to celebrating artistic excellence, cultural authenticity, acting performances, and technical craft (continuity, cinematography, set design, editing) across Yoruba-language cinema and productions.',
    when:
      'Annual awards cycle celebrating indigenous releases across cinema, broadcast television, and digital streaming platforms.',
    submissions:
      'Producers and practitioners submit indigenous Yoruba-language titles for jury evaluation across performance and technical craft categories.',
    entryPlan: {
      fees: 'Free / Indigenous Entry',
      eligibility: 'Yoruba-language feature films and productions released during the award cycle.',
      formats: 'Digital screener.',
      categoriesCount: '20+ Craft & Performance Categories',
      platform: 'DIYMA Secretariat',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Indigenous', 'Yoruba Cinema', 'Craft', 'Set Design', 'Continuity', 'Acting'],
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
    id: 'EKOIFF',
    label: 'EKOIFF',
    full: 'Eko International Film Festival',
    tagline: 'Lagos Premier International Showcase for Global & Nollywood Cinema',
    category: 'festival',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (April / May)',
    founded: 2009,
    accent: '#8B5CF6',
    about:
      'Founded in 2009 by Hope Obioma Opara, Eko International Film Festival (EKOIFF) is one of Nigeria’s longest-standing international film festivals in Lagos. Its mission is to promote the appreciation of arts and culture through motion picture arts and sciences, boost tourism, and foster cross-cultural collaborations between African filmmakers and the global cinema industry.',
    when:
      'Annual international festival held in April / May at Silverbird Cinemas, Victoria Island, Lagos, Nigeria. Features competitive feature film showcases, documentary screenings, Canon cinematography workshops, and gala jury awards.',
    submissions:
      'Open to Nigerian, African, and international filmmakers across feature films, shorts, documentaries, indigenous language cinema, student projects, and animations via FilmFreeway and the official festival website.',
    entryPlan: {
      fees: 'Standard Entry ($15 – $40 via FilmFreeway)',
      eligibility: 'Features, shorts, documentaries completed within 2 years. English subtitles required for foreign dialogue.',
      formats: 'Full HD / 4K screener; DCP / ProRes for theatrical projections.',
      categoriesCount: '15 Feature, Acting & Craft Categories',
      platform: 'FilmFreeway & EKOIFF Portal',
    },
    submitUrl: 'https://filmfreeway.com/EkoInternationalFilmFestival',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Lagos', 'Film Festival', 'International', 'Silverbird Cinemas', 'FilmFreeway', 'Nollywood'],
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
    id: 'BIFF',
    label: 'BIFF',
    full: 'Bayelsa International Film Festival',
    tagline: 'Celebrating Niger Delta Heritage, Indigenous Stories & Global African Cinema',
    category: 'festival',
    location: 'Yenagoa, Bayelsa State, Nigeria',
    frequency: 'Annual (October / November)',
    founded: 2021,
    accent: '#10B981',
    about:
      'Founded in 2021 by festival director Moses Etonzor, Bayelsa International Film Festival (BIFF) is the premier cinema, arts, and cultural gathering held in Yenagoa, Bayelsa State. The festival champions Niger Delta storytelling, indigenous culture, environmental advocacy, and international co-productions through competitive screenings, workshops, masterclasses, and awards galas.',
    when:
      'Annual multi-day festival held in October / November in Yenagoa, Bayelsa State, featuring film screenings, panel sessions, cultural exhibitions ("Owigiri Night"), fashion galas, and awards ceremony.',
    submissions:
      'Open to Nigerian, African, and international filmmakers across feature films, documentaries, shorts, animations, and student categories via FilmFreeway and the official festival portal.',
    entryPlan: {
      fees: 'Standard Entry ($10 – $30 on FilmFreeway) / Free Community Entry',
      eligibility: 'Narrative features, shorts, documentaries, indigenous language cinema, and student projects completed within 2 years. English subtitles required.',
      formats: 'Digital screener (MP4/MOV); DCP for theatrical cinema screenings.',
      categoriesCount: '15+ Feature, Acting, Technical & Student Categories',
      platform: 'FilmFreeway & BIFF Portal',
    },
    submitUrl: 'https://filmfreeway.com/BayelsaInternationalFilmFestival',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Yenagoa', 'Bayelsa', 'Niger Delta', 'Film Festival', 'FilmFreeway', 'Indigenous', 'Cultural Heritage'],
  },
  {
    id: 'BCFF',
    label: 'BCFF',
    full: 'Benin City Film Festival',
    tagline: 'Celebrating Edo Cultural Heritage, Historic Storytelling & Collective Cinema',
    category: 'festival',
    location: 'Benin City, Edo State, Nigeria',
    frequency: 'Annual (November / December)',
    founded: 2018,
    accent: '#D97706',
    about:
      'Founded in 2018 by Godfrey Omorodion Aibuedefe, the Benin City Film Festival (BCFF) is Edo State’s premier cinema celebration held in the ancient city of Benin. Centered around the theme "Stronger Together – The Power of Collective Filmmaking," BCFF bridges emerging talent with veteran cinema legends, spotlights Edo and African cultural heritage, hosts masterclasses, and honors outstanding feature films, documentaries, shorts, and performances.',
    when:
      'Annual festival held in November / December in Benin City, Edo State, Nigeria. Features competitive screenings, masterclasses, cultural galas, and the BCFF Excellence Awards.',
    submissions:
      'Open to Nigerian, African, and international filmmakers across feature films, documentaries, shorts, animations, indigenous language films, student projects, and mobile cinema via FilmFreeway and the official portal.',
    entryPlan: {
      fees: 'Standard Festival Fee ($10 – $35 via FilmFreeway)',
      eligibility: 'Narrative features, shorts, documentaries, and animations produced within 2 years. English subtitles required for non-English dialogue.',
      formats: 'Digital HD screener; DCP / ProRes for cinema projections.',
      categoriesCount: '16 Feature, Craft, Acting & Regional Categories',
      platform: 'FilmFreeway & BCFF Portal',
    },
    submitUrl: 'https://filmfreeway.com/BeninCityFilmFestival',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Benin City', 'Edo State', 'Film Festival', 'FilmFreeway', 'Cultural Heritage', 'Bronze Kingdom', 'Nollywood'],
  },
  {
    id: 'LIFANIMA',
    label: 'LIFANIMA',
    full: 'Lagos International Festival of Animation',
    tagline: 'Africa’s Premier Dedicated Animation Film Festival & Industry Summit',
    category: 'festival',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (October)',
    founded: 2017,
    accent: '#F59E0B',
    about:
      'Founded in 2017 by Muyiwa Kayode, the Lagos International Festival of Animation (LIFANIMA) is Africa’s largest and most prestigious dedicated animation festival. Hosted at the Alliance Française / Mike Adenuga Centre in Ikoyi, Lagos, LIFANIMA champions the rapidly growing African animation ecosystem by connecting animators, visual effects artists, studios, broadcasters, and game developers across competitive categories.',
    when:
      'Annual 3-day animation festival held in October at the Alliance Française / Mike Adenuga Centre, Ikoyi, Lagos, Nigeria. Features theatrical screenings, animation masterclasses, studio pitching sessions, and the LIFANIMA Awards Gala.',
    submissions:
      'Open to African, diaspora, and international animators and studios across 2D animation, 3D CGI, Stop Motion, Visual Effects, Animation Commercials, and Student Films via FilmFreeway and the official festival website.',
    entryPlan: {
      fees: 'Free / Low Administrative Entry via FilmFreeway',
      eligibility: '2D, 3D, Stop-Motion, VFX, and animated films completed within 2 years. English subtitles required for foreign dialogue.',
      formats: 'Full HD / 4K MP4/MOV digital screener.',
      categoriesCount: '6 Animation & VFX Categories',
      platform: 'FilmFreeway & LIFANIMA Portal',
    },
    submitUrl: 'https://filmfreeway.com/LIFANIMA',
    submitLabel: 'Submit on FilmFreeway',
    tags: ['Lagos', 'Animation Festival', '2D & 3D', 'CGI', 'Visual Effects', 'Stop Motion', 'FilmFreeway', 'Alliance Française'],
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
  {
    id: 'SEPTIMIUS',
    label: 'Septimius',
    full: 'Septimius Awards',
    tagline: 'International Film Ceremony Honouring Global & Independent Talent',
    category: 'festival',
    location: 'Amsterdam, Netherlands',
    frequency: 'Annual (August / September)',
    founded: 2022,
    accent: '#6366F1',
    about:
      'An annual international film festival and awards ceremony held in Amsterdam, Netherlands, celebrating independent feature films, documentaries, shorts, animations, series, and outstanding talent from Europe, America, Asia, Africa, and Oceania.',
    when:
      'Held annually in late summer (August/September) in Amsterdam, Netherlands.',
    submissions:
      'Entries are submitted via FilmFreeway across continental and international craft categories.',
    entryPlan: {
      fees: 'Standard Entry via FilmFreeway',
      eligibility: 'Feature films, shorts, documentaries, animations, and series from all continents.',
      formats: 'Secure online screener / DCP.',
      categoriesCount: '30+ Continental & Technical Categories',
      platform: 'FilmFreeway & Septimius Awards Portal',
    },
    submitUrl: 'https://septimiusawards.com/',
    submitLabel: 'Septimius Official Portal',
    tags: ['Amsterdam', 'International', 'Pan-African', 'Independent', 'Global Honours'],
  },
  {
    id: 'ELOY',
    label: 'ELOY Awards',
    full: 'Exquisite Lady of the Year Awards',
    tagline: 'Celebrating Women of Excellence Across Film, Media, Arts & Business',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (November / December)',
    founded: 2009,
    accent: '#E11D48',
    about:
      'Founded by Tewa Onasanya and Exquisite Magazine in 2009, the ELOY (Exquisite Lady of the Year) Awards celebrate trailblazing women of excellence across creative arts, Nollywood cinema, television, media, entrepreneurship, and leadership.',
    when:
      'Held annually in late Q4 (November/December) in Lagos, Nigeria.',
    submissions:
      'Public nominations open mid-year across competitive acting, directing, producing, screenwriting, media, and creative enterprise categories, followed by academy review and public voting.',
    entryPlan: {
      fees: 'Free Public Nomination',
      eligibility: 'Female professionals and creators across cinema, television, media, and creative enterprise with recognized work during the eligibility window.',
      formats: 'Online nomination and portfolio/screener review.',
      categoriesCount: '20+ Industry & Creative Categories',
      platform: 'Official ELOY Portal',
    },
    submitUrl: 'https://www.eloyawards.com/',
    submitLabel: 'ELOY Official Portal',
    tags: ['Lagos', 'Women in Film', 'Exquisite Magazine', 'Nollywood', 'Television', 'Empowerment'],
  },
  {
    id: 'CITY_PEOPLE',
    label: 'City People Movie Awards',
    full: 'City People Entertainment & Movie Awards',
    tagline: 'Spotlighting Mainstream & Indigenous Excellence in Nigerian Cinema',
    category: 'academy',
    location: 'Lagos / Ogun State, Nigeria',
    frequency: 'Annual (October / November)',
    founded: 2009,
    accent: '#EA580C',
    about:
      'Founded by Dr. Seye Kehinde and the City People Media Group, the City People Movie Awards (formerly City People Entertainment Awards) is one of Nigeria’s premier and longest-running cinema honours. It celebrates artistic and commercial breakthroughs across mainstream English Nollywood, Yoruba cinema, and Kannywood, honoring both veteran icons and emerging stars.',
    when:
      'Annual gala ceremony held in the fourth quarter (October to December) in Lagos or Ogun State.',
    submissions:
      'Nominations are curated by the City People entertainment editorial board alongside public voting across performance, directing, production, and lifetime recognition categories.',
    entryPlan: {
      fees: 'Editorial & Public Nominations',
      eligibility: 'Nigerian and African feature films, indigenous productions, actors, directors, and producers released during the award cycle.',
      formats: 'Cinema and streaming releases; physical and digital screeners.',
      categoriesCount: '35+ Film, Indigenous & Acting Categories',
      platform: 'City People Magazine & Online Channels',
    },
    submitUrl: 'https://citypeopleonline.com/',
    submitLabel: 'City People Official Portal',
    tags: ['City People', 'Lagos', 'Nollywood', 'Yoruba Cinema', 'Kannywood', 'Seye Kehinde', 'Annual Gala'],
  },
  {
    id: 'AMBO',
    label: 'AMBO',
    full: 'Amstel Malta Box Office',
    tagline: 'The Historic Nollywood Talent Incubator & Feature Film Initiative',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Historic Editions (2005–2011)',
    founded: 2005,
    accent: '#D97706',
    about:
      'Created by Nigerian Breweries Plc, Amstel Malta Box Office (AMBO) was a landmark Nigerian television reality initiative and film production platform that launched the breakout careers of Nollywood icons including OC Ukeje, Azizat Sadiq, Bhaira Mcwizu, and Wole Ojo. Each edition produced major cinematic feature films such as White Waters, Sitanda, and The Child.',
    when:
      'Ran iconic annual seasons that culminated in theatrical Nollywood feature premieres and academy acting contracts.',
    submissions:
      'Contestants were selected through nationwide acting auditions, followed by academy residency and professional feature casting.',
    entryPlan: {
      fees: 'Audition Entry',
      eligibility: 'Aspiring Nigerian screen actors and creative performers.',
      formats: 'Live auditions and screen tests.',
      categoriesCount: 'Grand Prize & Production Contracts',
      platform: 'Amstel Malta / Nigerian Breweries',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Nollywood History', 'Amstel Malta', 'Talent Incubator', 'OC Ukeje', 'Wole Ojo', 'Lagos'],
  },
  {
    id: 'CNN_AFRICAN_VOICES',
    label: 'CNN African Voices',
    full: 'CNN African Voices Changemakers',
    tagline: 'Spotlighting Africa’s Visionary Storytellers & Cultural Luminaries',
    category: 'impact',
    location: 'Atlanta, USA / Pan-African',
    frequency: 'Weekly Global Feature & Annual Honours',
    founded: 2009,
    accent: '#DC2626',
    about:
      'CNN International’s flagship documentary series and cultural recognition platform, celebrating influential African creators, filmmakers, directors, and cultural innovators who are shaping contemporary cinema, arts, and global cultural dialogue across the continent.',
    when:
      'Broadcast continuously on CNN International, featuring special retrospectives and cultural spotlights.',
    submissions:
      'Curated by CNN International’s editorial and documentary production teams based on continental impact and artistic breakthrough.',
    entryPlan: {
      fees: 'Editorial Selection',
      eligibility: 'African filmmakers, cultural trailblazers, and creative icons with distinguished international impact.',
      formats: 'Broadcast documentary feature.',
      categoriesCount: 'Global Cultural Spotlights',
      platform: 'CNN International',
    },
    submitUrl: 'https://edition.cnn.com/specials/africa/african-voices-changemakers',
    submitLabel: 'CNN African Voices Portal',
    tags: ['CNN', 'Global Recognition', 'Documentary', 'Directors', 'Pan-African', 'Cultural Impact'],
  },
  {
    id: 'AFRIFF',
    label: 'AFRIFF',
    full: 'Africa International Film Festival',
    tagline: 'Africa’s Premier International Film Festival Hub',
    category: 'festival',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (November)',
    founded: 2010,
    accent: '#9333EA',
    about:
      'Founded in 2010 by Chioma Ude, the Africa International Film Festival (AFRIFF) is one of the continent’s most influential cinema gatherings. Hosted annually in Lagos, it unites African and global filmmakers through world premieres, industry masterclasses, talent labs, and the prestigious AFRIFF Globe Awards celebrating excellence in directing, acting, screenwriting, and documentary craft.',
    when:
      'Held annually in November in Lagos, Nigeria.',
    submissions:
      'Submissions open through FilmFreeway across feature films, shorts, documentaries, student projects, and animations.',
    entryPlan: {
      fees: 'Standard Entry ($20 – $50 on FilmFreeway)',
      eligibility: 'African, diaspora, and international features, documentaries, and shorts completed within 2 years.',
      formats: 'HD / 4K screener; DCP for festival screenings.',
      categoriesCount: '18 AFRIFF Globe Awards',
      platform: 'FilmFreeway & AFRIFF Official Portal',
    },
    submitUrl: 'https://afriff.com/',
    submitLabel: 'AFRIFF Official Portal',
    tags: ['Lagos', 'Film Festival', 'Chioma Ude', 'Globe Awards', 'International', 'Masterclasses', 'Nollywood'],
  },
  {
    id: 'GIAMA',
    label: 'GIAMA',
    full: 'Golden Icons Academy Movie Awards',
    tagline: 'Celebrating African Cinema Excellence in the North American Diaspora',
    category: 'academy',
    location: 'Houston, Texas, USA',
    frequency: 'Annual',
    founded: 2012,
    accent: '#D97706',
    about:
      'Founded by Bode Ojo, the Golden Icons Academy Movie Awards (GIAMA) was established in Houston, Texas, to celebrate the highest achievements of African cinema and Nollywood in the diaspora. The annual red-carpet gala brought together top African film stars, directors, and North American film executives across competitive and honorary categories.',
    when:
      'Annual gala ceremony hosted in Houston, Texas.',
    submissions:
      'Films were entered through the GIAMA Academy portal across theatrical features, diaspora productions, and technical craft categories.',
    entryPlan: {
      fees: 'Academy Entry',
      eligibility: 'African and diaspora narrative features released during the award cycle.',
      formats: 'Digital screener and theatrical prints.',
      categoriesCount: '25+ Acting, Directing & Technical Prizes',
      platform: 'GIAMA Academy Portal',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Houston', 'Diaspora', 'USA', 'Red Carpet', 'Academy', 'Nollywood Excellence'],
  },
  {
    id: 'NEA',
    label: 'NEA Awards',
    full: 'Nigeria Entertainment Awards',
    tagline: 'The Landmark New York Honors for Nigerian Screen & Music Talents',
    category: 'industry',
    location: 'New York City, USA',
    frequency: 'Annual (September)',
    founded: 2006,
    accent: '#2563EB',
    about:
      'The Nigeria Entertainment Awards (NEA) is an annual award ceremony established in New York City in 2006. Dedicated to recognizing Nigerian and African contributions to motion pictures, television, music, and diaspora entertainment, it honors outstanding actors, directors, producers, and musicians on a prominent American stage.',
    when:
      'Held annually during Labor Day weekend in September in New York City.',
    submissions:
      'Nominations curated by the NEA steering committee with public and academy voting.',
    entryPlan: {
      fees: 'Committee & Public Nominations',
      eligibility: 'Nigerian and African feature films, actors, directors, and entertainment figures.',
      formats: 'Screeners and released works.',
      categoriesCount: '20+ Cinema and Entertainment Awards',
      platform: 'NEA Official Platform',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['New York', 'Diaspora', 'Nollywood in USA', 'Acting', 'Cinema & Music'],
  },
  {
    id: 'NMA',
    label: 'Nollywood Movies Awards',
    full: 'Nollywood Movies Awards',
    tagline: 'Peer-Reviewed Excellence in Nigerian Motion Picture Craft',
    category: 'academy',
    location: 'Lagos, Nigeria',
    frequency: 'Annual',
    founded: 2012,
    accent: '#7C3AED',
    about:
      'Founded by the Nollywood Movies Network and Alfred Soroh, the Nollywood Movies Awards (NMA) was designed to honor technical and artistic excellence in Nigerian cinema. With peer-reviewed jury deliberations across cinematography, sound design, editing, original screenplay, and acting, NMA celebrated the cinematic elevation of Nollywood.',
    when:
      'Annual ceremony held in Lagos, Nigeria.',
    submissions:
      'Film producers and distributors entered feature films for jury review.',
    entryPlan: {
      fees: 'Producer Entry',
      eligibility: 'Nigerian theatrical and home video feature films released within the eligibility period.',
      formats: 'Digital screener or DVD preview.',
      categoriesCount: '22 Craft & Performance Categories',
      platform: 'NMA Secretariat',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Lagos', 'Nollywood Craft', 'Screenwriting', 'Cinematography', 'Acting', 'Jury Awards'],
  },
  {
    id: 'NAFCA',
    label: 'NAFCA (African Oscars)',
    full: 'Nollywood & African Film Critics Awards',
    tagline: 'The Prestigious African Film Critics Honours in North America',
    category: 'academy',
    location: 'Los Angeles / Washington D.C., USA',
    frequency: 'Annual (September)',
    founded: 2011,
    accent: '#059669',
    about:
      'Founded by Dr. Victor Olatoye, the Nollywood & African Film Critics Awards (widely known as NAFCA or The African Oscars) recognizes outstanding achievements in African and diaspora film, culture, and humanitarian leadership. Judged by a panel of international film critics and scholars, it bridges African motion pictures with global audiences.',
    when:
      'Held annually in the United States (Los Angeles, California / Washington D.C.).',
    submissions:
      'Submissions accepted from African and diaspora producers across narrative films, documentaries, and shorts.',
    entryPlan: {
      fees: 'Critics Association Entry',
      eligibility: 'African and diaspora motion pictures released theatrically or on streaming.',
      formats: 'Online screener / DVD screener.',
      categoriesCount: '28 Film & Humanitarian Categories',
      platform: 'NAFCA Secretariat',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['African Oscars', 'Critics Awards', 'USA', 'Los Angeles', 'Diaspora', 'Humanitarian'],
  },
  {
    id: 'PAFF',
    label: 'PAFF',
    full: 'Pan African Film & Arts Festival',
    tagline: 'America’s Largest & Longest-Running Black Film Festival',
    category: 'festival',
    location: 'Los Angeles, California, USA',
    frequency: 'Annual (February)',
    founded: 1992,
    accent: '#EA580C',
    about:
      'Founded in 1992 by Hollywood actor Danny Glover, Emmy-winner Ja’Net DuBois, and Ayuko Babu, the Pan African Film & Arts Festival (PAFF) in Los Angeles is the largest Black film and cultural festival in the United States. An official Academy Award® (Oscar) qualifying festival, PAFF showcases over 200 films annually from Africa, the Caribbean, and the diaspora.',
    when:
      'Held annually in February during Black History Month in Los Angeles, California.',
    submissions:
      'Open to feature narratives, shorts, documentaries, and animations via FilmFreeway.',
    entryPlan: {
      fees: 'Standard Entry ($35 – $75 on FilmFreeway)',
      eligibility: 'Black and African diaspora films showcasing cultural authenticity and cinematic vision.',
      formats: 'DCP / Online Screener.',
      categoriesCount: 'Oscar-Qualifying & Jury Awards',
      platform: 'FilmFreeway & PAFF Official Portal',
    },
    submitUrl: 'https://www.paff.org/',
    submitLabel: 'PAFF Official Website',
    tags: ['Los Angeles', 'Oscar-Qualifying', 'Danny Glover', 'Black Cinema', 'FilmFreeway', 'Diaspora'],
  },
  {
    id: 'FESPACO',
    label: 'FESPACO',
    full: 'Panafrican Film and Television Festival of Ouagadougou',
    tagline: 'The Historic Mother of African Cinema & Étalon de Yennenga Honours',
    category: 'festival',
    location: 'Ouagadougou, Burkina Faso',
    frequency: 'Biennial (February / March)',
    founded: 1969,
    accent: '#CA8A04',
    about:
      'Founded in 1969, FESPACO is the oldest, largest, and most historic film festival on the African continent. Hosted biennially in Ouagadougou, Burkina Faso, the festival crowns the prestigious Étalon de Yennenga (Golden Stallion of Yennenga), universally revered as the supreme cultural prize of African motion pictures.',
    when:
      'Held biennially in February/March in Ouagadougou, Burkina Faso.',
    submissions:
      'Open to films directed by African filmmakers or directors of African descent.',
    entryPlan: {
      fees: 'Free Official Entry',
      eligibility: 'Feature fiction, documentaries, shorts, animations, and TV series directed by creators of African descent.',
      formats: 'DCP with French and English subtitles.',
      categoriesCount: 'Étalon de Yennenga & Official Competition',
      platform: 'FESPACO Secretariat',
    },
    submitUrl: 'https://fespaco.bf/',
    submitLabel: 'FESPACO Official Portal',
    tags: ['Burkina Faso', 'Ouagadougou', 'Historic', 'Étalon de Yennenga', 'Pan-African', 'Mother of African Cinema'],
  },
  {
    id: 'DIFF',
    label: 'DIFF',
    full: 'Durban International Film Festival',
    tagline: 'Southern Africa’s Longest-Running International Festival & Market',
    category: 'festival',
    location: 'Durban, South Africa',
    frequency: 'Annual (July)',
    founded: 1979,
    accent: '#0D9488',
    about:
      'Organized by the Centre for Creative Arts at the University of KwaZulu-Natal, the Durban International Film Festival (DIFF) is South Africa\'s longest-running film festival. It hosts premiere screenings of ground-breaking African and world cinema alongside the Durban FilmMart, awarding top prizes for Best Feature, Best Director, Best African Film, and documentary craft.',
    when:
      'Held annually in July in Durban, South Africa.',
    submissions:
      'Submissions accepted via FilmFreeway across features, documentaries, and shorts.',
    entryPlan: {
      fees: 'Standard Entry via FilmFreeway',
      eligibility: 'African and international productions completed within the previous calendar year.',
      formats: 'DCP / Full HD Digital Screener.',
      categoriesCount: '15 Competitive Jury Awards',
      platform: 'FilmFreeway & DIFF Portal',
    },
    submitUrl: 'https://ccadiff.ukzn.ac.za/',
    submitLabel: 'DIFF Official Portal',
    tags: ['South Africa', 'Durban', 'Film Festival', 'FilmFreeway', 'Durban FilmMart', 'African Cinema'],
  },
  {
    id: 'SUNDANCE',
    label: 'Sundance',
    full: 'Sundance Film Festival',
    tagline: 'The World’s Premier Independent Film Showcase',
    category: 'festival',
    location: 'Park City, Utah, USA',
    frequency: 'Annual (January)',
    founded: 1978,
    accent: '#F59E0B',
    about:
      'Founded by Robert Redford and run by the Sundance Institute, the Sundance Film Festival is the ultimate global launchpad for independent cinema. Landmark Nollywood and African cinematic masterworks, including CJ Obasi\'s Mami Wata (Special Jury Award for Cinematography), have garnered global acclaim and awards at Sundance.',
    when:
      'Held annually in January in Park City and Salt Lake City, Utah.',
    submissions:
      'Competitive global submissions via FilmFreeway and Sundance Portal.',
    entryPlan: {
      fees: 'Standard Entry via FilmFreeway',
      eligibility: 'World and US independent feature narratives, documentaries, and shorts.',
      formats: 'DCP with open/closed captions.',
      categoriesCount: 'World Cinema Dramatic & Grand Jury Prizes',
      platform: 'Sundance Institute',
    },
    submitUrl: 'https://festival.sundance.org/',
    submitLabel: 'Sundance Official Portal',
    tags: ['Sundance', 'USA', 'Park City', 'Independent Cinema', 'World Cinema Dramatic', 'Global Prestige'],
  },
  {
    id: 'TIFF',
    label: 'TIFF',
    full: 'Toronto International Film Festival',
    tagline: 'One of the World’s Leading Film Festivals & Champions of Nollywood',
    category: 'festival',
    location: 'Toronto, Ontario, Canada',
    frequency: 'Annual (September)',
    founded: 1976,
    accent: '#EF4444',
    about:
      'The Toronto International Film Festival (TIFF) is one of the most prestigious and widely attended public film festivals globally. In 2016, TIFF historicized African cinema by dedicating its prestigious "City to City" programme to Lagos, spotlighting landmark Nollywood films and launching Nigerian storytellers onto global distribution platforms.',
    when:
      'Held annually in September in Toronto, Canada.',
    submissions:
      'Open to Canadian and international films across feature and short sections via FilmFreeway.',
    entryPlan: {
      fees: 'International Submission Fee',
      eligibility: 'World and international premieres; features and shorts.',
      formats: 'DCP with English subtitles.',
      categoriesCount: 'People’s Choice & Platform Awards',
      platform: 'TIFF Official Portal',
    },
    submitUrl: 'https://www.tiff.net/',
    submitLabel: 'TIFF Official Portal',
    tags: ['Toronto', 'Canada', 'TIFF', 'City to City Lagos', 'World Premieres', 'Global Hub'],
  },
  {
    id: 'ZAFAA',
    label: 'ZAFAA Global Awards',
    full: 'Zulu African Film Academy Awards',
    tagline: 'The Largest African Film Awards Gala in Europe & the UK',
    category: 'academy',
    location: 'London, United Kingdom / Lagos, Nigeria',
    frequency: 'Annual (October / November)',
    founded: 2006,
    accent: '#8B5CF6',
    about:
      'Founded in 2006 by Sam Anwuzia, the ZAFAA Global Awards (Zulu African Film Academy Awards) is Europe’s largest annual celebration of Nollywood and African movie excellence. Staged in prestigious venues across London and global host cities, ZAFAA honours outstanding directors, screenwriters, actors, and technicians.',
    when:
      'Held annually in late autumn in London, UK and partner cities.',
    submissions:
      'Open to African filmmakers and diaspora producers.',
    entryPlan: {
      fees: 'Academy Entry',
      eligibility: 'African and diaspora feature films released within the eligible period.',
      formats: 'HD Screener / Preview copy.',
      categoriesCount: '24 Film & Craft Prizes',
      platform: 'ZAFAA Academy',
    },
    submitUrl: 'https://zafaa.org/',
    submitLabel: 'ZAFAA Official Portal',
    tags: ['London', 'United Kingdom', 'Diaspora', 'Sam Anwuzia', 'Nollywood in UK', 'Red Carpet'],
  },
  {
    id: 'GMAA',
    label: 'Golden Movie Awards Africa',
    full: 'Golden Movie Awards Africa (GMAA)',
    tagline: 'Honouring Film & Television Craft Across West & Pan-Africa',
    category: 'academy',
    location: 'Accra, Ghana',
    frequency: 'Annual',
    founded: 2015,
    accent: '#EAB308',
    about:
      'Founded by NMJ Filmhouse and Mimi Andani Michaels in Accra, Ghana, the Golden Movie Awards Africa (GMAA) is an annual cinema awards body dedicated to recognizing top performances, directing, cinematography, and screenwriting across Ghana, Nigeria, and the wider African continent.',
    when:
      'Held annually in Accra, Ghana.',
    submissions:
      'Filmmakers and producers submit feature films, documentaries, and short films for jury consideration.',
    entryPlan: {
      fees: 'Free / Administrative Entry',
      eligibility: 'African feature films, comedy films, shorts, and TV series produced in Africa.',
      formats: 'Full HD digital screener.',
      categoriesCount: '20+ Golden Craft & Performance Categories',
      platform: 'GMAA Secretariat',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Ghana', 'Accra', 'West Africa', 'Golden Actor', 'Cinema Craft', 'Pan-African'],
  },
  {
    id: 'NAGA',
    label: 'NAGA',
    full: 'Nigerian Academy of Golden Awards',
    tagline: 'Celebrating Discipline, Craft & Lifetime Achievements in Nollywood',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Annual',
    founded: 2018,
    accent: '#047857',
    about:
      'The Nigerian Academy of Golden Awards (NAGA) is an entertainment and screen honors platform in Nigeria recognizing seasoned practitioners, veteran icons, and emerging performers for their dedication, artistic discipline, and enduring contributions to the motion picture industry.',
    when:
      'Annual gala ceremony in Lagos, Nigeria.',
    submissions:
      'Curated through industry nomination panels and guild peer assessments.',
    entryPlan: {
      fees: 'Guild & Peer Nomination',
      eligibility: 'Active Nigerian cinema and television practitioners.',
      formats: 'Performance reels and film screeners.',
      categoriesCount: '15 Screen & Craft Accolades',
      platform: 'NAGA Secretariat',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Lagos', 'Nollywood', 'Discipline & Craft', 'Veterans', 'Merit Honours'],
  },
  {
    id: 'HER_NETWORK',
    label: 'Her Network',
    full: 'Her Network Woman of the Year Awards',
    tagline: 'Championing Inspiring Women in Entertainment & Screen Industries',
    category: 'impact',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (December)',
    founded: 2017,
    accent: '#EC4899',
    about:
      'Founded in 2017 by Nkem Onwudiwe, the Her Network Woman of the Year (HNWOTY) Awards celebrate extraordinary women who exhibit exceptional leadership, creative resilience, and social impact in film, television, media, technology, and public service across Africa.',
    when:
      'Held annually in December in Lagos, Nigeria.',
    submissions:
      'Public nominations followed by an independent judging panel assessment.',
    entryPlan: {
      fees: 'Free Public Nomination',
      eligibility: 'Women of African descent who have made tangible impacts in entertainment, media, and arts.',
      formats: 'Nomination dossier and portfolio.',
      categoriesCount: '12 Impact Categories',
      platform: 'Her Network Portal',
    },
    submitUrl: 'https://hernetwork.co/',
    submitLabel: 'Her Network Portal',
    tags: ['Lagos', 'Women in Film', 'Empowerment', 'Leadership', 'Impact', 'Osas Ighodaro'],
  },
  {
    id: 'GREEN_OCTOBER',
    label: 'Green October Event',
    full: 'Green October Event by La Mode Magazine',
    tagline: 'Humanitarian & Arts Recognition Championing Disability Inclusion',
    category: 'impact',
    location: 'Lagos, Nigeria',
    frequency: 'Annual (October 1st)',
    founded: 2015,
    accent: '#16A34A',
    about:
      'Founded in 2015 by Sandra Odige and La Mode Magazine, the Green October Event is a prestigious annual humanitarian and creative arts gala held on Nigeria’s Independence Day (October 1st). The initiative raises awareness and support for persons living with disabilities while honoring filmmakers, actors, and public figures for humanitarian impact.',
    when:
      'Held annually on October 1st (Nigeria Independence Day) in Lagos, Nigeria.',
    submissions:
      'Nominations open to the public and vetted by the La Mode humanitarian committee.',
    entryPlan: {
      fees: 'Public & Humanitarian Nomination',
      eligibility: 'Filmmakers, actors, philanthropists, and fashion leaders supporting social causes.',
      formats: 'Portfolio and impact brief.',
      categoriesCount: 'Humanitarian & Creative Honours',
      platform: 'La Mode Magazine',
    },
    submitUrl: 'https://lamodespot.com/',
    submitLabel: 'La Mode Magazine',
    tags: ['Lagos', 'Humanitarian', 'Disability Inclusion', 'Independence Day', 'Philanthropy'],
  },
  {
    id: 'EMMY',
    label: 'International Emmy',
    full: 'International Emmy Awards',
    tagline: 'Global Television Excellence & International Directorate Honours',
    category: 'academy',
    location: 'New York City, USA',
    frequency: 'Annual (November)',
    founded: 1973,
    accent: '#B45309',
    about:
      'Administered by the International Academy of Television Arts & Sciences, the International Emmy Awards recognise excellence in television programming produced initially outside the United States. Landmark African media pioneers, including EbonyLife Media founder Mo Abudu, have been bestowed the prestigious Directorate Award at the ceremony.',
    when:
      'Held annually in November in New York City.',
    submissions:
      'Competitive entry across international broadcast and streaming television categories.',
    entryPlan: {
      fees: 'International Academy Entry Fee',
      eligibility: 'Television programmes and series produced outside the United States.',
      formats: 'Broadcast master / digital screener.',
      categoriesCount: 'International Academy Categories',
      platform: 'International Academy of Television Arts & Sciences',
    },
    submitUrl: 'https://www.iemmys.tv/',
    submitLabel: 'International Emmy Portal',
    tags: ['New York', 'Television Academy', 'Global Honours', 'Directorate Award', 'Mo Abudu'],
  },
  {
    id: 'VENICE',
    label: 'Venice Biennale Honours',
    full: 'Venice International Film Festival Parallel Awards (Bisato d’Oro / Venice Days)',
    tagline: 'Independent Critics & Festival Accolades at the World’s Oldest Film Festival',
    category: 'festival',
    location: 'Venice, Italy',
    frequency: 'Annual (August / September)',
    founded: 1932,
    accent: '#BE185D',
    about:
      'Prestigious parallel jury and independent critics’ accolades awarded during the historic Venice International Film Festival (La Biennale di Venezia) in Italy, including the Bisato d’Oro (Premio della Critica Indipendente), Giornate degli Autori (Venice Days), and CICT-UNESCO Enrico Fulchignoni awards celebrating exceptional ensemble performances and visionary directorial storytelling.',
    when:
      'Held annually in late summer on the Lido di Venezia, Italy.',
    submissions:
      'Official and independent festival sidebar selections.',
    entryPlan: {
      fees: 'Festival Selection Entry',
      eligibility: 'Feature narratives and documentaries selected for Venice parallel sections.',
      formats: 'Theatrical DCP.',
      categoriesCount: 'Independent Critics & Cultural Awards',
      platform: 'La Biennale di Venezia',
    },
    submitUrl: 'https://www.labiennale.org/en/cinema',
    submitLabel: 'La Biennale di Venezia',
    tags: ['Venice', 'Italy', 'Biennale', 'Bisato d’Oro', 'Independent Critics', 'International Cinema'],
  },
  {
    id: 'AFRICA_CHOICE',
    label: 'Africa Choice Awards',
    full: 'Africa Choice Awards',
    tagline: 'Celebrating Outstanding Creative Talent Across African Entertainment',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Annual',
    founded: 2020,
    accent: '#0891B2',
    about:
      'The Africa Choice Awards is an annual continental entertainment awards platform that recognizes the achievements of African performers, filmmakers, musicians, and influencers who inspire and impact contemporary creative culture across Africa.',
    when:
      'Annual gala ceremony in Lagos, Nigeria.',
    submissions:
      'Public nominations followed by online continental fan voting.',
    entryPlan: {
      fees: 'Free Public Nomination',
      eligibility: 'African actors, media stars, filmmakers, and digital creatives.',
      formats: 'Nomination profile and public voting.',
      categoriesCount: '20+ Pan-African Categories',
      platform: 'Africa Choice Awards Portal',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Pan-African', 'Lagos', 'Audience Choice', 'Entertainment', 'Acting'],
  },
  {
    id: 'YMAA',
    label: 'YMAA',
    full: 'Yoruba Movie Academy Awards',
    tagline: 'Celebrating Outstanding Performances & Cultural Heritage in Yoruba Cinema',
    category: 'indigenous',
    location: 'Ibadan / Lagos, Nigeria',
    frequency: 'Annual',
    founded: 2010,
    accent: '#D97706',
    about:
      'The Yoruba Movie Academy Awards (YMAA) is a premier indigenous film awards ceremony dedicated to recognizing excellence in Yoruba-language cinema. Celebrating superior performances, directing, cinematography, cultural authenticity, and screenwriting, YMAA honors both veteran legends and contemporary stars.',
    when:
      'Annual gala celebration held in Ibadan or Lagos, Nigeria.',
    submissions:
      'Indigenous movie producers and practitioners submit titles released within the award window.',
    entryPlan: {
      fees: 'Free / Producer Submission',
      eligibility: 'Yoruba-language feature films and productions.',
      formats: 'Digital screener or DVD master.',
      categoriesCount: '20+ Acting & Technical Prizes',
      platform: 'YMAA Secretariat',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Yoruba Cinema', 'Indigenous', 'Ibadan', 'Acting', 'Cultural Heritage', 'Nollywood'],
  },
  {
    id: 'NIGERIA_ACHIEVERS',
    label: 'Nigeria Achievers Awards',
    full: 'Nigeria Achievers & Women Achievers Awards',
    tagline: 'Recognizing Excellence & Leadership Across Nollywood & Enterprise',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Annual',
    founded: 2018,
    accent: '#4F46E5',
    about:
      'Annual national awards gala celebrating outstanding achievers, screen actors, producers, business leaders, and cultural figures making significant impacts in Nollywood, television, entrepreneurship, and community building across Nigeria.',
    when:
      'Annual awards gala held in Lagos, Nigeria.',
    submissions:
      'Nominations submitted by industry peers and the public.',
    entryPlan: {
      fees: 'Public & Peer Nomination',
      eligibility: 'Nigerian actors, filmmakers, and leaders with recognized contributions.',
      formats: 'Nomination dossier and public voting.',
      categoriesCount: '15+ Film & Leadership Awards',
      platform: 'Secretariat Portal',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Lagos', 'Achievers', 'Nollywood Supporting Actors', 'Leadership'],
  },
  {
    id: 'MISS_BLACK_USA',
    label: 'Miss Black USA',
    full: 'Miss Black USA Pageant & Cultural Honours',
    tagline: 'Celebrating Scholastic Achievement, Arts & Cultural Ambassadorship',
    category: 'impact',
    location: 'Washington D.C., USA',
    frequency: 'Annual',
    founded: 1986,
    accent: '#9333EA',
    about:
      'Founded in 1986 by Karen Arrington, Miss Black USA is the premier scholarship pageant and cultural honours platform for young women of color in the United States, championing education, health advocacy, and arts careers (with alumni including prominent Nollywood and international screen star Osas Ighodaro).',
    when:
      'Held annually in August in Washington D.C.',
    submissions:
      'State delegate applications and pageant competitions.',
    entryPlan: {
      fees: 'Delegate Application',
      eligibility: 'Women of African descent demonstrating scholastic and leadership excellence.',
      formats: 'Live competition and interview.',
      categoriesCount: 'Scholarship & National Crown',
      platform: 'Miss Black USA Official Portal',
    },
    submitUrl: 'https://www.missblackusa.org/',
    submitLabel: 'Miss Black USA Portal',
    tags: ['USA', 'Scholarship', 'Cultural Ambassadorship', 'Osas Ighodaro', 'Leadership'],
  },
  {
    id: 'PEAK',
    label: 'Peak Awards',
    full: 'Peak Nollywood Talent Awards',
    tagline: 'Celebrating Outstanding Performance & Emerging Screen Talent',
    category: 'industry',
    location: 'Lagos, Nigeria',
    frequency: 'Annual',
    founded: 2010,
    accent: '#0284C7',
    about:
      'Annual screen performance recognition initiative celebrating breakthrough acting roles, charismatic screen presence, and artistic dedication among Nigerian television and movie performers.',
    when:
      'Annual ceremony in Lagos, Nigeria.',
    submissions:
      'Curated by entertainment media panels and talent casting committees.',
    entryPlan: {
      fees: 'Talent Committee Nomination',
      eligibility: 'Nollywood screen actors in feature films and television series.',
      formats: 'Performance reels.',
      categoriesCount: 'Acting & Performance Prizes',
      platform: 'Peak Honours Board',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Lagos', 'Nollywood', 'Breakthrough Actors', 'Acting Honors'],
  },
];

export function getAwardOrg(id) {
  if (!id) return null;
  const cleanId = String(id).trim();
  const match =
    AWARD_ORGS.find((o) => o.id.toLowerCase() === cleanId.toLowerCase()) ||
    AWARD_ORGS.find((o) => o.label.toLowerCase() === cleanId.toLowerCase()) ||
    AWARD_ORGS.find((o) => o.full.toLowerCase().includes(cleanId.toLowerCase()));
  if (match) return match;

  const cleanLabel = cleanId.replace(/_/g, ' ');

  return {
    id: cleanId,
    label: cleanLabel,
    full: cleanLabel,
    tagline: 'African & International Cinema Honours',
    category: 'academy',
    location: 'Nigeria / Africa',
    frequency: 'Annual',
    founded: null,
    accent: 'var(--color-brand)',
    about: `Honours, film festival accolades, and cultural achievement awards celebrating cinematic excellence and artistic craft recorded in the MuviDB catalogue for ${cleanLabel}.`,
    when: 'Dates and ceremony timelines vary by edition.',
    submissions: 'Submissions and selections are administered by the organising body each season.',
    entryPlan: {
      fees: 'Check with organisers',
      eligibility: 'African and international film productions.',
      formats: 'Digital screener.',
      categoriesCount: 'Competitive Categories',
      platform: 'Official Channel',
    },
    submitUrl: null,
    submitLabel: null,
    tags: ['Cinema', 'Honours', 'Recognition'],
  };
}

export function normOrg(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Other';
  const upper = s.toUpperCase();
  if (upper.includes('YOMAFA') || upper.includes('YOMAFA GLOBAL')) return 'YOMAFA';
  if (upper.includes('AMVCA') || upper.includes('AFRICA MAGIC')) return 'AMVCA';
  if (upper.includes('AMAA') || upper.includes('AFRICA MOVIE ACADEMY')) return 'AMAA';
  if (upper.includes('CITY PEOPLE') || upper.includes('CITY_PEOPLE')) return 'CITY_PEOPLE';
  if (upper.includes('TINFF') || upper.includes('INDUSTRY NOLLYWOOD')) return 'TINFF';
  if (upper.includes('BINFF') || upper.includes('BRAMPTON INTERNATIONAL') || upper.includes('BRAMPTON NOLLYWOOD')) return 'BINFF';
  if (upper.includes('DIYMA') || upper.includes('DISTINCT INDIGENOUS')) return 'DIYMA';
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
  if (upper.includes('EKOIFF') || upper.includes('EKO INTERNATIONAL FILM')) return 'EKOIFF';
  if (upper.includes('BIFF') || upper.includes('BAYELSA INTERNATIONAL') || upper.includes('BAYELSA FILM')) return 'BIFF';
  if (upper.includes('BCFF') || upper.includes('BENIN CITY FILM') || upper.includes('BENIN FILM')) return 'BCFF';
  if (upper.includes('LIFANIMA') || upper.includes('ANIMATION FESTIVAL') || upper.includes('LAGOS INTERNATIONAL FESTIVAL OF ANIMATION')) return 'LIFANIMA';
  if (upper.includes('EKO STAR') || upper.includes('EKO_STAR')) return 'EKO_STAR';
  if (upper.includes('SEPTIMIUS')) return 'SEPTIMIUS';
  if (upper.includes('ELOY') || upper.includes('EXQUISITE LADY')) return 'ELOY';
  if (upper.includes('AFRIFF') || upper.includes('AFRICA INTERNATIONAL FILM FESTIVAL')) return 'AFRIFF';
  if (upper.includes('GIAMA') || upper.includes('GOLDEN ICONS')) return 'GIAMA';
  if (upper.includes('NEA') || upper.includes('NIGERIA ENTERTAINMENT AWARDS')) return 'NEA';
  if (upper.includes('NMA') || upper.includes('NOLLYWOOD MOVIES AWARDS')) return 'NMA';
  if (upper.includes('NAFCA') || upper.includes('AFRICAN OSCARS') || upper.includes('NOLLYWOOD & AFRICAN FILM CRITICS') || upper.includes('FILM CRITICS')) return 'NAFCA';
  if (upper.includes('PAFF') || upper.includes('PAN AFRICAN FILM')) return 'PAFF';
  if (upper.includes('FESPACO')) return 'FESPACO';
  if (upper.includes('DIFF') || upper.includes('DURBAN INTERNATIONAL')) return 'DIFF';
  if (upper.includes('SUNDANCE')) return 'SUNDANCE';
  if (upper === 'TIFF' || upper.includes('TORONTO INTERNATIONAL')) return 'TIFF';
  if (upper.includes('ZAFAA') || upper.includes('ZULU AFRICAN')) return 'ZAFAA';
  if (upper.includes('GMAA') || upper.includes('GOLDEN MOVIE AWARDS')) return 'GMAA';
  if (upper.includes('NAGA') || upper.includes('ACADEMY OF GOLDEN AWARDS')) return 'NAGA';
  if (upper.includes('AMBO') || upper.includes('AMSTEL MALTA')) return 'AMBO';
  if (upper.includes('CNN') || upper.includes('AFRICAN VOICES')) return 'CNN_AFRICAN_VOICES';
  if (upper.includes('HER NETWORK')) return 'HER_NETWORK';
  if (upper.includes('GREEN OCTOBER') || upper.includes('LA MODE')) return 'GREEN_OCTOBER';
  if (upper.includes('EMMY')) return 'EMMY';
  if (upper.includes('VENICE') || upper.includes('BISATO D\'ORO') || upper.includes('GIORNATE DEGLI AUTORI') || upper.includes('EUROPA CINEMAS')) return 'VENICE';
  if (upper.includes('AFRICA CHOICE')) return 'AFRICA_CHOICE';
  if (upper.includes('YMAA') || upper.includes('YORUBA MOVIE GIST') || upper.includes('YORUBA MOVIE ACADEMY')) return 'YMAA';
  if (upper.includes('NIGERIA ACHIEVERS') || upper.includes('NIGERIA WOMEN ACHIEVERS')) return 'NIGERIA_ACHIEVERS';
  if (upper.includes('MISS BLACK USA')) return 'MISS_BLACK_USA';
  if (upper.includes('PEAK AWARDS') || upper === 'PEAK') return 'PEAK';
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
  const orgs = recordedOrgs.sort((a, b) => {
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
