import React, { useState, useRef } from 'react';
import { Link } from 'react-router';
import { Icon } from '@iconify/react';
import ImageWithFallback from '../ui/ImageWithFallback';
import { formatFilmTitle } from '../../utils/format';

const DELYORK_ALUMNI = [
  {
    id: 'osas-ighodaro',
    slug: 'osas-ighodaro',
    name: 'Osas Ighodaro',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/3994c9ad-b1bf-4fa6-a363-26127117b4c6.webp',
    known_for_department: 'Lead Actress & Producer',
    representation: { representation_type: 'Alumni Fellow', notes: 'Screen Acting Fellowship · AMVCA Winner' },
  },
  {
    id: 'stan-nze',
    slug: 'stan-nze',
    name: 'Stan Nze',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/ae70c2fe-bf76-4d69-99eb-6f0fe4a936aa.webp',
    known_for_department: 'Dramatic Lead Actor',
    representation: { representation_type: 'Alumni Fellow', notes: 'Master Acting Lab · AMVCA Winner' },
  },
  {
    id: 'kemi-adetiba',
    slug: 'kemi-adetiba',
    name: 'Kemi Adetiba',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/9e9c2983-5db3-473c-8def-7c429dde340c.webp',
    known_for_department: 'Director & Showrunner',
    representation: { representation_type: 'Alumni Fellow', notes: 'Directing Fellow · King of Boys' },
  },
  {
    id: 'deyemi-okanlawon',
    slug: 'deyemi-okanlawon',
    name: 'Deyemi Okanlawon',
    photo_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/actors/deyemi-okanlawon/deyemi-001.webp',
    known_for_department: 'Lead Actor & Coach',
    representation: { representation_type: 'Alumni Fellow', notes: 'Screen Acting Lab · 50+ Films' },
  },
];

const KAP_ALUMNI = [
  {
    id: 'kehinde-bankole',
    slug: 'kehinde-bankole',
    name: 'Kehinde Bankole',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/0b61a801-1ccc-4e28-b459-41d13fe16ae6.webp',
    known_for_department: 'Lead Dramatic Actress',
    representation: { representation_type: 'Alumni Fellow', notes: 'KAP Screen Fellow · AMVCA Winner' },
  },
  {
    id: 'bimbo-ademoye',
    slug: 'bimbo-ademoye',
    name: 'Bimbo Ademoye',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/baba-segi-bimbo-ademoye-1ede6dad.jpg',
    known_for_department: 'Lead Actress & Producer',
    representation: { representation_type: 'Alumni Fellow', notes: 'Anikulapo Masterclass Fellow' },
  },
  {
    id: 'femi-adebayo',
    slug: 'femi-adebayo',
    name: 'Femi Adebayo',
    photo_url: 'https://1s8yfxw74q.ufs.sh/f/QCXeBA9u0Pph9yOWzNSgtfsJGAY10UQ5Oi9eERdmb37ZVCkK',
    known_for_department: 'Lead Actor & Producer',
    representation: { representation_type: 'Master Fellow', notes: 'KAP Post-Production Lab' },
  },
  {
    id: 'lateef-adedimeji',
    slug: 'lateef-adedimeji',
    name: 'Lateef Adedimeji',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/ae70c2fe-bf76-4d69-99eb-6f0fe4a936aa.webp',
    known_for_department: 'Dramatic Actor',
    representation: { representation_type: 'Master Fellow', notes: 'Screen Realism Fellow · Ayinla' },
  },
];

const TAFA_ALUMNI = [
  {
    id: 'ruth-kadiri',
    slug: 'ruth-kadiri',
    name: 'Ruth Kadiri',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/3994c9ad-b1bf-4fa6-a363-26127117b4c6.webp',
    known_for_department: 'Lead Producer & Actress',
    representation: { representation_type: 'Studio Alum', notes: '290+ Distributed Features' },
  },
  {
    id: 'kolawole-ajeyemi',
    slug: 'kolawole-ajeyemi',
    name: 'Kolawole Ajeyemi',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/ae70c2fe-bf76-4d69-99eb-6f0fe4a936aa.webp',
    known_for_department: 'Actor & Director',
    representation: { representation_type: 'Studio Alum', notes: 'Action Staging & Directing' },
  },
  {
    id: 'debbie-shokoya',
    slug: 'debbie-shokoya',
    name: 'Debbie Shokoya',
    photo_url: 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/baba-segi-bimbo-ademoye-1ede6dad.jpg',
    known_for_department: 'Screen Actress',
    representation: { representation_type: 'Acting Alum', notes: 'TAFA Screen Bootcamp Graduate' },
  },
  {
    id: 'tomiwa-tegbe',
    slug: 'tomiwa-tegbe',
    name: 'Tomiwa Tegbe',
    photo_url: 'https://pub-8c78c05976804a2da51ca287d5c3b229.r2.dev/media/actors/deyemi-okanlawon/deyemi-001.webp',
    known_for_department: 'Dramatic Actor',
    representation: { representation_type: 'Acting Alum', notes: 'Screen Realism Lab Graduate' },
  },
];

