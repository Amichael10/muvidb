import { useEffect, useState } from 'react';

export default function Drawer({ isOpen, onClose, title, width = '520px', children }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      setTimeout(() => setIsMounted(false), 300); // Wait for transition
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen && !isMounted) return null;

  return (
    <div
      data-lenis-prevent="true"
      style={{ overscrollBehavior: 'contain' }}
      className="fixed inset-0 z-[120] flex justify-end overscroll-contain"
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        data-lenis-prevent="true"
        style={{ width: `min(100vw, ${width})`, overscrollBehavior: 'contain' }}
        className={`relative bg-surface h-full shadow-2xl flex flex-col transition-transform duration-300 ease-out border-l border-border ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-2/50 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-md transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
