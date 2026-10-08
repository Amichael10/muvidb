import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import JSZip from 'jszip';

const SECTIONS = [
  { id: 'naming', label: 'Naming', icon: 'solar:text-bold' },
  { id: 'wordmark', label: 'Wordmark', icon: 'solar:gallery-bold' },
  { id: 'logo', label: 'Logo & Symbol', icon: 'solar:clapperboard-play-bold' },
  { id: 'colors', label: 'Colors', icon: 'solar:palette-bold' },
  { id: 'typography', label: 'Typography', icon: 'solar:text-field-bold' },
  { id: 'guidelines', label: 'Guidelines', icon: 'solar:shield-check-bold' },
  { id: 'press', label: 'Press & Media', icon: 'solar:document-text-bold' },
];

const COLOR_SWATCHES = [
  {
    name: 'MuviDB Orange',
    hex: '#FF5A1F',
    rgb: '255, 90, 31',
    cmyk: '0, 65, 88, 0',
    role: 'Primary Brand & CTAs',
    desc: 'The vibrant signature orange representing the energy, renaissance, and bold storytelling of African cinema.',
    textColor: 'text-white',
    dark: true,
  },
  {
    name: 'Cinematic Black',
    hex: '#080A0D',
    rgb: '8, 10, 13',
    cmyk: '38, 23, 0, 95',
    role: 'Primary Dark Background',
    desc: 'Deep cinematic black inspired by classic movie theater projection rooms and celluloid film reels.',
    textColor: 'text-white',
    dark: true,
  },
  {
    name: 'Slate Surface',
    hex: '#0E1217',
    rgb: '14, 18, 23',
    cmyk: '39, 22, 0, 91',
    role: 'Card & Surface Elevation',
    desc: 'Elevated dark surface used for cards, interactive containers, and modal layers throughout the platform.',
    textColor: 'text-white',
    dark: true,
  },
  {
    name: 'Crisp White',
    hex: '#FFFFFF',
    rgb: '255, 255, 255',
    cmyk: '0, 0, 0, 0',
    role: 'Typography & Light Mode Marks',
    desc: 'Ultra-crisp contrast foreground used for primary titles, headings, and white brand marks on dark backgrounds.',
    textColor: 'text-black',
    dark: false,
    border: true,
  },
  {
    name: 'Heritage Gold',
    hex: '#F59E0B',
    rgb: '245, 158, 11',
    cmyk: '0, 35, 96, 4',
    role: 'Box Office & Awards Accent',
    desc: 'Rich commemorative gold reserved for box office records, award nominations, and verified credentials.',
    textColor: 'text-black',
    dark: false,
  },
];

const WORDMARK_ASSETS = [
  {
    title: 'Wordmark (Dark Mode)',
    desc: 'White letterforms for dark slate and black cinematic backgrounds.',
    recommended: true,
    bgClass: 'bg-[#080A0D] border-border',
    svgUrl: '/brand/wordmark-dark.svg',
    pngUrl: '/brand/wordmark-dark.png',
  },
  {
    title: 'Wordmark (Light Mode)',
    desc: 'Deep black letterforms for light editorial sheets and white backgrounds.',
    bgClass: 'bg-[#F9FAFB] border-border',
    svgUrl: '/brand/wordmark-light.svg',
    pngUrl: '/brand/wordmark-light.png',
    isLightCard: true,
  },
  {
    title: 'Wordmark (Signature Orange)',
    desc: 'High-energy brand orange letterforms for hero moments and posters.',
    bgClass: 'bg-[#0E1217] border-border',
    svgUrl: '/brand/wordmark-orange.svg',
    pngUrl: '/brand/wordmark-orange.png',
  },
];