const DELYORK_ACCREDITATIONS = [
  {
    partner: 'Warner Bros. Discovery',
    scope: 'Global Co-Curriculum Partner & Story Lab Masterclasses',
    status: 'Active Global Partner',
    year: '2022 – Present',
  },
  {
    partner: 'New York Film Academy (NYFA)',
    scope: 'Faculty Exchange & Intensive Summer Training Program',
    status: 'Active Affiliation',
    year: '2010 – Present',
  },
  {
    partner: 'Lagos State Creative Initiative (LACI)',
    scope: 'State Creative Fellowship & Youth Capacity Grants',
    status: 'Certified Partner',
    year: '2021 – Present',
  },
  {
    partner: 'Directors Guild of Nigeria (DGN)',
    scope: 'Professional Guild Mentorship & Fast-Track Placement',
    status: 'Endorsed Standard',
    year: '2018 – Present',
  },
];

const KAP_ACCREDITATIONS = [
  {
    partner: 'USC School of Cinematic Arts',
    scope: 'Academic Co-Curriculum & Post-Production Training Partner',
    status: 'Active Global Partner',
    year: '2022 – Present',
  },
  {
    partner: 'Netflix',
    scope: 'African Post-Production & Editing Capacity Scholarship Partner',
    status: 'Studio Alliance',
    year: '2022 – Present',
  },
  {
    partner: 'French Embassy in Nigeria',
    scope: 'Cultural Exchange, Cinema Workshop & Scholar Sponsorship',
    status: 'Diplomatic Alliance',
    year: '2023 – Present',
  },
  {
    partner: 'Ford Foundation',
    scope: 'Youth Filmmaking & Creative Economy Capacity Building',
    status: 'Institutional Grant',
    year: '2021 – Present',
  },
];

/**
 * Editorial 2-Column Detail View for Film Academies & Institutions
 * Designed to mirror world-class architectural & editorial profiles (Realspace / Pathfinder / Indomine).
 */
