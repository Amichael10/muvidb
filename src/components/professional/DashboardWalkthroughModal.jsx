import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';

const TOUR_STEPS = [
  {
    target: '[data-tour="user-card"]',
    title: 'Your Verified Talent Hub',
    icon: 'solar:shield-check-bold',
    description: 'Welcome to your Creator Studio! Your identity, verified badge, and vanity handle are centralized here.',
    tip: 'Your public link is based on your unique handle.',
    placement: 'right',
  },
  {
    target: '[data-tour="portfolio-btn"]',
    title: 'Link-in-Bio Portfolio',
    icon: 'solar:link-circle-bold',
    description: 'Launch your standalone public portfolio page. Feature your showreel video, priority titles, press articles, and EPK.',
    tip: 'Add this link to your Instagram, TikTok, and X bios for casting directors.',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-nav"]',
    title: 'Studio Workspaces',
    icon: 'solar:widget-2-bold',
    description: 'Switch between Filmography & Box Office credits, High-Res Headshots, Video Showreels, and Talent Representation.',
    tip: 'Click any section to access dedicated management tools.',
    placement: 'right',
  },
  {
    target: '[data-tour="top-actions"]',
    title: 'Quick Production Actions',
    icon: 'solar:bolt-circle-bold',
    description: 'Submit verified film appearances, upload 4K headshots, or embed YouTube & Vimeo video performance showreels with 1 click.',
    tip: 'Credits are automatically checked against box office databases.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="passport-widget"]',
    title: 'Digital Career Passport',
    icon: 'solar:diploma-verified-bold',
    description: 'Track your profile completion score and generate your official verified industry passport and digital talent card.',
    tip: 'Share your verified QR passport with festival programmers and agents.',
    placement: 'right',
  },
];

export default function DashboardWalkthroughModal({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 100, left: 100 });
  const animFrameRef = useRef(null);

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  // Measure target element position
  const updatePosition = useCallback(() => {
    if (!isOpen) return;

    const el = document.querySelector(step.target);
    if (!el) {
      // If target element is not found on current screen size, center the tooltip
      setRect(null);
      setTooltipPos({
        top: Math.max(80, window.innerHeight / 2 - 140),
        left: Math.max(16, window.innerWidth / 2 - 190),
      });
      return;
    }

    const b = el.getBoundingClientRect();
    const padding = 8;
    const targetRect = {
      x: Math.max(0, b.left - padding),
      y: Math.max(0, b.top - padding),
      width: b.width + padding * 2,
      height: b.height + padding * 2,
    };
    setRect(targetRect);

    // Compute tooltip position
    const tooltipWidth = Math.min(380, window.innerWidth - 32);
    const tooltipHeight = 260;
    const margin = 16;

    let top = 0;
    let left = 0;

    if (window.innerWidth < 1024) {
      // Mobile / Tablet: place below or center
      top = targetRect.y + targetRect.height + margin;
      if (top + tooltipHeight > window.innerHeight) {
        top = Math.max(16, targetRect.y - tooltipHeight - margin);
      }
      left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.x));
    } else {
      // Desktop: prefer placement specified or right
      if (step.placement === 'bottom') {
        top = targetRect.y + targetRect.height + margin;
        left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.x + targetRect.width / 2 - tooltipWidth / 2));
      } else {
        // Right side placement
        left = targetRect.x + targetRect.width + margin;
        top = targetRect.y + (targetRect.height / 2) - 100;

        // If overflowing right side, flip to left
        if (left + tooltipWidth > window.innerWidth - 16) {
          left = Math.max(16, targetRect.x - tooltipWidth - margin);
        }
      }
    }

    // Keep within viewport bounds
    top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, top));
    left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));

    setTooltipPos({ top, left });
  }, [isOpen, step]);

  // Scroll element into view when step changes
  useEffect(() => {
    if (!isOpen) return;

    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    // Measure after scroll settles
    const timer = setTimeout(updatePosition, 300);
    return () => clearTimeout(timer);
  }, [isOpen, currentStep, step.target, updatePosition]);

  // Listen to window resize and scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, updatePosition]);

  // Keyboard navigation: Escape to skip, ArrowRight to next, ArrowLeft to prev
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleComplete();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast) handleComplete();
        else setCurrentStep((p) => Math.min(TOUR_STEPS.length - 1, p + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((p) => Math.max(0, p - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLast]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep((p) => p + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep((p) => Math.max(0, p - 1));
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('muvidb_pro_walkthrough_seen', 'true');
    } catch (_) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99990] overflow-hidden select-none">
      {/* Dark overlay with SVG cutout spotlight */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto"
        onClick={(e) => {
          if (e.target.tagName === 'rect') handleComplete();
        }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White background reveals the dark mask */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black rectangle creates the transparent cutout hole */}
            {rect && (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Shaded backdrop with cutout mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.78)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Glowing pulsating border around spotlight element */}
      {rect && (
        <div
          className="fixed pointer-events-none rounded-2xl border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all duration-300 ease-out"
          style={{
            top: rect.y,
            left: rect.x,
            width: rect.width,
            height: rect.height,
            zIndex: 99995,
          }}
        />
      )}

      {/* Floating Tutorial Pop-up Card */}
      <div
        className="fixed z-[99999] w-[340px] sm:w-[380px] rounded-3xl border border-white/20 bg-zinc-950/95 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-all duration-300 ease-out animate-fade-in"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />

        {/* Header with Step Counter & Skip */}
        <div className="flex items-center justify-between mb-3 relative">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 font-bold">
              Feature Tour • {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            onClick={handleComplete}
            className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 transition font-mono flex items-center gap-1"
          >
            <span>Skip</span>
            <Icon icon="solar:close-circle-bold" width="14" />
          </button>
        </div>

        {/* Step Title & Icon */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Icon icon={step.icon} width="20" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight">
            {step.title}
          </h3>
        </div>

        {/* Step Description */}
        <p className="text-xs text-zinc-300 leading-relaxed mb-3">
          {step.description}
        </p>

        {/* Pro Tip Box */}
        {step.tip && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 mb-4 text-[11px] text-amber-300 leading-snug">
            <Icon icon="solar:lightbulb-bolt-bold" width="14" className="text-amber-400 shrink-0 mt-0.5" />
            <span>{step.tip}</span>
          </div>
        )}

        {/* Step Indicator Dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
              title={`Jump to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            disabled={currentStep === 0}
            onClick={handlePrev}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 ${
              currentStep === 0
                ? 'opacity-25 cursor-not-allowed text-zinc-600'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon icon="solar:alt-arrow-left-linear" width="13" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <span>{isLast ? 'Got it!' : 'Next Feature'}</span>
            <Icon icon={isLast ? 'solar:check-circle-bold' : 'solar:alt-arrow-right-linear'} width="14" />
          </button>
        </div>
      </div>
    </div>
  );
}
