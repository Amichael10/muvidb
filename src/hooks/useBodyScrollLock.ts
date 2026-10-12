import { useEffect } from 'react';

// Track active modal instances to handle nested or simultaneous modals safely
let activeModalCount = 0;
let originalOverflowStyle = '';

/**
 * useBodyScrollLock
 * Locks background scrolling and pauses smooth scrolling (Lenis) when a modal is open.
 * Restores original body scrolling smoothly when the modal is closed.
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    if (activeModalCount === 0) {
      originalOverflowStyle = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-modal-open', 'true');
      if (typeof window !== 'undefined' && (window as any).lenis) {
        (window as any).lenis.stop();
      }
    }
    activeModalCount++;

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = originalOverflowStyle;
        document.body.removeAttribute('data-modal-open');
        if (typeof window !== 'undefined' && (window as any).lenis) {
          (window as any).lenis.start();
        }
      }
    };
  }, [isOpen]);
}

export default useBodyScrollLock;