const LOGO_ASSETS = [
  {
    title: 'Film Reel Symbol (White)',
    desc: 'Crisp white emblem for dark headers, app splash screens, and stamps.',
    recommended: true,
    bgClass: 'bg-[#080A0D] border-border',
    svgUrl: '/brand/icon-dark.svg',
    pngUrl: '/brand/icon-dark.png',
  },
  {
    title: 'Film Reel Symbol (Black)',
    desc: 'Solid dark emblem for white paper, editorial prints, and light mode.',
    bgClass: 'bg-[#F9FAFB] border-border',
    svgUrl: '/brand/icon-light.svg',
    pngUrl: '/brand/icon-light.png',
    isLightCard: true,
  },
  {
    title: 'Film Reel Symbol (Brand Orange)',
    desc: 'The iconic MuviDB orange emblem representing the golden reel.',
    bgClass: 'bg-[#0E1217] border-border',
    svgUrl: '/brand/icon.svg',
    pngUrl: '/brand/icon.png',
  },
  {
    title: 'Film Reel Symbol (Crimson)',
    desc: 'Special edition red variant for cinematic trailers and badges.',
    bgClass: 'bg-[#080A0D] border-border',
    svgUrl: '/brand/icon-red.svg',
    pngUrl: '/brand/icon-red.png',
  },
];

