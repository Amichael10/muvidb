import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';

const ShareAction = ({ title, text, url, variant = 'default', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  const shareUrl = url || window.location.href;
  const shareTitle = title || document.title;
  const shareText = text || `Check this out on Lumi`;

  const socialPlatforms = [
    {
      name: 'X (Twitter)',
      icon: 'ri:twitter-x-fill',
      color: 'text-white bg-black',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'WhatsApp',
      icon: 'ri:whatsapp-fill',
      color: 'text-white bg-[#25D366]',
      href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`
    },
    {
      name: 'Facebook',
      icon: 'ri:facebook-fill',
      color: 'text-white bg-[#1877F2]',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'LinkedIn',
      icon: 'ri:linkedin-fill',
      color: 'text-white bg-[#0A66C2]',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
    }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      setIsOpen(!isOpen);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (variant === 'icon') {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={handleNativeShare}
          className={`p-2 rounded-full hover:bg-surface-2 transition-all ${className}`}
          title="Share"
        >
          <Icon icon="solar:share-linear" className="text-xl" />
        </button>

        {isOpen && (
          <div className="absolute right-0 bottom-full mb-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-[100] overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="p-2 space-y-1">
              {socialPlatforms.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-all group"
                  onClick={() => setIsOpen(false)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${platform.color}`}>
                    <Icon icon={platform.icon} className="text-lg" />
                  </div>
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">{platform.name}</span>
                </a>
              ))}
              <button
                onClick={copyToClipboard}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-all"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-2 text-text-primary">
                  <Icon icon={copied ? "solar:check-read-linear" : "solar:copy-linear"} className={`text-lg ${copied ? 'text-green-500' : ''}`} />
                </div>
                <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">
                  {copied ? 'Copied!' : 'Copy Link'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={menuRef}>
      <button
        onClick={handleNativeShare}
        className={`w-full flex items-center justify-center gap-2 border border-border text-text-primary hover:border-brand hover:text-brand px-6 py-4 rounded-lg font-bold text-[10px] tracking-widest transition-all duration-300 active:scale-95 min-h-[44px] ${className}`}
      >
        <Icon icon="solar:share-linear" className="text-lg" />
        SHARE
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-4 w-full bg-surface border border-border rounded-xl shadow-2xl z-[100] overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
          <div className="p-3 grid grid-cols-2 gap-2">
            {socialPlatforms.map((platform) => (
              <a
                key={platform.name}
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg hover:bg-surface-2 transition-all group border border-transparent hover:border-border"
                onClick={() => setIsOpen(false)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${platform.color} shadow-lg`}>
                  <Icon icon={platform.icon} className="text-xl" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted group-hover:text-text-primary">{platform.name.split(' ')[0]}</span>
              </a>
            ))}
          </div>
          <div className="p-3 pt-0">
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-lg bg-surface-2 hover:bg-border transition-all border border-border"
            >
              <Icon icon={copied ? "solar:check-read-linear" : "solar:copy-linear"} className={`text-lg ${copied ? 'text-green-500' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-text-primary">
                {copied ? 'Link Copied to Clipboard' : 'Copy Page Link'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareAction;
