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

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2, // Improved for mobile response
      infinite: false,
    });

    // Make lenis accessible globally
    (window as any).lenis = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
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