export default function Brand() {
  const [activeSection, setActiveSection] = useState('naming');
  const [isZipping, setIsZipping] = useState(false);
  const observerRef = useRef(null);

  // ScrollSpy to track active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    setActiveSection(id);
    const target = document.getElementById(id);
    if (target) {
      const yOffset = -90;
      const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`, {
      icon: '📋',
      style: { background: '#0E1217', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' },
    });
  };

  const copySvgCode = async (svgUrl, name) => {
    try {
      const res = await fetch(svgUrl);
      if (!res.ok) throw new Error('Failed to load SVG');
      const text = await res.text();
      navigator.clipboard.writeText(text);
      toast.success(`Copied ${name} SVG code!`, {
        icon: '⚡',
        style: { background: '#0E1217', color: '#fff', border: '1px solid #FF5A1F' },
      });
    } catch {
      toast.error('Unable to fetch SVG content.');
    }
  };

  const downloadAllAssetsZip = async () => {
    if (isZipping) return;
    setIsZipping(true);
    const toastId = toast.loading('Packaging MuviDB Brand Kit...', {
      style: { background: '#0E1217', color: '#fff', border: '1px solid #FF5A1F' },
    });

    try {
      const zip = new JSZip();
      const filesToDownload = [
        { path: '/brand/wordmark-dark.svg', folder: 'wordmark', name: 'muvidb-wordmark-dark.svg' },
        { path: '/brand/wordmark-light.svg', folder: 'wordmark', name: 'muvidb-wordmark-light.svg' },
        { path: '/brand/wordmark-orange.svg', folder: 'wordmark', name: 'muvidb-wordmark-orange.svg' },
        { path: '/brand/wordmark-dark.png', folder: 'wordmark', name: 'muvidb-wordmark-dark.png' },
        { path: '/brand/wordmark-light.png', folder: 'wordmark', name: 'muvidb-wordmark-light.png' },
        { path: '/brand/icon-dark.svg', folder: 'symbol', name: 'muvidb-symbol-dark.svg' },
        { path: '/brand/icon-light.svg', folder: 'symbol', name: 'muvidb-symbol-light.svg' },
        { path: '/brand/icon.svg', folder: 'symbol', name: 'muvidb-symbol-orange.svg' },
        { path: '/brand/icon-red.svg', folder: 'symbol', name: 'muvidb-symbol-red.svg' },
        { path: '/brand/icon-dark.png', folder: 'symbol', name: 'muvidb-symbol-dark.png' },
        { path: '/brand/icon.png', folder: 'symbol', name: 'muvidb-symbol-orange.png' },
      ];

      // Readme instructions
      zip.file(
        'README.txt',
        `MuviDB Official Brand Kit\n\n` +
        `This package contains vector (SVG) and raster (PNG) assets for MuviDB.\n\n` +
        `Guidelines:\n` +
        `- The name is always written as "MuviDB".\n` +
        `- Do not rotate, distort, recolor, or add drop shadows to these marks.\n` +
        `- Primary brand orange is #FF5A1F (rgb 255, 90, 31).\n` +
        `- Deep background black is #080A0D.\n\n` +
        `For questions and press inquiries: contact@muvidb.com\n` +
        `Website: https://muvidb.com/brand\n`
      );

      // Fetch all files
      for (const item of filesToDownload) {
        try {
          const res = await fetch(item.path);
          if (res.ok) {
            const blob = await res.blob();
            zip.folder(item.folder).file(item.name, blob);
          }
        } catch (err) {
          console.warn('Skipping file in zip:', item.path, err);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(content);
      downloadLink.download = 'muvidb-brand-kit.zip';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success('MuviDB Brand Kit downloaded!', { id: toastId });
    } catch (err) {
      console.error('Failed to create zip', err);
      toast.error('Failed to generate ZIP archive. You can download individual assets below.', { id: toastId });
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-brand selection:text-white">
      {/* =========================================================================
          HERO SECTION: DUB.CO STYLE WITH DOT MATRIX & WATERMARK LOGO BACKGROUND
         ========================================================================= */}
      <section className="relative overflow-hidden bg-surface pt-16 pb-24 md:pt-20 md:pb-32 border-b border-border">
        {/* Architect Dot Matrix Background with Radial Fade */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,#000_30%,transparent_100%)]"
          style={{
            backgroundImage: 'radial-gradient(var(--color-grid) 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden="true"
        />

        {/* Ambient Brand Orange Glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-brand/15 blur-[120px] rounded-full pointer-events-none -z-10"
          aria-hidden="true"
        />

        {/* Giant Watermark Logo Motion Graphic in Background */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] max-w-[1400px] opacity-[0.06] pointer-events-none select-none -z-10 filter blur-[0.5px]"
          aria-hidden="true"
        >
          <img 
            src="/brand/wordmark-dark.svg" 
            alt="MuviDB watermark" 
            className="w-full h-auto object-contain dark:block hidden"
          />
          <img 
            src="/brand/wordmark-light.svg" 
            alt="MuviDB watermark" 
            className="w-full h-auto object-contain dark:hidden block"
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Subtle Pill Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs font-mono text-text-secondary mb-6 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            <span>Official Identity &amp; Assets</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-heading font-black tracking-tight text-text-primary leading-[1.08]">
            MuviDB Brand Kit
          </h1>

          <p className="mt-5 text-base sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Resources and guidelines for showcasing the MuviDB brand accurately and uniformly across digital products, film posters, press, and editorial media.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={downloadAllAssetsZip}
              disabled={isZipping}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-heading font-bold text-sm uppercase tracking-wider shadow-[0_4px_20px_rgba(255,90,31,0.25)] hover:shadow-[0_6px_25px_rgba(255,90,31,0.35)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {isZipping ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Packaging ZIP...</span>
                </>
              ) : (
                <>
                  <Icon icon="solar:download-square-bold" className="w-5 h-5 text-white" />
                  <span>Download Brand Kit (ZIP)</span>
                </>
              )}
            </button>

            <a
              href="#wordmark"
              onClick={(e) => scrollToSection(e, 'wordmark')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-surface-2 border border-border text-text-primary hover:bg-surface-3 hover:border-brand/40 font-heading font-bold text-sm tracking-wide transition-all"
            >
              <Icon icon="solar:eye-bold" className="w-4 h-4 text-brand" />
              <span>Explore Guidelines</span>
            </a>
          </div>

          {/* Asset Counter Meta */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-text-muted">
            <span className="flex items-center gap-1.5">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-500" />
              Vector SVGs Included
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-500" />
              High-Res Transparent PNGs
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-500" />
              Free Commercial Use
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MAIN CONTAINER WITH STICKY SCROLLSPY SIDEBAR & ARCHITECTURAL GRID
         ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-x border-hairline">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen">
          {/* STICKY SIDEBAR (3 COLS) */}
          <aside className="hidden lg:block lg:col-span-3 border-r border-hairline pr-6 py-12">
            <div className="sticky top-28 space-y-6">
              <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted font-bold px-3">
                Contents
              </div>
              <nav className="space-y-1">
                {SECTIONS.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={(e) => scrollToSection(e, section.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-brand/10 text-brand font-bold border border-brand/25 translate-x-1'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                      }`}
                    >
                      <Icon
                        icon={section.icon}
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand' : 'text-text-muted'}`}
                      />
                      <span>{section.label}</span>
                    </a>
                  );
                })}
              </nav>

              <div className="pt-6 border-t border-border px-3">
                <button
                  onClick={downloadAllAssetsZip}
                  className="w-full py-2.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-xs font-bold text-text-primary flex items-center justify-center gap-2 transition-colors"
                >
                  <Icon icon="solar:download-bold" className="w-3.5 h-3.5 text-brand" />
                  <span>Download ZIP Bundle</span>
                </button>
              </div>
            </div>
          </aside>

          {/* MOBILE TABS HEADER */}
          <div className="lg:hidden sticky top-16 z-30 bg-surface/95 backdrop-blur-md -mx-4 px-4 py-3 border-b border-border overflow-x-auto no-scrollbar flex items-center gap-2">
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => scrollToSection(e, section.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-brand text-white'
                      : 'bg-surface-2 text-text-secondary border border-border'
                  }`}
                >
                  {section.label}
                </a>
              );
            })}
          </div>

          {/* MAIN CONTENT AREA (9 COLS) */}
          <main className="lg:col-span-9 divide-y divide-hairline lg:pl-10">
            {/* 1. NAMING SECTION */}
            <section id="naming" className="py-12 sm:py-16 scroll-mt-24">
              <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-wider mb-2">
                <Icon icon="solar:text-bold" className="w-4 h-4" />
                <span>Nomenclature</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">
                Naming &amp; Casing
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                <strong>MuviDB</strong> should always be written as a single word with capital <strong>M</strong> and capital <strong>DB</strong>.
                When referring to platform features, treat them as proper nouns (e.g. <em>MuviDB Studio</em>, <em>MuviDB Verified</em>, <em>MuviDB Credits</em>).
              </p>

              {/* Casing Rules Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider mb-2">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                    <span>Correct Usage</span>
                  </div>
                  <div className="text-xl font-heading font-black text-text-primary font-mono">
                    MuviDB
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    Always capitalize the "M" and "DB". No spaces, no hyphens, no lowercase db.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider mb-2">
                    <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                    <span>Incorrect Usage</span>
                  </div>
                  <div className="text-base font-mono line-through text-text-muted space-x-3">
                    <span>muvidb</span>
                    <span>MUVIDB</span>
                    <span>Muvi Db</span>
                    <span>Muvidb</span>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Avoid all-caps, separation into two words, or rendering "db" in lowercase.
                  </p>
                </div>
              </div>

              {/* Informational Callout */}
              <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-surface-2 border border-border flex items-start gap-3.5">
                <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">What does MuviDB stand for?</strong> MuviDB stands for <em>Movie Database</em>, specifically built to serve as the unified, open archival authority for Nollywood and the broader African motion picture industry.
                </div>
              </div>
            </section>

            {/* 2. WORDMARK SECTION */}
            <section id="wordmark" className="py-12 sm:py-16 scroll-mt-24">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-wider">
                  <Icon icon="solar:gallery-bold" className="w-4 h-4" />
                  <span>Primary Mark</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-brand/15 border border-brand/30 text-[10px] font-mono text-brand font-bold uppercase">
                  Recommended for Most Placements
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">
                Wordmark
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                The MuviDB wordmark is the primary typographic representation of our brand. It should be used in its original proportions without distortion or tracking modifications.
              </p>

              {/* Wordmark Grid */}
              <div className="mt-8 grid grid-cols-1 gap-6">
                {WORDMARK_ASSETS.map((asset) => (
                  <div
                    key={asset.title}
                    className={`rounded-2xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative group ${asset.bgClass}`}
                  >
                    {asset.recommended && (
                      <span className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-brand text-white text-[9px] font-black uppercase tracking-wider">
                        Default
                      </span>
                    )}

                    {/* Preview Display */}
                    <div className="py-10 sm:py-12 flex items-center justify-center">
                      <img
                        src={asset.svgUrl}
                        alt={asset.title}
                        className="h-12 sm:h-16 w-auto max-w-[85%] object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* Metadata & Actions */}
                    <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className={`text-sm font-bold ${asset.isLightCard ? 'text-black' : 'text-white'}`}>
                          {asset.title}
                        </div>
                        <div className={`text-xs mt-0.5 ${asset.isLightCard ? 'text-neutral-600' : 'text-text-muted'}`}>
                          {asset.desc}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copySvgCode(asset.svgUrl, asset.title)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
                            asset.isLightCard
                              ? 'bg-black/5 hover:bg-black/10 text-neutral-800'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                          title="Copy SVG XML to clipboard"
                        >
                          <Icon icon="solar:copy-bold" className="w-3.5 h-3.5" />
                          <span>Copy SVG</span>
                        </button>

                        <a
                          href={asset.svgUrl}
                          download
                          className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Icon icon="solar:download-minimalistic-bold" className="w-3.5 h-3.5" />
                          <span>SVG</span>
                        </a>

                        <a
                          href={asset.pngUrl}
                          download
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                            asset.isLightCard
                              ? 'bg-black/5 hover:bg-black/10 text-neutral-800'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <Icon icon="solar:file-bold" className="w-3.5 h-3.5" />
                          <span>PNG</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. LOGO & SYMBOL SECTION */}
            <section id="logo" className="py-12 sm:py-16 scroll-mt-24">
              <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-wider mb-2">
                <Icon icon="solar:clapperboard-play-bold" className="w-4 h-4" />
                <span>Logomark</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">
                Film Reel Symbol
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                The MuviDB symbol encapsulates African cinema through an abstract film reel shutter. Use it as a standalone icon when horizontal space is limited, such as in social avatars, app icons, and favicons.
              </p>

              {/* Symbols Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {LOGO_ASSETS.map((asset) => (
                  <div
                    key={asset.title}
                    className={`rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 relative group ${asset.bgClass}`}
                  >
                    {/* Symbol Preview */}
                    <div className="py-10 flex items-center justify-center">
                      <img
                        src={asset.svgUrl}
                        alt={asset.title}
                        className="h-20 w-20 object-contain transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>

                    {/* Metadata & Actions */}
                    <div className="pt-4 border-t border-border">
                      <div className={`text-sm font-bold ${asset.isLightCard ? 'text-black' : 'text-white'}`}>
                        {asset.title}
                      </div>
                      <div className={`text-xs mt-0.5 mb-4 ${asset.isLightCard ? 'text-neutral-600' : 'text-text-muted'}`}>
                        {asset.desc}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copySvgCode(asset.svgUrl, asset.title)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
                            asset.isLightCard
                              ? 'bg-black/5 hover:bg-black/10 text-neutral-800'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                          title="Copy SVG XML"
                        >
                          <Icon icon="solar:copy-bold" className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </button>

                        <a
                          href={asset.svgUrl}
                          download
                          className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Icon icon="solar:download-minimalistic-bold" className="w-3.5 h-3.5" />
                          <span>SVG</span>
                        </a>

                        <a
                          href={asset.pngUrl}
                          download
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                            asset.isLightCard
                              ? 'bg-black/5 hover:bg-black/10 text-neutral-800'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <span>PNG</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. COLOR PALETTE SECTION */}
            <section id="colors" className="py-12 sm:py-16 scroll-mt-24">
              <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-wider mb-2">
                <Icon icon="solar:palette-bold" className="w-4 h-4" />
                <span>Palette</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">
                Color System
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                Click any color swatch below to quickly copy its HEX or RGB code directly to your clipboard.
              </p>

              {/* Color Swatches Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {COLOR_SWATCHES.map((color) => (
                  <div
                    key={color.name}
                    className="rounded-2xl border border-border bg-surface-2 p-4 flex flex-col justify-between hover:border-brand/40 transition-all group"
                  >
                    <div>
                      {/* Swatch Preview */}
                      <div
                        className="h-28 rounded-xl w-full flex items-end p-3 shadow-inner relative overflow-hidden"
                        style={{ backgroundColor: color.hex }}
                      >
                        {color.border && <div className="absolute inset-0 border border-black/10 rounded-xl" />}
                        <span className={`text-xs font-mono font-bold ${color.textColor} drop-shadow-sm`}>
                          {color.hex}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="text-sm font-bold text-text-primary">{color.name}</div>
                        <div className="text-[11px] font-mono text-brand mt-0.5">{color.role}</div>
                        <p className="text-xs text-text-muted mt-2 leading-relaxed">
                          {color.desc}
                        </p>
                      </div>
                    </div>

                    {/* Copy Buttons */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(color.hex, `${color.name} HEX`)}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-surface hover:bg-surface-3 border border-border text-xs font-mono text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Icon icon="solar:copy-bold" className="w-3.5 h-3.5" />
                        <span>{color.hex}</span>
                      </button>

                      <button
                        onClick={() => copyToClipboard(color.rgb, `${color.name} RGB`)}
                        className="py-1.5 px-2.5 rounded-lg bg-surface hover:bg-surface-3 border border-border text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
                        title="Copy RGB"
                      >
                        RGB
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. TYPOGRAPHY SECTION */}
            <section id="typography" className="py-12 sm:py-16 scroll-mt-24">
              <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-wider mb-2">
                <Icon icon="solar:text-field-bold" className="w-4 h-4" />
                <span>Typefaces</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">
                Typography
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                MuviDB pairs the authoritative, cinematic weight of <strong>Libre Franklin</strong> for titles with the clean, modern digital legibility of <strong>Inter</strong> for UI and longform copy.
              </p>

              <div className="mt-8 space-y-6">
                {/* Heading Specimen */}
                <div className="p-6 sm:p-8 rounded-2xl bg-surface-2 border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-brand font-bold uppercase">Display &amp; Headings</span>
                    <span className="text-xs font-mono text-text-muted">Libre Franklin / Franklin Gothic</span>
                  </div>
                  <div className="text-2xl sm:text-4xl font-heading font-black text-text-primary tracking-tight uppercase">
                    THE DEFINITIVE NOLLYWOOD ARCHIVE
                  </div>
                  <p className="mt-3 text-xs sm:text-sm text-text-muted font-heading">
                    Used across billboard titles, feature headlines, box office charts, and platform section headers.
                  </p>
                </div>

                {/* Body Specimen */}
                <div className="p-6 sm:p-8 rounded-2xl bg-surface-2 border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-brand font-bold uppercase">Interface &amp; Body</span>
                    <span className="text-xs font-mono text-text-muted">Inter (Google Fonts)</span>
                  </div>
                  <div className="text-base sm:text-lg text-text-secondary leading-relaxed font-sans">
                    MuviDB is built for speed, transparency, and preservation. From local OCR credit extraction to daily box office tracking, every actor, director, and crew member has a home in African cinema history.
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-mono text-text-muted">
                    <span>Regular 400</span>
                    <span>•</span>
                    <span className="font-semibold text-text-primary">SemiBold 600</span>
                    <span>•</span>
                    <span className="font-bold text-text-primary">Bold 700</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. GUIDELINES (DO'S & DON'TS) */}
            <section id="guidelines" className="py-12 sm:py-16 scroll-mt-24">
              <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-wider mb-2">
                <Icon icon="solar:shield-check-bold" className="w-4 h-4" />
                <span>Best Practices</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">
                Brand Integrity &amp; Rules
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                Please follow these rules to maintain visual clarity and respect the MuviDB identity across all media.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* DO's */}
                <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-2">
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                    <span>Always Do</span>
                  </h3>
                  <ul className="space-y-3 text-xs sm:text-sm text-text-secondary">
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-read-bold" className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Maintain clear space around the logo equal to at least half the height of the mark.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-read-bold" className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Use high-contrast versions (white mark on dark backgrounds, black mark on light backgrounds).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-read-bold" className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Always scale proportionally using vector SVG files whenever possible.</span>
                    </li>
                  </ul>
                </div>

                {/* DONT's */}
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
                    <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                    <span>Never Do</span>
                  </h3>
                  <ul className="space-y-3 text-xs sm:text-sm text-text-secondary">
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:forbidden-circle-bold" className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>Do not rotate, tilt, or stretch the logo or symbol out of proportion.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:forbidden-circle-bold" className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>Do not recolor the logo with gradients or unapproved rainbow palettes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:forbidden-circle-bold" className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>Do not add drop shadows, outer glows, bevels, or outlines to the letterforms.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 7. PRESS & MEDIA BOILERPLATE */}
            <section id="press" className="py-12 sm:py-16 scroll-mt-24">
              <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-wider mb-2">
                <Icon icon="solar:document-text-bold" className="w-4 h-4" />
                <span>Media Kit</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text-primary">
                Press Boilerplate &amp; Contact
              </h2>
              <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                Writing about MuviDB? Feel free to use our official boilerplate summary in your editorial coverage, press releases, and articles.
              </p>

              {/* Boilerplate Box */}
              <div className="mt-6 p-6 rounded-2xl bg-surface-2 border border-border relative">
                <button
                  onClick={() =>
                    copyToClipboard(
                      "MuviDB (muvidb.com) is the open database and archival platform for African cinema and Nollywood. Founded to democratize film preservation, MuviDB provides searchable cast and crew records, verified filmographies, theater showtimes, and industry intelligence for filmmakers, researchers, and audiences worldwide.",
                      "Press Boilerplate"
                    )
                  }
                  className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-3 border border-border text-xs font-mono text-text-primary transition-colors flex items-center gap-1.5"
                >
                  <Icon icon="solar:copy-bold" className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </button>

                <div className="text-xs font-mono text-brand font-bold uppercase mb-3">
                  About MuviDB
                </div>
                <blockquote className="text-sm text-text-secondary leading-relaxed pr-16 italic">
                  “MuviDB (muvidb.com) is the open database and archival platform for African cinema and Nollywood. Founded to democratize film preservation, MuviDB provides searchable cast and crew records, verified filmographies, theater showtimes, and industry intelligence for filmmakers, researchers, and audiences worldwide.”
                </blockquote>
              </div>

              {/* Press Contact Info */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border">
                <div>
                  <div className="text-sm font-bold text-text-primary">Press &amp; Partnership Inquiries</div>
                  <div className="text-xs text-text-muted mt-0.5">Reach our communications team for interviews, high-res assets, or data inquiries.</div>
                </div>
                <a
                  href="mailto:contact@muvidb.com"
                  className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-bold text-text-primary transition-colors flex items-center gap-2"
                >
                  <Icon icon="solar:letter-bold" className="w-4 h-4 text-brand" />
                  <span>contact@muvidb.com</span>
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
