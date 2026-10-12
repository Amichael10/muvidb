import { useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';

interface SmoothScrollProps {
  children: ReactNode;
}

export default function SmoothScroll({ children }: SmoothScrollProps) {
  const location = useLocation();

  useEffect(() => {
    // Disable smooth scroll on admin pages to avoid conflicts with fixed layout
    const isAdminPath = location.pathname.startsWith('/admin');
    if (isAdminPath) return;

    // On touch devices, native vertical scroll is more reliable over horizontal
    // film rails (Lenis + nested overflow-x was trapping scroll mid-card).
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (isCoarsePointer) {
      (window as any).lenis = null;
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      // Never hijack touch — nested carousels need native gesture ownership
      syncTouch: false,
      touchMultiplier: 1,
      infinite: false,
      prevent: (node) => {
        if (!node) return false;
        // Never hijack scrolling when cursor is over a modal, drawer, or dialog
        return (
          document.body.style.overflow === 'hidden' ||
          document.body.hasAttribute('data-modal-open') ||
          node.hasAttribute?.('data-lenis-prevent') ||
          Boolean(node.closest?.('[data-lenis-prevent]')) ||
          Boolean(node.closest?.('[role="dialog"]')) ||
          Boolean(node.closest?.('[aria-modal="true"]')) ||
          Boolean(node.closest?.('.fixed.inset-0')) ||
          Boolean(node.closest?.('.modal-backdrop')) ||
          Boolean(node.closest?.('[data-modal]'))
        );
      },
    });

    // Make lenis accessible globally
    (window as any).lenis = lenis;

    // Automatically stop/start Lenis when document.body gets locked/unlocked
    let observer: MutationObserver | null = null;
    if (typeof document !== 'undefined') {
      const syncLenisState = () => {
        const isLocked =
          document.body.style.overflow === 'hidden' ||
          document.body.hasAttribute('data-modal-open');
        if (isLocked) {
          lenis.stop();
        } else {
          lenis.start();
        }
      };

      syncLenisState();

      observer = new MutationObserver(syncLenisState);
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['style', 'data-modal-open', 'class'],
      });
    }

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      observer?.disconnect();
      lenis.destroy();
      (window as any).lenis = null;
      cancelAnimationFrame(rafId);
    };
  }, [location.pathname]); // Re-evaluate on path change to enable/disable appropriately

  // Scroll to top on route change
  useEffect(() => {
    const isAdminPath = location.pathname.startsWith('/admin');
    if (isAdminPath) return;

    const lenis = (window as any).lenis;
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    }
  }, [location.pathname]);

  return <>{children}</>;
}