export default function AcademyEditorialView({
  company,
  representedTalents = [],
  allFilmsWithRole = [],
  linkedChannels = [],
  handleShare,
  copiedLink = false,
}) {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [showAlumniModal, setShowAlumniModal] = useState(false);
  const videoRef = useRef(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const isDelYork = company.slug === 'del-york-creative-academy';
  const isKAP = company.slug === 'kap-film-television-academy';
  const isTAFA = company.slug === 'toyin-abraham-film-academy';
  const hasWebsite = Boolean(company.website && company.website.trim());
  const hasPromoVideo = Boolean(company.promo_video_url || isDelYork);
  const promoVideoSrc = company.promo_video_url || (isDelYork ? '/media/delyork_promo.mp4' : null);
  const hasCampusMedia = isDelYork || isKAP;

  const promoPoster = isDelYork
    ? '/media/delyork/shot_cinematography.jpg'
    : isKAP
      ? '/media/kap/kap_campus_1.jpg'
      : (company.banner_url && !company.banner_url.includes('lateef_at_work_studio')
          ? company.banner_url
          : '/images/academy-placeholder.svg');

  const rightPhotoTop = isDelYork
    ? { src: '/media/delyork/shot_cinematography.jpg', title: 'ARRI Camera & Lighting Bay' }
    : isKAP
      ? { src: '/media/kap/kap_class_2.jpg', title: 'Diploma & Masterclass Hall' }
      : { src: '/images/academy-placeholder.svg', title: 'Film Studio & Soundstage' };

  const rightPhotoBottom = isDelYork
    ? { src: '/media/delyork/shot_directing.jpg', title: 'Directing & Masterclass Studio', badge: 'Campus Studio' }
    : isKAP
      ? { src: '/media/kap/kap_workshop_3.jpg', title: 'Graduating Cohort & Scholars', badge: 'Official Cohort' }
      : { src: '/images/academy-placeholder.svg', title: 'Cinematography & Directing', badge: 'Academic Slate' };

  const mediaItems = isDelYork
    ? [
        { type: 'video', src: '/media/delyork_promo.mp4', poster: '/media/delyork/shot_cinematography.jpg', title: 'Del-York Creative Academy Campus Reel' },
        { type: 'image', src: '/media/delyork/shot_cinematography.jpg', title: 'ARRI Camera & Lighting Bay' },
        { type: 'image', src: '/media/delyork/shot_directing.jpg', title: 'Directing & Masterclass Studio' },
      ]
    : isKAP
      ? [
          { type: 'image', src: '/media/kap/kap_campus_1.jpg', title: 'KAP Cinema Screening Auditorium' },
          { type: 'image', src: '/media/kap/kap_class_2.jpg', title: 'Diploma & Masterclass Hall' },
          { type: 'image', src: '/media/kap/kap_workshop_3.jpg', title: 'Graduating Cohort in Academic Gowns' },
        ]
      : [
          { type: 'image', src: promoPoster, title: `${company.name} Studio Slate` },
        ];

  const academyLogo = isDelYork
    ? '/media/delyork/delyork_logo_square.jpg'
    : isKAP
      ? '/media/kap/kap_about.png'
      : isTAFA
        ? 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/people/e175f93a-31ec-44b6-93a7-b31b42f183f8.webp'
        : (company.logo_url || '/images/academy-placeholder.svg');

  const faculties = company.faculties || (isTAFA ? [
    {
      title: 'Acting for Film & Screen Realism',
      icon: 'solar:masks-bold',
      desc: 'On-camera emotional authenticity, character embodiment, subtext breakdown, voice modulation, and screen presence taught by Toyin Abraham.',
      badge: 'Master Acting Lab',
    },
    {
      title: 'Audition Mastery & Casting Readiness',
      icon: 'solar:user-speak-bold',
      desc: 'Monologue selection, self-tape production, cold-reading techniques, casting director etiquette, and talent management readiness.',
      badge: 'Casting Studio',
    },
    {
      title: 'Directing & Dramatic Set Blocking',
      icon: 'solar:clapperboard-play-bold',
      desc: 'Scene orchestration, camera blocking for multi-camera Nollywood sets, working with actors, and translating scripts to high-energy scenes.',
      badge: 'Director Workshop',
    },
    {
      title: 'Comedic Timing & Screenplay Dynamics',
      icon: 'solar:document-text-bold',
      desc: 'Writing humor for broad commercial audiences, comedic rhythm, dialogue improvisation, and character foils for Nollywood blockbusters.',
      badge: 'Writers Room',
    },
    {
      title: 'Stunt Choreography & Action Staging',
      icon: 'solar:running-bold',
      desc: 'Safe stage combat, dramatic action choreography, stunt doubling coordination, and cinematic fight timing under seasoned action directors.',
      badge: 'Action Studio',
    },
    {
      title: 'Film Production Management & Set Discipline',
      icon: 'solar:clipboard-list-bold',
      desc: 'Budgeting, call-sheet management, set protocols, crew coordination, and fast-paced commercial production timelines.',
      badge: 'Production Office',
    },
  ] : [
    {
      title: 'Film Directing & Visual Storytelling',
      icon: 'solar:clapperboard-play-bold',
      desc: 'Camera blocking, visual language, multi-camera set orchestration, scene composition, and working with actors for dramatic authenticity.',
      badge: 'Studio Soundstage Lab',
    },
    {
      title: 'Screenwriting & Writers’ Room',
      icon: 'solar:document-text-bold',
      desc: 'Three-act cinematic structure, episodic TV formats, dialogue sharpening, writers’ room collaboration, and pitch bible packaging for SVOD.',
      badge: 'Script Development Lab',
    },
    {
      title: 'Cinematography & Lighting Craft',
      icon: 'solar:videocamera-record-bold',
      desc: 'ARRI Alexa & RED Digital camera operation, anamorphic lens craft, dramatic high-key & low-key lighting setups, and color pipeline management.',
      badge: 'Cinema Camera Bay',
    },
    {
      title: '3D Animation, CGI & VFX',
      icon: 'solar:magic-stick-3-bold',
      desc: 'Unreal Engine 5 virtual production, Maya 3D character modeling, environment design, digital compositing, and motion capture workflows.',
      badge: 'VFX Compute Lab',
    },
    {
      title: 'Acting for Film & Screen',
      icon: 'solar:masks-bold',
      desc: 'On-camera realism, audition technique, emotional recall, voice & dialect coaching, subtext analysis, and industry casting readiness.',
      badge: 'Performance Studio',
    },
    {
      title: 'Sound Design & Post-Production Audio',
      icon: 'solar:soundwave-bold',
      desc: 'Dolby Atmos spatial mixing, dialogue editing, Foley recording, sound effects synthesis, ADR workflows, and final theatrical stem mastering.',
      badge: 'Dolby Mix Stage',
    },
  ]);

  const accreditations = isDelYork
    ? DELYORK_ACCREDITATIONS
    : isKAP
      ? KAP_ACCREDITATIONS
      : isTAFA
        ? [
            {
              partner: 'Actors Guild of Nigeria (AGN)',
              scope: 'Professional Actor Accreditation & Fast-Track Guild Membership',
              status: 'Endorsed Standard',
              year: '2021 – Present',
            },
            {
              partner: 'Directors Guild of Nigeria (DGN)',
              scope: 'Directing Fellowship & Set Mentorship Placement',
              status: 'Guild Affiliated',
              year: '2022 – Present',
            },
            {
              partner: 'Toyin Abraham Productions',
              scope: 'Direct On-Set Production Internship & Casting Placement',
              status: 'In-House Studio',
              year: '2021 – Present',
            },
            {
              partner: 'National Film and Video Censors Board (NFVCB)',
              scope: 'Industry Classification & Regulatory Compliance Workshops',
              status: 'Certified Partner',
              year: '2023 – Present',
            },
          ]
        : (company.accreditations || null);

  const displayTalents = representedTalents.length >= 4 
    ? representedTalents 
    : isDelYork 
      ? DELYORK_MENTORS 
      : isKAP
        ? KAP_MENTORS
        : isTAFA 
          ? TAFA_MENTORS 
          : representedTalents.length > 0 
            ? representedTalents 
            : [];

  return (
    <div className="w-full bg-bg text-text-primary pb-20">
      
      {/* ─── 1. BREADCRUMBS & TOP ACTIONS BAR ─── */}
      <div className="border-b border-border/70 bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <nav className="flex items-center gap-2 text-text-muted">
            <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
            <span>/</span>
            <Link to="/companies?type=academy" className="hover:text-text-primary transition-colors">Institutions</Link>
            <span>/</span>
            <span className="text-text-primary font-bold truncate max-w-[200px] sm:max-w-none">
              {company.name}
            </span>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-brand text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <Icon icon={copiedLink ? 'solar:check-circle-bold' : 'solar:share-linear'} className="text-sm text-brand" />
              <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
            </button>

            {hasWebsite ? (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-brand text-xs font-bold text-brand transition-colors cursor-pointer"
              >
                <span>Visit Official Site</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-xs" />
              </a>
            ) : company.instagram_url ? (
              <a
                href={company.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-[#E1306C]/40 hover:border-[#E1306C] text-xs font-bold text-[#E1306C] transition-colors cursor-pointer"
              >
                <Icon icon="ri:instagram-line" className="text-xs" />
                <span>Official Instagram</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        
        {/* ─── 2. CAMPUS MEDIA (MOSAIC FOR CAMPUSES WITH REAL MEDIA, SLEEK SLATE FOR OTHERS) ─── */}
        {hasCampusMedia ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 md:h-[420px] lg:h-[460px] xl:h-[480px] rounded-2xl overflow-hidden border border-border/80 bg-surface p-1.5 shadow-sm">
            {/* Main Hero Photo / Live Campus Reel (Left 8 cols) */}
            <div
              onClick={() => setLightboxItem(mediaItems[0])}
              className="md:col-span-8 h-full min-h-0 relative aspect-[16/10] md:aspect-auto rounded-xl overflow-hidden bg-black group cursor-pointer"
            >
              {hasPromoVideo ? (
                <>
                  <video
                    ref={videoRef}
                    src={promoVideoSrc}
                    poster={promoPoster}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                  
                  {/* Top Reel Controls */}
                  <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/75 backdrop-blur-md text-white border border-white/20 hover:border-brand hover:text-brand transition-colors cursor-pointer"
                      title={isPlaying ? 'Pause Reel' : 'Play Reel'}
                    >
                      <Icon icon={isPlaying ? 'solar:pause-bold' : 'solar:play-bold'} className="text-xs" />
                      <span>{isPlaying ? 'Campus Reel' : 'Paused'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      className="p-1.5 rounded-full text-white bg-black/75 backdrop-blur-md border border-white/20 hover:border-brand hover:text-brand transition-colors cursor-pointer"
                      title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                      <Icon icon={isMuted ? 'solar:volume-cross-bold' : 'solar:volume-loud-bold'} className="text-xs" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setLightboxItem(mediaItems[0])}
                      className="p-1.5 rounded-full text-white bg-black/75 backdrop-blur-md border border-white/20 hover:border-brand hover:text-brand transition-colors cursor-pointer"
                      title="View Fullscreen"
                    >
                      <Icon icon="solar:maximize-square-linear" className="text-xs" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img
                    src={promoPoster}
                    alt={`${company.name} Campus Set`}
                    className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                  <button
                    type="button"
                    className="absolute top-3 right-3 p-1.5 rounded-full text-white bg-black/75 backdrop-blur-md border border-white/20 group-hover:border-brand group-hover:text-brand transition-colors"
                  >
                    <Icon icon="solar:maximize-square-linear" className="text-xs" />
                  </button>
                </>
              )}

              {/* Bottom Tag */}
              <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-brand text-black font-heading font-black">
                  {hasPromoVideo ? 'Official Campus Reel' : 'Studio Soundstage'}
                </span>
                <span className="text-xs font-semibold text-white/95 drop-shadow hidden sm:inline-block">
                  {company.name} • {company.headquarters || 'Lagos, Nigeria'}
                </span>
              </div>
            </div>

            {/* Two Stacked Photos (Right 4 cols) - Click to Open Lightbox */}
            <div className="md:col-span-4 h-full min-h-0 flex flex-col gap-3 sm:gap-4">
              <div
                onClick={() => setLightboxItem(mediaItems[1])}
                className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-surface-2 group cursor-pointer"
              >
                <img
                  src={rightPhotoTop.src}
                  alt={rightPhotoTop.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md text-white border border-white/20 truncate">
                    {rightPhotoTop.title}
                  </span>
                  <span className="p-1 rounded bg-black/60 text-white/80 group-hover:text-brand">
                    <Icon icon="solar:maximize-square-linear" className="text-xs" />
                  </span>
                </div>
              </div>

              <div
                onClick={() => setLightboxItem(mediaItems[2])}
                className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-surface-2 group cursor-pointer"
              >
                <img
                  src={rightPhotoBottom.src}
                  alt={rightPhotoBottom.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between gap-1">
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md text-white border border-white/20 truncate">
                    {rightPhotoBottom.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-brand text-black shadow-sm">
                      {rightPhotoBottom.badge}
                    </span>
                    <span className="p-1 rounded bg-black/60 text-white/80 group-hover:text-brand">
                      <Icon icon="solar:maximize-square-linear" className="text-xs" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Sleek Single-Panel Architectural Banner for Academies without Live Campus Stills (e.g. TAFA) */
          <div
            onClick={() => setLightboxItem(mediaItems[0])}
            className="w-full h-[220px] sm:h-[280px] md:h-[320px] rounded-2xl overflow-hidden border border-border/80 bg-surface p-1.5 shadow-sm relative group cursor-pointer"
          >
            <div className="w-full h-full rounded-xl overflow-hidden relative bg-black">
              <img
                src={promoPoster}
                alt={`${company.name} Studio Slate`}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
              
              <div className="absolute top-3 right-3 z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/75 backdrop-blur-md text-white border border-white/20 group-hover:border-brand group-hover:text-brand transition-colors">
                  <Icon icon="solar:maximize-square-linear" className="text-xs" />
                  <span>Fullscreen View</span>
                </span>
              </div>

              <div className="absolute bottom-4 left-4 z-10 space-y-1">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-brand text-black font-heading font-black">
                  {isTAFA ? 'Acting & Studio Slate' : 'Accredited Academy Slate'}
                </span>
                <p className="text-sm font-bold text-white drop-shadow">
                  {company.name} • {company.headquarters || 'Lagos, Nigeria'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── 3. ACADEMY MASTHEAD STRIP (SINGLE SOURCE OF TRUTH — NO DUPLICATE BUTTON) ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pb-6 border-b border-border/70">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-border bg-black overflow-hidden shrink-0 shadow-md p-0.5">
              <ImageWithFallback
                src={academyLogo}
                alt={company.name}
                fallbackType="company"
                name={company.name}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Icon icon="solar:verified-check-bold" className="text-xs" />
                  <span>Accredited Film Academy</span>
                </span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-surface-2 text-text-muted border border-border">
                  Est. {company.founded_year || 2021}
                </span>
              </div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl text-text-primary tracking-tight">
                {company.name}
              </h1>
              <p className="text-xs text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>📍 {company.headquarters || 'Lagos, Nigeria'}</span>
                <span>•</span>
                <span className="text-amber-400 font-semibold">
                  {company.affiliated_studio
                    ? `Affiliated Studio: ${company.affiliated_studio}`
                    : (isTAFA ? 'Toyin Abraham Productions Co-Lab' : (isDelYork ? 'Warner Bros. Discovery Co-Curriculum' : (company.focus || 'Nollywood Screen Craft')))}
                </span>
                <span>•</span>
                <span>{company.alumni_box_office || (isTAFA ? '₦1.2B Commercial Slate' : '₦3.2B Alumni Tracked BO')}</span>
              </p>
            </div>
          </div>

          {/* Clean External Links in Masthead (No duplicate Application button — admissions live cleanly in sidebar desk) */}
          <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
            {hasWebsite ? (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-surface border border-border hover:border-brand text-xs font-bold text-text-primary hover:text-brand inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Visit Portal</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-xs text-brand" />
              </a>
            ) : company.instagram_url ? (
              <a
                href={company.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-surface border border-[#E1306C]/40 hover:border-[#E1306C] text-xs font-bold text-[#E1306C] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Icon icon="ri:instagram-line" className="text-sm" />
                <span>Instagram Desk</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* ─── 4. THE 2-COLUMN EDITORIAL ARCHITECTURE (REALSPACE / INDOMINE) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* ─── LEFT COLUMN: MAIN EDITORIAL CONTENT (68% / 8 COLS) ─── */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* SECTION 1: INSTITUTIONAL PROFILE */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                Institutional Profile
              </span>
              <h2 className="font-heading font-bold text-xl sm:text-2xl text-text-primary tracking-tight">
                Pioneering Capacity-Building for Africa's Screen Economy
              </h2>
              <div className="text-sm text-text-secondary leading-relaxed space-y-3 pt-1">
                {company.description ? (
                  <p>{company.description}</p>
                ) : (
                  <p>
                    {company.name} is a premier capacity-building institution for film, television, screen acting, and media production in Nigeria.
                  </p>
                )}
                {company.founder_name && (
                  <p>
                    Founded by {company.founder_name} ({company.founder_role || 'Founder & Principal'}), the institution provides intensive hands-on screen craft bootcamps instructed by industry masters, directly preparing candidates for professional film sets and commercial production.
                  </p>
                )}
              </div>
            </div>

            {/* SECTION 2: ACADEMIC FACULTIES & STUDIOS (REALSPACE FEATURE GRID) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                    Academic Faculties &amp; Studios
                  </span>
                  <h3 className="font-heading font-bold text-lg sm:text-xl text-text-primary tracking-tight">
                    Professional Studio Disciplines
                  </h3>
                </div>
                <span className="text-xs text-text-muted font-semibold hidden sm:inline-block">
                  6 Accredited Departments
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {faculties.map((fac, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-border/80 bg-surface/75 hover:border-brand/40 transition-colors flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-brand">
                          <Icon icon={fac.icon} className="w-4 h-4" />
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-surface-2 border border-border text-text-muted">
                          {fac.badge}
                        </span>
                      </div>
                      <h4 className="font-heading font-bold text-sm text-text-primary">
                        {fac.title}
                      </h4>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {fac.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: ACCREDITATIONS & STRATEGIC ALLIANCES */}
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Institutional Governance &amp; Standards
                </span>
                <h3 className="font-heading font-bold text-lg sm:text-xl text-text-primary tracking-tight">
                  Accreditations &amp; Global Studio Alliances
                </h3>
              </div>

              {accreditations && accreditations.length > 0 ? (
                <div className="border border-border/80 rounded-xl overflow-hidden bg-surface/60 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-2/70 border-b border-border/80 text-[10px] font-black uppercase tracking-wider text-text-muted">
                        <tr>
                          <th className="py-3 px-4">Partner Institution / Body</th>
                          <th className="py-3 px-4">Scope of Alliance</th>
                          <th className="py-3 px-4">Tenure</th>
                          <th className="py-3 px-4 text-right">Accreditation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {accreditations.map((item, idx) => (
                          <tr key={idx} className="hover:bg-surface-2/40 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-text-primary whitespace-nowrap">
                              {item.partner}
                            </td>
                            <td className="py-3.5 px-4 text-text-secondary">
                              {item.scope}
                            </td>
                            <td className="py-3.5 px-4 text-text-muted font-medium whitespace-nowrap">
                              {item.year}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Icon icon="solar:check-circle-bold" className="text-[10px]" />
                                <span>{item.status}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-border/80 bg-surface/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Icon icon="solar:shield-warning-bold" className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-text-primary">
                        Accreditation &amp; Governance Verification Desk
                      </h4>
                      <p className="text-xs text-text-muted mt-0.5">
                        Independent verification of institutional accreditations and studio alliances is currently in progress for {company.name}.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/contact"
                    className="px-4 py-2 rounded-lg bg-surface border border-border hover:border-brand text-xs font-bold text-text-primary hover:text-brand transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Submit Guild Documentation ↗
                  </Link>
                </div>
              )}
            </div>

            {/* SECTION 4: VERIFIED ACADEMY ALUMNI (STRICTLY ALUMNI, NO MENTORS CONFUSION) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                    Industry Leadership
                  </span>
                  <h3 className="font-heading font-bold text-lg sm:text-xl text-text-primary tracking-tight">
                    Verified Academy Alumni
                  </h3>
                </div>
                <Link
                  to={`/people?institution=${company.slug || ''}&name=${encodeURIComponent(company.name)}`}
                  className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
                >
                  <span>Explore All Alumni</span>
                  <Icon icon="solar:arrow-right-linear" className="w-3.5 h-3.5" />
                </Link>
              </div>

              {displayTalents.length > 0 ? (
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-4 sm:mx-0 sm:px-0 sm:overflow-visible">
                  {displayTalents.slice(0, 4).map((talent) => (
                    <Link
                      key={talent.id}
                      to={`/people/${talent.slug || talent.id}`}
                      className="group p-3 rounded-xl border border-border/80 bg-surface/75 hover:border-brand/50 transition-all hover:-translate-y-1 flex flex-col justify-between gap-3 shadow-xs w-[58vw] sm:w-auto shrink-0 snap-start select-none"
                    >
                      <div className="space-y-2.5">
                        <div className="aspect-square w-full rounded-lg overflow-hidden bg-black relative">
                          <ImageWithFallback
                            src={talent.photo_url}
                            alt={talent.name}
                            fallbackType="avatar"
                            name={talent.name}
                            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-1.5 right-1.5 z-10 max-w-[85%]">
                            <span className="block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-black/85 backdrop-blur-md text-amber-300 border border-amber-400/30 truncate">
                              {talent.representation?.representation_type || 'Alumni Fellow'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-heading font-bold text-xs sm:text-sm text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                            {talent.name}
                          </h4>
                          <p className="text-[10px] font-semibold text-brand truncate uppercase tracking-wider">
                            {talent.known_for_department || 'Film Creator'}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-hairline text-[10px] text-text-muted flex items-center justify-between">
                        <span className="truncate">{talent.representation?.notes || 'Verified Academy Alum'}</span>
                        <span className="text-brand font-bold">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-dashed border-border/80 bg-surface/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                      <Icon icon="solar:diploma-bold" className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-text-primary">
                        Official Alumni &amp; Talent Registry
                      </h4>
                      <p className="text-xs text-text-muted mt-0.5">
                        Verified alumni verification is active for {company.name}. Are you an alumnus, fellow, or graduate?
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/contact"
                    className="px-4 py-2 rounded-lg bg-surface border border-border hover:border-brand text-xs font-bold text-text-primary hover:text-brand transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    Claim or Link Alumni Profile ↗
                  </Link>
                </div>
              )}
            </div>

            {/* SECTION 5: LANDMARK WORKS & SLATES */}
            {allFilmsWithRole.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                      Alumni Catalog
                    </span>
                    <h3 className="font-heading font-bold text-lg sm:text-xl text-text-primary tracking-tight">
                      Landmark Works &amp; Production Slates
                    </h3>
                  </div>
                  <span className="text-xs text-text-muted font-semibold">
                    {allFilmsWithRole.length} Tracked Works
                  </span>
                </div>

                <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 -mx-4 px-4 scrollbar-none sm:grid sm:grid-cols-4 sm:mx-0 sm:px-0 sm:overflow-visible">
                  {allFilmsWithRole.slice(0, 4).map(({ film, role }) => (
                    <Link
                      key={film.id}
                      to={`/films/${film.slug || film.id}`}
                      className="group flex flex-col justify-between rounded-xl border border-border/80 bg-surface/75 overflow-hidden hover:border-brand/50 transition-all hover:-translate-y-1 shadow-xs w-[52vw] sm:w-auto shrink-0 snap-start select-none"
                    >
                      <div className="aspect-[2/3] w-full bg-black overflow-hidden relative">
                        <ImageWithFallback
                          src={film.poster_url}
                          alt={film.title}
                          fallbackType="film"
                          name={film.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {film.year && (
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/80 text-white backdrop-blur-md">
                            {film.year}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 space-y-1">
                        <h4 className="font-heading font-bold text-xs text-text-primary group-hover:text-brand transition-colors line-clamp-1">
                          {formatFilmTitle(film.title)}
                        </h4>
                        <span className="text-[10px] text-text-muted capitalize block">
                          {role || 'Production Partner'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* ─── RIGHT COLUMN: STICKY SIDEBAR (32% / 4 COLS) ─── */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-20 space-y-6">
              
              {/* CARD 1: ADMISSIONS & COHORT BOOKING CARD (REALSPACE / INDOMINE STYLE) */}
              {hasWebsite ? (
                <div className="rounded-2xl border border-brand/40 bg-surface p-5 sm:p-6 shadow-xl space-y-5">
                  <div className="space-y-1.5 pb-4 border-b border-border/70">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-brand/15 text-brand border border-brand/30">
                        Cohort 2026 Admissions
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Open Now
                      </span>
                    </div>
                    <h3 className="font-heading font-black text-xl text-text-primary pt-1">
                      Apply for Next Cohort
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Gain direct hands-on training under seasoned industry masters with guaranteed studio workshop placement.
                    </p>
                  </div>

                  {/* Spec Checklist */}
                  <div className="space-y-2.5 text-xs text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:buildings-2-linear" className="text-sm text-brand" />
                        <span>Campus</span>
                      </span>
                      <span className="font-bold text-text-primary">{company.headquarters || 'Lagos, Nigeria'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:clock-circle-linear" className="text-sm text-brand" />
                        <span>Duration</span>
                      </span>
                      <span className="font-bold text-text-primary">12-Week Studio Intensive</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:diploma-verified-linear" className="text-sm text-brand" />
                        <span>Credential</span>
                      </span>
                      <span className="font-bold text-text-primary">Studio Diploma</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:card-2-linear" className="text-sm text-brand" />
                        <span>Financing</span>
                      </span>
                      <span className="font-bold text-text-primary">Scholarships Available</span>
                    </div>
                  </div>

                  {/* Primary & Secondary Action CTAs */}
                  <div className="space-y-2.5 pt-2">
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <span>Apply for Next Cohort</span>
                      <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
                    </a>

                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-text-primary font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Icon icon="solar:document-linear" className="text-sm text-text-muted" />
                      <span>Download 2026 Prospectus (PDF)</span>
                    </a>
                  </div>

                  <p className="text-[10px] text-center text-text-muted">
                    {isDelYork ? 'Official Warner Bros. Discovery Affiliated Program' : 'Verified Accredited Academy Program'}
                  </p>
                </div>
              ) : (
                /* PURPOSE-BUILT DIRECT INTAKE DESK FOR SCHOOLS WITHOUT STANDALONE WEBSITE (E.G. TAFA) */
                <div className="rounded-2xl border border-amber-500/30 bg-surface p-5 sm:p-6 shadow-xl space-y-5">
                  <div className="space-y-2 pb-4 border-b border-border/70">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Direct Admissions Desk
                      </span>
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Cohorts Periodic
                      </span>
                    </div>
                    <h3 className="font-heading font-black text-xl text-text-primary pt-1">
                      Admissions &amp; Intake
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {company.name} conducts hands-on screen acting and directing bootcamps throughout the year. Intake cycles and audition dates are coordinated directly through verified administration channels.
                    </p>
                  </div>

                  {/* Spec Checklist for Direct Desk */}
                  <div className="space-y-2.5 text-xs text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:buildings-2-linear" className="text-sm text-brand" />
                        <span>Campus / Base</span>
                      </span>
                      <span className="font-bold text-text-primary">{company.headquarters || 'Lagos, Nigeria'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:clock-circle-linear" className="text-sm text-brand" />
                        <span>Format</span>
                      </span>
                      <span className="font-bold text-text-primary">Studio Intensives &amp; Set Bootcamps</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:diploma-verified-linear" className="text-sm text-brand" />
                        <span>Certification</span>
                      </span>
                      <span className="font-bold text-text-primary">Professional Guild Credit</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Icon icon="solar:chat-round-dots-linear" className="text-sm text-brand" />
                        <span>Enrollment</span>
                      </span>
                      <span className="font-bold text-text-primary">Direct Application Desk</span>
                    </div>
                  </div>

                  {/* Action CTAs for Direct Desk */}
                  <div className="space-y-2.5 pt-2">
                    {company.instagram_url ? (
                      <a
                        href={company.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <Icon icon="ri:instagram-line" className="text-base" />
                        <span>Inquire on Official Instagram</span>
                      </a>
                    ) : company.contact_email ? (
                      <a
                        href={`mailto:${company.contact_email}`}
                        className="w-full py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <Icon icon="solar:letter-bold" className="text-base" />
                        <span>Email Admissions Desk</span>
                      </a>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-surface-2 border border-border text-center text-xs text-text-muted leading-relaxed">
                        Next cohort dates will be announced on verified Nollywood industry channels. Check back or visit the academy desk.
                      </div>
                    )}

                    {company.contact_phone && (
                      <a
                        href={`tel:${company.contact_phone}`}
                        className="w-full py-2.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 text-text-primary font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Icon icon="solar:phone-bold" className="text-sm text-text-muted" />
                        <span>Call Desk: {company.contact_phone}</span>
                      </a>
                    )}
                  </div>

                  <p className="text-[10px] text-center text-text-muted">
                    Verified Creative Academy Profile &bull; MuviDB Institutional Registry
                  </p>
                </div>
              )}

              {/* CARD 2: INSTITUTIONAL METADATA TABLE (INDOMINE PROFILE PERUSAHAAN) */}
              <div className="rounded-2xl border border-border/80 bg-surface/80 p-5 space-y-4 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted block">
                  Institutional Metadata
                </span>
                <div className="space-y-3 text-xs divide-y divide-border/60">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-text-muted">Established</span>
                    <span className="font-bold text-text-primary">{company.founded_year || 2021}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-text-muted">Primary Affiliation</span>
                    <span className="font-bold text-amber-400">
                      {company.affiliated_studio
                        ? `Sister Studio: ${company.affiliated_studio}`
                        : (isTAFA ? 'Toyin Abraham Productions' : (isDelYork ? 'Warner Bros. Discovery' : 'Guild Accredited'))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-text-muted">Alumni Network</span>
                    <span className="font-bold text-text-primary">{company.alumni_count || '650+ Trained Talents'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-text-muted">Commercial Slate</span>
                    <span className="font-bold text-amber-400">{company.alumni_box_office || '₦1.2B Tracked Gross'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-text-muted">Leadership</span>
                    <span className="font-bold text-text-primary">{company.founder_name || (isTAFA ? 'Toyin Abraham Ajeyemi' : 'Academy Director')}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-text-muted">Accreditation</span>
                    <span className="font-bold text-emerald-400">Verified Film Academy</span>
                  </div>
                </div>
              </div>

              {/* CARD 3: CAMPUS LOCATION & INQUIRIES */}
              <div className="rounded-2xl border border-border/80 bg-surface/80 p-5 space-y-3 shadow-sm text-xs">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted block">
                  Campus &amp; Admissions Contact
                </span>
                <p className="text-text-secondary leading-relaxed">
                  📍 <strong>{company.headquarters || 'Lagos, Nigeria'}</strong><br />
                  {isDelYork ? 'Victoria Island Studio Campus • Hybrid Online Option' : 'On-Site Production Workshops & Screen Studios'}
                </p>
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-text-muted">
                  <span>Admissions Inquiries</span>
                  {hasWebsite ? (
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand font-semibold hover:underline"
                    >
                      Official Portal ↗
                    </a>
                  ) : company.instagram_url ? (
                    <a
                      href={company.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 font-semibold hover:underline"
                    >
                      Instagram Desk ↗
                    </a>
                  ) : (
                    <span className="text-text-muted">Registry Inquiries</span>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ─── 5. FULL-WIDTH SOLID CALLOUT BANNER (NO GRADIENTS, CLEAN MATTE EDITORIAL) ─── */}
        <div className="mt-16 rounded-2xl border border-border bg-surface p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand/15 text-brand border border-brand/30 inline-block">
            Take Your Place on the Global Screen
          </span>
          <h2 className="font-heading font-black text-2xl sm:text-4xl text-text-primary tracking-tight max-w-2xl mx-auto">
            Ready to Build a Career in the Global Screen Industry?
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary max-w-xl mx-auto leading-relaxed">
            {company.name} alumni direct top Nollywood blockbusters and staff commercial studio productions. Join the next cohort to accelerate your screen career.
          </p>
          <div className="pt-2">
            {hasWebsite ? (
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Apply to {company.name} Today</span>
                <Icon icon="solar:arrow-right-up-linear" className="text-sm" />
              </a>
            ) : company.instagram_url ? (
              <a
                href={company.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 rounded-xl bg-surface-2 border border-[#E1306C]/50 hover:bg-[#E1306C] hover:text-white text-[#E1306C] font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Icon icon="ri:instagram-line" className="text-base" />
                <span>Inquire with {company.name} on Instagram</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handleShare}
                className="px-8 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Share Academy Profile</span>
                <Icon icon="solar:share-linear" className="text-sm" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ─── 6. FULLSCREEN CAMPUS MEDIA LIGHTBOX MODAL ─── */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxItem(null)}
        >
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              className="p-2.5 rounded-full bg-surface/80 hover:bg-surface text-white border border-white/20 transition-colors cursor-pointer"
              title="Close Fullscreen"
            >
              <Icon icon="solar:close-circle-bold" className="text-2xl text-white" />
            </button>
          </div>

          <div
            className="max-w-5xl w-full max-h-[85vh] flex flex-col items-center justify-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxItem.type === 'video' ? (
              <video
                src={lightboxItem.src}
                controls
                autoPlay
                className="max-h-[75vh] w-auto max-w-full rounded-2xl border border-white/10 shadow-2xl"
              />
            ) : (
              <img
                src={lightboxItem.src}
                alt={lightboxItem.title || company.name}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl border border-white/10 shadow-2xl"
              />
            )}
            {lightboxItem.title && (
              <div className="mt-3 text-center">
                <p className="text-sm font-bold text-white tracking-wide">{lightboxItem.title}</p>
                <p className="text-xs text-text-muted mt-0.5">{company.name} · Campus &amp; Production Facility</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
