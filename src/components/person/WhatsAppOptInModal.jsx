import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

export default function WhatsAppOptInModal({
  isOpen,
  onClose,
  personName,
  personId,
  user,
  onOptInSuccess,
}) {
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error('Please enter a valid WhatsApp number');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/whatsapp?action=opt-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phone: cleanPhone,
          enabled: true,
          personId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to enable WhatsApp alerts');
      }

      if (data.whatsapp_phone) {
        localStorage.setItem('muvidb_user_whatsapp_phone', data.whatsapp_phone);
      }
      toast.success(`WhatsApp alerts enabled for ${personName || 'this filmmaker'}! Number saved to your profile.`);
      if (onOptInSuccess) onOptInSuccess(data.whatsapp_phone);
      onClose();
    } catch (err) {
      console.error('WhatsApp opt-in error:', err);
      toast.error(err.message || 'Could not save phone number');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-5 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-primary rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <Icon icon="lucide:x" className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center flex-shrink-0">
            <Icon icon="logos:whatsapp-icon" className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-heading text-text-primary leading-snug">
              Get WhatsApp Alerts
            </h3>
            <p className="text-xs text-text-muted">
              Never miss a new release or trailer
            </p>
          </div>
        </div>

        {/* Explanatory Context */}
        <div className="bg-surface-elevated/60 border border-border/60 rounded-xl p-3.5 text-xs text-text-secondary leading-relaxed">
          Be the first to know when <strong className="text-text-primary">{personName || 'filmmakers you follow'}</strong> stars in a new film, trailer, or cinema release.
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#25D366]">
            <Icon icon="lucide:shield-check" className="w-4 h-4 flex-shrink-0" />
            <span>Zero spam. 1 message per movie. Reply STOP anytime.</span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              WhatsApp Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                placeholder="+234 801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-all"
              />
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              Include country code (e.g. +234 for Nigeria, +1 for US/Canada)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              Just follow on site
            </button>
            <button
              type="submit"
              disabled={submitting || !phone.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:bg-[#20ba59] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#25D366]/20"
            >
              {submitting ? (
                <>
                  <Icon icon="lucide:loader-2" className="w-4 h-4 animate-spin" />
                  <span>Enabling...</span>
                </>
              ) : (
                <>
                  <Icon icon="lucide:bell" className="w-4 h-4" />
                  <span>Enable WhatsApp Alerts</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
